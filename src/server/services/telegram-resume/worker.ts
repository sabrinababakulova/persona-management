import { and, eq, sql } from "drizzle-orm";

import type { CandidateResumePrefillData } from "~/schemas/resume-analysis";
import { writeRecentActivityLog } from "~/server/activity/recent-activity";
import { loadCandidateLookupSets } from "~/server/api/routers/candidates/validators";
import { TELEGRAM_RESUME_WAREHOUSE_SYSTEM_KEY } from "~/server/company/telegram-resume-warehouse";
import {
  candidates,
  candidateVacancies,
  telegramResumeImports,
  vacancies,
} from "~/server/db/schema";
import { extractCandidateResumePrefillData } from "~/server/resume/extract-candidate-resume-prefill";
import { generateCandidateAiAnalysis } from "~/server/resume/generate-candidate-ai-analysis";
import { downloadTelegramFile } from "~/server/services/telegram";
import { parseDatabaseTimestamp } from "~/server/services/telegram-resume/dates";
import {
  downloadCandidateResumeFromStorage,
  formatFileSize,
  hasPdfEofMarker,
  hasPdfMagicHeader,
  MAX_RESUME_FILE_SIZE_BYTES,
  uploadCandidateResumeToStorage,
} from "~/server/storage/resume-storage";
import type { LocalizedText } from "~/shared/localized-ai";

type DatabaseClient = typeof import("~/server/db").db;

const MAX_ATTEMPTS = 5;
const STALE_LOCK_MS = 30 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 1;

class PermanentTelegramResumeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentTelegramResumeError";
  }
}

type ClaimedTelegramResumeJob = {
  id: string;
  companyId: string;
  vacancyId: string;
  messageId: number;
  messageDate: Date | null;
  fileId: string | null;
  fileName: string;
  mimeType: string | null;
  candidateId: string;
  resumeFileId: string | null;
  prefillData: CandidateResumePrefillData | null;
  aiAnalysis: string | null;
  aiAnalysisTranslations: LocalizedText | null;
  attempts: number;
};

type RawClaimedTelegramResumeJob = Omit<
  ClaimedTelegramResumeJob,
  "messageDate"
> & {
  messageDate: unknown;
};

export type DrainTelegramResumeImportsResult = {
  claimed: number;
  created: number;
  retried: number;
  failed: number;
};

function backoffDate(attempts: number): Date {
  const minutes = Math.min(2 ** attempts, 60);
  return new Date(Date.now() + minutes * 60 * 1000);
}

function truncate(value: string, maximum: number) {
  return value.trim().slice(0, maximum);
}

function candidateNameFromFile(fileName: string, messageId: number) {
  const inferred = fileName
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(cv|resume|резюме)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  return truncate(inferred || `Кандидат из Telegram ${messageId}`, 255);
}

function toCandidateValues(input: {
  job: ClaimedTelegramResumeJob;
  prefill: CandidateResumePrefillData;
  resumeFileId: string;
  fileSize: number;
  aiAnalysis: string;
  aiAnalysisTranslations: LocalizedText;
}) {
  const { job, prefill } = input;
  const salaryExpectation =
    prefill.salaryExpectation !== undefined &&
    Number.isFinite(prefill.salaryExpectation) &&
    prefill.salaryExpectation >= 0
      ? Math.min(Math.round(prefill.salaryExpectation), 1_000_000_000)
      : null;

  return {
    id: job.candidateId,
    fullName:
      truncate(prefill.fullName, 255) ||
      candidateNameFromFile(job.fileName, job.messageId),
    city: truncate(prefill.city, 255) || null,
    contacts: prefill.contacts.slice(0, 20).map((contact) => ({
      type: truncate(contact.type, 50),
      value: truncate(contact.value, 255),
    })),
    source: "telegram",
    salaryExpectation,
    salaryCurrency: prefill.salaryCurrency,
    currentPosition: truncate(prefill.currentPosition, 255) || null,
    skills: prefill.skills
      .slice(0, 50)
      .map((skill) => truncate(skill, 255))
      .filter(Boolean),
    languages: prefill.languages.slice(0, 20).map((language) => ({
      name: truncate(language.name, 255),
      level: truncate(language.level, 10),
    })),
    workExperience: prefill.workExperience.slice(0, 20).map((experience) => ({
      company: truncate(experience.company, 255),
      position: truncate(experience.position, 255),
      period: truncate(experience.period, 255),
      description: experience.description
        .slice(0, 20)
        .map((description) => truncate(description, 1000))
        .filter(Boolean),
    })),
    education: prefill.education.slice(0, 20).map((education) => ({
      institution: truncate(education.institution, 255),
      gpa: truncate(education.gpa, 50),
      period: truncate(education.period, 255),
    })),
    status: "new",
    aiAnalysis: truncate(input.aiAnalysis, 5000),
    aiAnalysisTranslations: input.aiAnalysisTranslations,
    resumeFileId: input.resumeFileId,
    resumeFileName: job.fileName,
    resumeFileSize: formatFileSize(input.fileSize),
    companyId: job.companyId,
  } satisfies typeof candidates.$inferInsert;
}

