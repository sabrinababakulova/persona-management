import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

import { getRequestLocale } from "~/i18n/server-locale";
import { writeRecentActivityLog } from "~/server/activity/recent-activity";
import { getRequiredCompanyId } from "~/server/api/router-utils/company";
import { protectedProcedure } from "~/server/api/trpc";
import { takeRateLimitSlot } from "~/server/auth/rate-limit";
import { isUniqueViolation } from "~/server/db/errors";
import { candidateStatusOptions, candidates } from "~/server/db/schema";
import { extractCandidateResumePrefillData } from "~/server/resume/extract-candidate-resume-prefill";
import { generateCandidateAiAnalysis } from "~/server/resume/generate-candidate-ai-analysis";
import {
  DirectusStorageError,
  deleteDirectusFileById,
  isDirectusNotFoundError,
} from "~/server/storage/directus-storage";
import {
  formatFileSize,
  getCandidateResumeStorageKey,
  hasPdfEofMarker,
  hasPdfExtension,
  hasPdfMagicHeader,
  isAllowedPdfMimeType,
  MAX_RESUME_FILE_SIZE_BYTES,
  sanitizeResumeFileName,
  uploadCandidateResumeToStorage,
} from "~/server/storage/resume-storage";
import { getLocalizedText } from "~/shared/localized-ai";

import {
  candidateCreateInputSchema,
  candidateIdInputSchema,
  candidateUpdateInputSchema,
  candidateUploadResumeInputSchema,
} from "./schemas";
import { loadCandidateLookupSets, validateCandidateInput } from "./validators";

const RESUME_UPLOAD_RATE_LIMIT_MAX_REQUESTS = 30;
const RESUME_UPLOAD_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

/**
 * Validates, stores, and analyzes a candidate resume PDF.
 *
 * The mutation accepts base64 from the client, verifies the file is a real PDF
 * within the size limit, uploads it to resume storage, then runs prefill
 * extraction and AI analysis in parallel.
 */
