import { and, eq, or } from "drizzle-orm";
import type { Document, Message, Update } from "grammy/types";

import { telegramResumeImports } from "~/server/db/schema";
import {
  hasPdfExtension,
  MAX_RESUME_FILE_SIZE_BYTES,
  sanitizeResumeFileName,
} from "~/server/storage/resume-storage";

import type { TelegramResumeConfig } from "./config";

type DatabaseClient = typeof import("~/server/db").db;

type TelegramResumeDocument = Pick<
  Document,
  "file_id" | "file_unique_id" | "file_name" | "mime_type" | "file_size"
>;

type TelegramResumeMessage = {
  message_id: Message["message_id"];
  date: Message["date"];
  chat: {
    id: Message["chat"]["id"];
    type: Message["chat"]["type"];
    title?: string;
  };
  document?: TelegramResumeDocument;
};

export type TelegramResumeUpdate = {
  update_id: Update["update_id"];
  message?: TelegramResumeMessage;
  channel_post?: TelegramResumeMessage;
};

export type TelegramResumeImportSource = "bot" | "desktop_export";

export type EnqueueTelegramResumeDocumentInput = {
  companyId: string;
  vacancyId: string;
  chatId: string;
  messageId: number;
  updateId?: string | null;
  source: TelegramResumeImportSource;
  document: {
    fileId?: string | null;
    fileUniqueId: string;
    fileName?: string | null;
    mimeType?: string | null;
    fileSize?: number | null;
  };
  messageDate?: Date | null;
};

export type EnqueueTelegramResumeResult =
  | {
      outcome: "enqueued" | "ignored" | "duplicate";
      importId: string;
      candidateId: string;
      status: string;
    }
  | { outcome: "irrelevant" };

function normalizeTelegramResumeFileName(
  fileName: string | null | undefined,
  messageId: number,
) {
  const sanitized = sanitizeResumeFileName(
    fileName?.trim() || `telegram-resume-${messageId}.pdf`,
  );

  return hasPdfExtension(sanitized) ? sanitized : `${sanitized}.pdf`;
}

export function getTelegramResumeIgnoredReason(input: {
  fileName?: string | null;
  mimeType?: string | null;
  fileSize?: number | null;
}): string | null {
  const fileName = input.fileName?.trim() || "";
  const mimeType = input.mimeType?.trim().toLowerCase() || "";
  const looksLikePdf =
    hasPdfExtension(fileName) ||
    mimeType === "application/pdf" ||
    mimeType === "application/octet-stream" ||
    mimeType === "";

  if (!looksLikePdf) {
    return "Only PDF resume documents are supported";
  }
  if (input.fileSize !== undefined && input.fileSize !== null) {
    if (!Number.isSafeInteger(input.fileSize) || input.fileSize <= 0) {
      return "Telegram reported an invalid or empty file size";
    }
    if (input.fileSize > MAX_RESUME_FILE_SIZE_BYTES) {
      return `Resume exceeds the ${MAX_RESUME_FILE_SIZE_BYTES}-byte limit`;
    }
  }

  return null;
}

export async function enqueueTelegramResumeDocument(
  db: DatabaseClient,
  input: EnqueueTelegramResumeDocumentInput,
): Promise<Exclude<EnqueueTelegramResumeResult, { outcome: "irrelevant" }>> {
  const ignoredReason = getTelegramResumeIgnoredReason(input.document);
  const status = ignoredReason ? "ignored" : "pending";
  const candidateId = crypto.randomUUID();
  const fileName = normalizeTelegramResumeFileName(
    input.document.fileName,
    input.messageId,
  );

  const inserted = await db
    .insert(telegramResumeImports)
    .values({
      companyId: input.companyId,
      vacancyId: input.vacancyId,
      chatId: input.chatId,
      messageId: input.messageId,
      updateId: input.updateId ?? null,
      source: input.source,
      fileId: input.document.fileId ?? null,
      fileUniqueId: input.document.fileUniqueId,
      fileName,
      mimeType: input.document.mimeType ?? null,
      fileSize: input.document.fileSize ?? null,
      messageDate: input.messageDate ?? null,
      candidateId,
      status,
      lastError: ignoredReason,
    })
    .onConflictDoNothing()
    .returning({
      id: telegramResumeImports.id,
      candidateId: telegramResumeImports.candidateId,
      status: telegramResumeImports.status,
    });

  const created = inserted[0];
  if (created) {
    return {
      outcome: status === "ignored" ? "ignored" : "enqueued",
      importId: created.id,
      candidateId: created.candidateId,
      status: created.status,
    };
  }

  const existing = await db
    .select({
      id: telegramResumeImports.id,
      candidateId: telegramResumeImports.candidateId,
      status: telegramResumeImports.status,
    })
    .from(telegramResumeImports)
    .where(
      or(
        and(
          eq(telegramResumeImports.chatId, input.chatId),
          eq(telegramResumeImports.messageId, input.messageId),
        ),
        and(
          eq(telegramResumeImports.companyId, input.companyId),
          eq(telegramResumeImports.fileUniqueId, input.document.fileUniqueId),
        ),
      ),
    )
    .limit(1);

  const duplicate = existing[0];
  if (!duplicate) {
    throw new Error(
      "Telegram resume insert conflicted but the existing import was not found",
    );
  }

  if (duplicate.status === "ignored" && !ignoredReason) {
    await db
      .update(telegramResumeImports)
      .set({
        fileId: input.document.fileId ?? null,
        fileName,
        mimeType: input.document.mimeType ?? null,
        fileSize: input.document.fileSize ?? null,
        status: "pending",
        attempts: 0,
        runAfter: new Date(),
        lockedAt: null,
        lastError: null,
      })
      .where(eq(telegramResumeImports.id, duplicate.id));

    return {
      outcome: "enqueued",
      importId: duplicate.id,
      candidateId: duplicate.candidateId,
      status: "pending",
    };
  }

  return {
    outcome: "duplicate",
    importId: duplicate.id,
    candidateId: duplicate.candidateId,
    status: duplicate.status,
  };
}

function getDocumentMessage(
  update: TelegramResumeUpdate,
): TelegramResumeMessage | null {
  return update.message ?? update.channel_post ?? null;
}

function toDocumentInput(document: TelegramResumeDocument) {
  return {
    fileId: document.file_id,
    fileUniqueId: document.file_unique_id,
    fileName: document.file_name,
    mimeType: document.mime_type,
    fileSize: document.file_size,
  };
}

export async function enqueueTelegramResumeUpdate(input: {
  db: DatabaseClient;
  config: TelegramResumeConfig;
  update: TelegramResumeUpdate;
}): Promise<EnqueueTelegramResumeResult> {
  const resumeDocument = toTelegramResumeDocumentInput(
    input.config,
    input.update,
  );
  if (!resumeDocument) {
    return { outcome: "irrelevant" };
  }

  return enqueueTelegramResumeDocument(input.db, resumeDocument);
}

export function toTelegramResumeDocumentInput(
  config: TelegramResumeConfig,
  update: TelegramResumeUpdate,
): EnqueueTelegramResumeDocumentInput | null {
  const message = getDocumentMessage(update);
  if (!message?.document || String(message.chat.id) !== config.chatId) {
    return null;
  }

  return {
    companyId: config.companyId,
    vacancyId: config.vacancyId,
    chatId: config.chatId,
    messageId: message.message_id,
    updateId: String(update.update_id),
    source: "bot",
    document: toDocumentInput(message.document),
    messageDate: new Date(message.date * 1000),
  };
}