function validateResumePdf(buffer: Buffer) {
  if (buffer.length === 0) {
    throw new PermanentTelegramResumeError("Resume PDF is empty");
  }
  if (buffer.length > MAX_RESUME_FILE_SIZE_BYTES) {
    throw new PermanentTelegramResumeError(
      `Resume exceeds the ${MAX_RESUME_FILE_SIZE_BYTES}-byte limit`,
    );
  }
  if (!hasPdfMagicHeader(buffer) || !hasPdfEofMarker(buffer)) {
    throw new PermanentTelegramResumeError(
      "Telegram document is not a valid PDF",
    );
  }
}

async function loadJobBuffer(job: ClaimedTelegramResumeJob) {
  if (job.resumeFileId) {
    const stored = await downloadCandidateResumeFromStorage(job.resumeFileId);
    return stored.buffer;
  }
  if (!job.fileId) {
    throw new PermanentTelegramResumeError(
      "Import has neither a Telegram file id nor a stored resume",
    );
  }

  return downloadTelegramFile(job.fileId, MAX_RESUME_FILE_SIZE_BYTES);
}

export async function drainTelegramResumeImports(input: {
  db: DatabaseClient;
  batchSize?: number;
}): Promise<DrainTelegramResumeImportsResult> {
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;

  await input.db.execute(sql`
    UPDATE "telegram_resume_import"
    SET "status" = 'pending', "locked_at" = NULL
    WHERE "status" = 'processing'
      AND "locked_at" < now() - ${`${STALE_LOCK_MS} milliseconds`}::interval
  `);

  const rawClaimedRows = (await input.db.execute(sql`
    UPDATE "telegram_resume_import"
    SET "status" = 'processing', "locked_at" = now()
    WHERE "id" IN (
      SELECT "id" FROM "telegram_resume_import"
      WHERE "status" = 'pending' AND "run_after" <= now()
        -- Companies without the warehouse feature flag keep their jobs
        -- pending: nothing is processed while the flag is off, and the
        -- backlog resumes untouched when it is re-enabled.
        AND "company_id" IN (
          SELECT "company_id" FROM "company_feature_flag"
          WHERE "feature" = 'telegram_resume_warehouse' AND "is_enabled" = true
        )
      ORDER BY "run_after", "createdAt"
      FOR UPDATE SKIP LOCKED
      LIMIT ${batchSize}
    )
    RETURNING
      "id",
      "company_id" AS "companyId",
      "vacancy_id" AS "vacancyId",
      "message_id" AS "messageId",
      "message_date" AS "messageDate",
      "file_id" AS "fileId",
      "file_name" AS "fileName",
      "mime_type" AS "mimeType",
      "candidate_id" AS "candidateId",
      "resume_file_id" AS "resumeFileId",
      "prefill_data" AS "prefillData",
      "ai_analysis" AS "aiAnalysis",
      "ai_analysis_translations" AS "aiAnalysisTranslations",
      "attempts"
  `)) as unknown as RawClaimedTelegramResumeJob[];
  const claimedRows = rawClaimedRows.map((row) => ({
    ...row,
    messageDate: parseDatabaseTimestamp(row.messageDate),
  }));

  const result: DrainTelegramResumeImportsResult = {
    claimed: claimedRows.length,
    created: 0,
    retried: 0,
    failed: 0,
  };

  for (const job of claimedRows) {
    const outcome = await processTelegramResumeJob(input.db, job);
    result[outcome] += 1;
  }

  return result;
}