export const uploadResumeProcedure = protectedProcedure
  .input(candidateUploadResumeInputSchema)
  .mutation(async ({ ctx, input }) => {
    const locale = getRequestLocale(ctx.headers);
    const normalizedBase64 = input.fileBase64.replace(/\s+/g, "");
    // Estimate size before decoding so oversized payloads are rejected early.
    const base64Padding = normalizedBase64.endsWith("==")
      ? 2
      : normalizedBase64.endsWith("=")
        ? 1
        : 0;
    const estimatedFileSize =
      Math.floor((normalizedBase64.length * 3) / 4) - base64Padding;

    if (estimatedFileSize <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Файл пустой",
      });
    }

    if (estimatedFileSize > MAX_RESUME_FILE_SIZE_BYTES) {
      throw new TRPCError({
        code: "PAYLOAD_TOO_LARGE",
        message: "Файл слишком большой. Максимум 10MB.",
      });
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(normalizedBase64, "base64");
    } catch {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Некорректный формат файла",
      });
    }

    if (fileBuffer.length <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Файл пустой",
      });
    }

    if (fileBuffer.length > MAX_RESUME_FILE_SIZE_BYTES) {
      throw new TRPCError({
        code: "PAYLOAD_TOO_LARGE",
        message: "Файл слишком большой. Максимум 10MB.",
      });
    }

    // Re-encode to catch malformed base64 that Buffer would otherwise tolerate.
    const recomputedBase64 = fileBuffer.toString("base64").replace(/=+$/, "");
    if (recomputedBase64 !== normalizedBase64.replace(/=+$/, "")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Некорректный формат файла",
      });
    }

    if (!hasPdfExtension(input.fileName)) {
      throw new TRPCError({
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Недопустимое расширение файла. Разрешены только PDF.",
      });
    }

    if (!isAllowedPdfMimeType(input.mimeType)) {
      throw new TRPCError({
        code: "UNSUPPORTED_MEDIA_TYPE",
        message:
          "Недопустимый MIME-тип файла. Разрешен только application/pdf.",
      });
    }

    if (!hasPdfMagicHeader(fileBuffer) || !hasPdfEofMarker(fileBuffer)) {
      throw new TRPCError({
        code: "UNSUPPORTED_MEDIA_TYPE",
        message: "Файл не является валидным PDF",
      });
    }

    const userCompanyId = await getRequiredCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    // Two model calls and a Directus write per invocation, and the candidate row need not
    // exist yet (the prefill flow pre-allocates its id), so nothing else bounds this.
    const allowed = await takeRateLimitSlot(
      `resume-upload:${ctx.session.user.id}`,
      RESUME_UPLOAD_RATE_LIMIT_MAX_REQUESTS,
      RESUME_UPLOAD_RATE_LIMIT_WINDOW_MS,
    );
    if (!allowed) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "Слишком много загрузок резюме. Попробуйте через несколько минут.",
      });
    }

    let resumeFileId: string;
    let candidateHasTags = false;
    try {
      // Validate the storage key before uploading to Directus.
      getCandidateResumeStorageKey(input.candidateId);
      const [candidate] = await ctx.db
        .select({
          id: candidates.id,
          companyId: candidates.companyId,
          resumeFileId: candidates.resumeFileId,
          tags: candidates.tags,
        })
        .from(candidates)
        .where(eq(candidates.id, input.candidateId))
        .limit(1);

      if (candidate && candidate.companyId !== userCompanyId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Кандидат не найден",
        });
      }
      candidateHasTags = Boolean(
        candidate?.tags?.some((tag) => tag.trim().length > 0),
      );

      // Replace the previous stored file when one is known.
      const uploadResult = await uploadCandidateResumeToStorage(
        input.candidateId,
        fileBuffer,
        candidate?.resumeFileId ?? input.previousResumeFileId ?? null,
        input.mimeType || "application/pdf",
      );
      resumeFileId = uploadResult.fileId;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      console.error("Failed to save candidate resume file", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof DirectusStorageError
            ? error.message
            : "Не удалось сохранить файл",
      });
    }

    const resumeFileName = sanitizeResumeFileName(input.fileName);
    const resumeFileSize = formatFileSize(fileBuffer.length);

    // Reuse active lookup values so AI prefill output is normalized to form options.
    // `loadCandidateLookupSets` issues the same eight queries as one `Promise.all`; the copy
    // that used to live here awaited them one after another before any AI work started.
    const lookupOptions = await loadCandidateLookupSets(ctx.db);

    const [prefillExtraction, aiAnalysisResult] = await Promise.all([
      extractCandidateResumePrefillData({
        fileBuffer,
        fileName: resumeFileName,
        lookupOptions: {
          ...lookupOptions,
          vacancyLevels: lookupOptions.vacancyLevelOptions,
        },
        usageContext: {
          db: ctx.db,
          userId: ctx.session?.user?.id,
          companyId: userCompanyId,
          candidateId: input.candidateId,
        },
      }),
      generateCandidateAiAnalysis(
        {
          fileBuffer,
          fileName: resumeFileName,
        },
        {
          db: ctx.db,
          userId: ctx.session?.user?.id,
          companyId: userCompanyId,
          candidateId: input.candidateId,
          operation: "candidate_resume_ai_analysis",
        },
      ),
    ]);

    // A failed model call leaves the previous assessment alone. Writing `null` on failure
    // meant a transient Gemini timeout silently erased a good analysis while the mutation
    // still reported success. The enrichment worker has always spread these conditionally.
    const aiFields =
      aiAnalysisResult.status === "success"
        ? {
            aiAnalysis: aiAnalysisResult.text,
            aiAnalysisTranslations: aiAnalysisResult.translations,
            ...(!candidateHasTags && aiAnalysisResult.tags?.[0]
              ? { tags: aiAnalysisResult.tags }
              : {}),
          }
        : {};

    await ctx.db
      .update(candidates)
      .set({
        resumeFileId,
        resumeFileName,
        resumeFileSize,
        ...aiFields,
      })
      .where(
        and(
          eq(candidates.id, input.candidateId),
          eq(candidates.companyId, userCompanyId),
        ),
      );

    return {
      candidateId: input.candidateId,
      resumeFileId,
      resumeFileName,
      resumeFileSize,
      prefillData: prefillExtraction.prefillData,
      prefillStatus: prefillExtraction.status,
      prefillErrorMessage: prefillExtraction.errorMessage,
      aiAnalysis:
        aiAnalysisResult.status === "success"
          ? getLocalizedText(
              aiAnalysisResult.translations,
              locale,
              aiAnalysisResult.text,
            )
          : "",
      aiAnalysisTranslations: aiAnalysisResult.translations,
      tags: aiAnalysisResult.tags ?? [],
      aiAnalysisStatus: aiAnalysisResult.status,
      aiAnalysisErrorMessage: aiAnalysisResult.errorMessage,
    };
  });

