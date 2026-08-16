import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";

import { getRequestLocale } from "~/i18n/server-locale";
import { writeRecentActivityLog } from "~/server/activity/recent-activity";
import { getRequiredCompanyId } from "~/server/api/router-utils/company";
import { protectedProcedure } from "~/server/api/trpc";
import {
  candidateContactTypes,
  candidateLanguageLevels,
  candidateLanguages,
  candidatePositions,
  candidateSkills,
  candidateSources,
  candidateStatusOptions,
  candidates,
  vacancyLevels,
} from "~/server/db/schema";
import { extractCandidateResumePrefillData } from "~/server/resume/extract-candidate-resume-prefill";
import { generateCandidateAiAnalysis } from "~/server/resume/generate-candidate-ai-analysis";
import { DirectusStorageError } from "~/server/storage/directus-storage";
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
  candidateUpdateInputSchema,
  candidateUploadResumeInputSchema,
} from "./schemas";
import { validateCandidateInput } from "./validators";

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

    let resumeFileId: string;
    try {
      // Validate the storage key before uploading to Directus.
      getCandidateResumeStorageKey(input.candidateId);
      const [candidate] = await ctx.db
        .select({
          id: candidates.id,
          companyId: candidates.companyId,
          resumeFileId: candidates.resumeFileId,
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
    const lookupOptions = {
      contactTypes: await ctx.db
        .select({
          value: candidateContactTypes.value,
          label: candidateContactTypes.label,
        })
        .from(candidateContactTypes)
        .where(eq(candidateContactTypes.isActive, true))
        .orderBy(
          asc(candidateContactTypes.sortOrder),
          asc(candidateContactTypes.label),
        ),
      sources: await ctx.db
        .select({
          value: candidateSources.value,
          label: candidateSources.label,
        })
        .from(candidateSources)
        .where(eq(candidateSources.isActive, true))
        .orderBy(asc(candidateSources.sortOrder), asc(candidateSources.label)),
      positions: await ctx.db
        .select({
          value: candidatePositions.value,
          label: candidatePositions.label,
        })
        .from(candidatePositions)
        .where(eq(candidatePositions.isActive, true))
        .orderBy(
          asc(candidatePositions.sortOrder),
          asc(candidatePositions.label),
        ),
      skills: await ctx.db
        .select({
          value: candidateSkills.value,
          label: candidateSkills.label,
        })
        .from(candidateSkills)
        .where(eq(candidateSkills.isActive, true))
        .orderBy(asc(candidateSkills.sortOrder), asc(candidateSkills.label)),
      languages: await ctx.db
        .select({
          value: candidateLanguages.value,
          label: candidateLanguages.label,
        })
        .from(candidateLanguages)
        .where(eq(candidateLanguages.isActive, true))
        .orderBy(
          asc(candidateLanguages.sortOrder),
          asc(candidateLanguages.label),
        ),
      languageLevels: await ctx.db
        .select({
          value: candidateLanguageLevels.value,
          label: candidateLanguageLevels.label,
        })
        .from(candidateLanguageLevels)
        .where(eq(candidateLanguageLevels.isActive, true))
        .orderBy(
          asc(candidateLanguageLevels.sortOrder),
          asc(candidateLanguageLevels.label),
        ),
      statusOptions: await ctx.db
        .select({
          value: candidateStatusOptions.value,
          label: candidateStatusOptions.label,
        })
        .from(candidateStatusOptions)
        .where(eq(candidateStatusOptions.isActive, true))
        .orderBy(
          asc(candidateStatusOptions.sortOrder),
          asc(candidateStatusOptions.label),
        ),
      vacancyLevels: await ctx.db
        .select({
          value: vacancyLevels.value,
          label: vacancyLevels.label,
        })
        .from(vacancyLevels)
        .where(eq(vacancyLevels.isActive, true))
        .orderBy(asc(vacancyLevels.sortOrder), asc(vacancyLevels.label)),
    };

    const [prefillExtraction, aiAnalysisResult] = await Promise.all([
      extractCandidateResumePrefillData({
        fileBuffer,
        fileName: resumeFileName,
        lookupOptions,
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

    await ctx.db
      .update(candidates)
      .set({
        resumeFileId,
        resumeFileName,
        resumeFileSize,
        aiAnalysis:
          aiAnalysisResult.status === "success" ? aiAnalysisResult.text : null,
        aiAnalysisTranslations:
          aiAnalysisResult.status === "success"
            ? aiAnalysisResult.translations
            : null,
      })
      .where(eq(candidates.id, input.candidateId));

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
    await validateCandidateInput(ctx.db, input);

    const companyId = await getRequiredCompanyId(ctx.db, ctx.session?.user?.id);

    const created = await ctx.db.transaction(async (tx) => {
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
          languages: input.languages,
          workExperience: input.workExperience,
          education: input.education,
          status: input.status,
          aiAnalysis:
            input.aiAnalysisTranslations?.ru?.trim() ||
            input.aiAnalysis?.trim() ||
            null,
          aiAnalysisTranslations: input.aiAnalysisTranslations ?? null,
          resumeFileId: input.resumeFileId ?? null,
          resumeFileName: input.resumeFileName ?? null,
          resumeFileSize: input.resumeFileSize ?? null,
          companyId,
        })
        .returning();

      return newCandidate[0] ?? null;
    });

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