async function processTelegramResumeJob(
  db: DatabaseClient,
  job: ClaimedTelegramResumeJob,
): Promise<"created" | "retried" | "failed"> {
  try {
    const [targetVacancy] = await db
      .select({ id: vacancies.id })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.id, job.vacancyId),
          eq(vacancies.companyId, job.companyId),
          eq(vacancies.isPublication, false),
          eq(vacancies.isInternal, true),
          eq(vacancies.systemKey, TELEGRAM_RESUME_WAREHOUSE_SYSTEM_KEY),
        ),
      )
      .limit(1);
    if (!targetVacancy) {
      throw new PermanentTelegramResumeError(
        "Configured Telegram resume vacancy does not belong to the target company",
      );
    }

    const existingCandidate = await db
      .select({ id: candidates.id, companyId: candidates.companyId })
      .from(candidates)
      .where(eq(candidates.id, job.candidateId))
      .limit(1);
    const alreadyCreated = existingCandidate[0];
    if (alreadyCreated) {
      if (alreadyCreated.companyId !== job.companyId) {
        throw new PermanentTelegramResumeError(
          "Preallocated candidate id belongs to another company",
        );
      }
      const [existingAssignment] = await db
        .select({ id: candidateVacancies.id })
        .from(candidateVacancies)
        .where(
          and(
            eq(candidateVacancies.candidateId, job.candidateId),
            eq(candidateVacancies.vacancyId, job.vacancyId),
          ),
        )
        .limit(1);
      if (!existingAssignment) {
        await db.insert(candidateVacancies).values({
          candidateId: job.candidateId,
          vacancyId: job.vacancyId,
          stage: "new",
          applicationState: "active",
          appliedAt: job.messageDate ?? new Date(),
        });
      }
      return finishJob(db, job, "done", null);
    }

    const buffer = await loadJobBuffer(job);
    validateResumePdf(buffer);

    let resumeFileId = job.resumeFileId;
    if (!resumeFileId) {
      const uploaded = await uploadCandidateResumeToStorage(
        job.candidateId,
        buffer,
        null,
        "application/pdf",
      );
      resumeFileId = uploaded.fileId;
      await db
        .update(telegramResumeImports)
        .set({
          resumeFileId,
          fileSize: buffer.length,
        })
        .where(eq(telegramResumeImports.id, job.id));
    }

    let prefillData = job.prefillData;
    let aiAnalysis = job.aiAnalysis?.trim() || "";
    let aiAnalysisTranslations = job.aiAnalysisTranslations;
    if (!prefillData || !aiAnalysis || !aiAnalysisTranslations) {
      const lookupSets = await loadCandidateLookupSets(db);
      const lookupOptions = {
        contactTypes: lookupSets.contactTypes,
        sources: lookupSets.sources,
        positions: lookupSets.positions,
        skills: lookupSets.skills,
        languages: lookupSets.languages,
        languageLevels: lookupSets.languageLevels,
        statusOptions: lookupSets.statusOptions,
        vacancyLevels: lookupSets.vacancyLevelOptions,
      };

      const [extraction, analysis] = await Promise.all([
        prefillData
          ? Promise.resolve(null)
          : extractCandidateResumePrefillData({
              fileBuffer: buffer,
              fileName: job.fileName,
              lookupOptions,
              usageContext: {
                db,
                companyId: job.companyId,
                candidateId: job.candidateId,
              },
            }),
        aiAnalysis && aiAnalysisTranslations
          ? Promise.resolve(null)
          : generateCandidateAiAnalysis(
              {
                fileBuffer: buffer,
                fileName: job.fileName,
              },
              {
                db,
                companyId: job.companyId,
                candidateId: job.candidateId,
                operation: "telegram_candidate_resume_ai_analysis",
              },
            ),
      ]);

      if (extraction && extraction.status !== "failed") {
        prefillData = extraction.prefillData;
      }
      if (analysis?.status === "success") {
        aiAnalysis = analysis.text;
        aiAnalysisTranslations = analysis.translations ?? null;
      }

      await db
        .update(telegramResumeImports)
        .set({
          ...(prefillData ? { prefillData } : {}),
          ...(aiAnalysis ? { aiAnalysis } : {}),
          ...(aiAnalysisTranslations ? { aiAnalysisTranslations } : {}),
        })
        .where(eq(telegramResumeImports.id, job.id));

      const errors = [
        extraction?.status === "failed"
          ? extraction.errorMessage || "Resume extraction failed"
          : null,
        analysis?.status === "failed"
          ? analysis.errorMessage || "Resume analysis failed"
          : null,
      ].filter((value): value is string => Boolean(value));
      if (errors.length > 0) {
        return retryJob(db, job, errors.join("; "));
      }
    }

    if (!prefillData || !aiAnalysis || !aiAnalysisTranslations) {
      return retryJob(db, job, "Mastra resume output is incomplete");
    }

    const candidateValues = toCandidateValues({
      job,
      prefill: prefillData,
      resumeFileId,
      fileSize: buffer.length,
      aiAnalysis,
      aiAnalysisTranslations,
    });

    await db.transaction(async (tx) => {
      await tx.insert(candidates).values(candidateValues);
      await tx.insert(candidateVacancies).values({
        candidateId: job.candidateId,
        vacancyId: job.vacancyId,
        stage: "new",
        applicationState: "active",
        appliedAt: job.messageDate ?? new Date(),
      });
      await tx
        .update(telegramResumeImports)
        .set({
          status: "done",
          attempts: job.attempts + 1,
          lockedAt: null,
          lastError: null,
        })
        .where(eq(telegramResumeImports.id, job.id));
    });

    await writeRecentActivityLog(db, {
      entityType: "candidate",
      entityId: job.candidateId,
      companyId: job.companyId,
      actorUserId: null,
      actorName: "Telegram bot",
      action: "Создан кандидат из Telegram",
      targetName: candidateValues.fullName,
      targetStatus: "Создан",
    });

    return "created";
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown Telegram resume error";
    console.error("Telegram resume processing failed", {
      jobId: job.id,
      error: message,
    });

    if (error instanceof PermanentTelegramResumeError) {
      await finishJob(db, job, "failed", message);
      return "failed";
    }

    return retryJob(db, job, message);
  }
}

async function retryJob(
  db: DatabaseClient,
  job: ClaimedTelegramResumeJob,
  message: string,
): Promise<"retried" | "failed"> {
  const attempts = job.attempts + 1;
  if (attempts >= MAX_ATTEMPTS) {
    await finishJob(db, job, "failed", message);
    return "failed";
  }

  await db
    .update(telegramResumeImports)
    .set({
      status: "pending",
      attempts,
      runAfter: backoffDate(attempts),
      lockedAt: null,
      lastError: truncate(message, 5000),
    })
    .where(eq(telegramResumeImports.id, job.id));

  return "retried";
}

async function finishJob(
  db: DatabaseClient,
  job: ClaimedTelegramResumeJob,
  status: "done" | "failed",
  message: string | null,
): Promise<"created" | "failed"> {
  await db
    .update(telegramResumeImports)
    .set({
      status,
      attempts: job.attempts + 1,
      lockedAt: null,
      lastError: message ? truncate(message, 5000) : null,
    })
    .where(eq(telegramResumeImports.id, job.id));

  return status === "done" ? "created" : "failed";
}