/**
 * Creates a company-scoped candidate after validating lookup-backed fields.
 *
 * Supports an optional caller-supplied UUID so resume-upload prefill flows can
 * create the candidate record with a preallocated id.
 */
export const createCandidateProcedure = protectedProcedure
  .input(candidateCreateInputSchema)
  .mutation(async ({ ctx, input }) => {
    const { normalizedLanguages } = await validateCandidateInput(ctx.db, input);

    const companyId = await getRequiredCompanyId(ctx.db, ctx.session?.user?.id);

    const created = await createCandidateRow();

    async function createCandidateRow() {
      try {
        return await insertCandidate();
      } catch (error) {
        // `id` is optional so the résumé-prefill flow can pre-allocate one, which means a
        // caller can send an id that already exists — including another company's. The
        // primary-key violation used to escape as an untyped 500 that doubled as an
        // existence oracle.
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Кандидат с таким идентификатором уже существует",
          });
        }
        throw error;
      }
    }

    async function insertCandidate() {
      return ctx.db.transaction(async (tx) => {
        const newCandidate = await tx
          .insert(candidates)
          .values({
            ...(input.id ? { id: input.id } : {}),
            fullName: input.fullName,
            city: input.city,
            contacts: input.contacts,
            source: input.source ?? null,
            salaryExpectation: input.salaryExpectation ?? null,
            salaryCurrency: input.salaryCurrency,
            currentPosition: input.currentPosition ?? null,
            skills: input.skills,
            languages: normalizedLanguages,
            workExperience: input.workExperience,
            education: input.education,
            status: input.status,
            aiAnalysis:
              input.aiAnalysisTranslations?.ru?.trim() ||
              input.aiAnalysis?.trim() ||
              null,
            aiAnalysisTranslations: input.aiAnalysisTranslations ?? null,
            tags: input.tags,
            resumeFileId: input.resumeFileId ?? null,
            resumeFileName: input.resumeFileName ?? null,
            resumeFileSize: input.resumeFileSize ?? null,
            companyId,
          })
          .returning();

        return newCandidate[0] ?? null;
      });
    }

    if (!created) {
      return null;
    }

    const actorName =
      ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";

    await writeRecentActivityLog(ctx.db, {
      entityType: "candidate",
      entityId: created.id,
      companyId,
      actorUserId: ctx.session?.user?.id ?? null,
      actorName,
      action: "Создал(а) кандидата",
      targetName: created.fullName,
      targetStatus: "Создан",
    });

    return created;
  });

/**
 * Updates the editable candidate summary fields for the current company.
 *
 * No-op updates return the existing row; real changes create a recent-activity
 * entry, with status changes getting a status-specific action label.
 */
