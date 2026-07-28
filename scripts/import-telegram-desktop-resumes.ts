import { createHash } from "node:crypto";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { db } from "../src/server/db";
import { telegramResumeImports } from "../src/server/db/schema";
import { requireTelegramResumeConfig } from "../src/server/services/telegram-resume/config";
import { enqueueTelegramResumeDocument } from "../src/server/services/telegram-resume/ingestion";
import {
  hasPdfEofMarker,
  hasPdfExtension,
  hasPdfMagicHeader,
  MAX_RESUME_FILE_SIZE_BYTES,
  uploadCandidateResumeToStorage,
} from "../src/server/storage/resume-storage";

type TelegramDesktopMessage = {
  id?: number;
  type?: string;
  date?: string;
  date_unixtime?: string;
  file?: string;
  file_name?: string;
  mime_type?: string;
};

type TelegramDesktopExport = {
  name?: string;
  type?: string;
  id?: number;
  messages?: TelegramDesktopMessage[];
};

async function resolveExportPath(exportRoot: string, relativePath: string) {
  const absolute = path.resolve(exportRoot, relativePath);
  const resolved = await realpath(absolute);
  const relative = path.relative(exportRoot, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Unsafe file path in Telegram export: ${relativePath}`);
  }
  return resolved;
}

function parseMessageDate(message: TelegramDesktopMessage) {
  if (message.date_unixtime) {
    const seconds = Number(message.date_unixtime);
    if (Number.isFinite(seconds)) return new Date(seconds * 1000);
  }
  if (message.date) {
    const parsed = new Date(message.date);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

async function main() {
  const requestedPath = process.argv[2];
  if (!requestedPath || requestedPath.startsWith("--")) {
    throw new Error(
      "Usage: import-telegram-desktop-resumes.ts <export-dir|result.json> [--drain]",
    );
  }

  const inputPath = path.resolve(requestedPath);
  const inputStats = await stat(inputPath);
  const jsonPath = await realpath(
    inputStats.isDirectory() ? path.join(inputPath, "result.json") : inputPath,
  );
  const exportRoot = path.dirname(jsonPath);
  const parsed = JSON.parse(
    await readFile(jsonPath, "utf8"),
  ) as TelegramDesktopExport;
  if (!Array.isArray(parsed.messages)) {
    throw new Error(
      "Expected an individual-chat Telegram Desktop JSON export with a messages array",
    );
  }

  const config = requireTelegramResumeConfig();
  const totals = {
    messages: parsed.messages.length,
    pdfs: 0,
    enqueued: 0,
    duplicates: 0,
    invalid: 0,
    uploaded: 0,
  };

  for (const message of parsed.messages) {
    if (
      message.type !== "message" ||
      !Number.isSafeInteger(message.id) ||
      !message.id ||
      !message.file
    ) {
      continue;
    }

    const reportedName = message.file_name || path.basename(message.file);
    if (
      !hasPdfExtension(reportedName) &&
      message.mime_type?.toLowerCase() !== "application/pdf"
    ) {
      continue;
    }
    totals.pdfs += 1;

    let buffer: Buffer;
    try {
      const filePath = await resolveExportPath(exportRoot, message.file);
      const fileStats = await stat(filePath);
      if (
        !fileStats.isFile() ||
        fileStats.size === 0 ||
        fileStats.size > MAX_RESUME_FILE_SIZE_BYTES
      ) {
        totals.invalid += 1;
        continue;
      }
      buffer = Buffer.from(await readFile(filePath));
    } catch (error) {
      totals.invalid += 1;
      console.warn(
        `Skipping unavailable Telegram export file for message ${message.id}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      continue;
    }

    if (
      buffer.length === 0 ||
      buffer.length > MAX_RESUME_FILE_SIZE_BYTES ||
      !hasPdfMagicHeader(buffer) ||
      !hasPdfEofMarker(buffer)
    ) {
      totals.invalid += 1;
      continue;
    }

    const digest = createHash("sha256").update(buffer).digest("hex");
    const result = await enqueueTelegramResumeDocument(db, {
      companyId: config.companyId,
      vacancyId: config.vacancyId,
      chatId: config.chatId,
      messageId: message.id,
      updateId: null,
      source: "desktop_export",
      document: {
        fileId: null,
        fileUniqueId: `desktop:${digest}`,
        fileName: reportedName,
        mimeType: "application/pdf",
        fileSize: buffer.length,
      },
      messageDate: parseMessageDate(message),
    });

    if (result.outcome === "enqueued") totals.enqueued += 1;
    if (result.outcome === "duplicate") totals.duplicates += 1;

    const [importRow] = await db
      .select({
        status: telegramResumeImports.status,
        resumeFileId: telegramResumeImports.resumeFileId,
      })
      .from(telegramResumeImports)
      .where(eq(telegramResumeImports.id, result.importId))
      .limit(1);
    if (
      importRow &&
      importRow.status !== "done" &&
      importRow.status !== "ignored" &&
      !importRow.resumeFileId
    ) {
      const uploaded = await uploadCandidateResumeToStorage(
        result.candidateId,
        buffer,
        null,
        "application/pdf",
      );
      await db
        .update(telegramResumeImports)
        .set({
          resumeFileId: uploaded.fileId,
          fileSize: buffer.length,
          ...(importRow.status === "failed"
            ? {
                status: "pending",
                attempts: 0,
                runAfter: new Date(),
                lockedAt: null,
                lastError: null,
              }
            : {}),
        })
        .where(eq(telegramResumeImports.id, result.importId));
      totals.uploaded += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        chat: {
          exportName: parsed.name ?? null,
          exportType: parsed.type ?? null,
          exportId: parsed.id ?? null,
          configuredChatId: config.chatId,
        },
        queue: totals,
      },
      null,
      2,
    ),
  );

  if (process.argv.includes("--drain")) {
    const { drainTelegramResumeImports } = await import(
      "../src/server/services/telegram-resume/worker"
    );
    const processed = { claimed: 0, created: 0, retried: 0, failed: 0 };
    while (true) {
      const batch = await drainTelegramResumeImports({ db, batchSize: 1 });
      processed.claimed += batch.claimed;
      processed.created += batch.created;
      processed.retried += batch.retried;
      processed.failed += batch.failed;
      if (batch.claimed === 0) break;
    }
    console.log(JSON.stringify({ processed }, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