export const updateCandidateProcedure = protectedProcedure
  .input(candidateUpdateInputSchema)
  .mutation(async ({ ctx, input }) => {
    const userCompanyId = await getRequiredCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    const rows = await ctx.db
      .select()
      .from(candidates)
      .where(
        and(
          eq(candidates.id, input.id),
          eq(candidates.companyId, userCompanyId),
        ),
      )
      .limit(1);

    const existing = rows[0];
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Candidate not found",
      });
    }

    const valuesToUpdate: Partial<{
      fullName: string;
      city: string | null;
      source: string | null;
      status: string;
      currentPosition: string | null;
    }> = {};

    if (input.fullName && input.fullName !== existing.fullName) {
      valuesToUpdate.fullName = input.fullName;
    }
    if (input.city && input.city !== (existing.city ?? "")) {
      valuesToUpdate.city = input.city;
    }
    if (
      input.source !== undefined &&
      input.source !== (existing.source ?? "")
    ) {
      valuesToUpdate.source = input.source || null;
    }
    if (input.status && input.status !== (existing.status ?? "")) {
      const [statusOption] = await ctx.db
        .select({ value: candidateStatusOptions.value })
        .from(candidateStatusOptions)
        .where(
          and(
            eq(candidateStatusOptions.value, input.status),
            eq(candidateStatusOptions.isActive, true),
          ),
        )
        .limit(1);

      if (!statusOption) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown status: ${input.status}`,
        });
      }

      valuesToUpdate.status = input.status;
    }
    if (
      input.currentPosition !== undefined &&
      input.currentPosition !== (existing.currentPosition ?? "")
    ) {
      valuesToUpdate.currentPosition = input.currentPosition || null;
    }

    if (Object.keys(valuesToUpdate).length === 0) {
      return existing;
    }

    const updatedRows = await ctx.db
      .update(candidates)
      .set(valuesToUpdate)
      .where(
        and(
          eq(candidates.id, input.id),
          eq(candidates.companyId, userCompanyId),
        ),
      )
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update candidate",
      });
    }

    const actorName =
      ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";
    const changedStatus = valuesToUpdate.status ?? null;

    await writeRecentActivityLog(ctx.db, {
      entityType: "candidate",
      entityId: updated.id,
      companyId: userCompanyId,
      actorUserId: ctx.session?.user?.id ?? null,
      actorName,
      action: changedStatus
        ? "Изменил(а) статус кандидата"
        : "Обновил(а) профиль кандидата",
      targetName: updated.fullName,
      targetStatus: changedStatus ?? "Профиль обновлен",
    });

    return updated;
  });

/** Deletes a candidate and its dependent company-scoped records. */
export const deleteCandidateProcedure = protectedProcedure
  .input(candidateIdInputSchema)
  .mutation(async ({ ctx, input }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session?.user?.id);

    const [deleted] = await ctx.db
      .delete(candidates)
      .where(
        and(eq(candidates.id, input.id), eq(candidates.companyId, companyId)),
      )
      .returning({
        id: candidates.id,
        fullName: candidates.fullName,
        resumeFileId: candidates.resumeFileId,
      });

    if (!deleted) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Кандидат не найден",
      });
    }

    const actorName =
      ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";

    await writeRecentActivityLog(ctx.db, {
      entityType: "candidate",
      entityId: deleted.id,
      companyId,
      actorUserId: ctx.session?.user?.id ?? null,
      actorName,
      action: "Удалил(а) кандидата",
      targetName: deleted.fullName,
      targetStatus: "Удалён",
    });

    if (deleted.resumeFileId) {
      try {
        await deleteDirectusFileById(deleted.resumeFileId);
      } catch (error) {
        if (!isDirectusNotFoundError(error)) {
          console.error("Failed to delete candidate resume file", {
            candidateId: deleted.id,
            error,
          });
        }
      }
    }

    return { id: deleted.id };
  });
