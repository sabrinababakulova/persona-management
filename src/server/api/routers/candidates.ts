import { writeFile } from "node:fs/promises";
import { asc, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  candidateContactTypes,
  candidateLanguageLevels,
  candidateLanguages,
  candidatePositions,
  candidateSkills,
  candidateSources,
  candidateStatusOptions,
  candidates,
  recentActivityLogs,
  vacancyLevels,
} from "~/server/db/schema";
import { extractCandidateResumePrefillData } from "~/server/resume/extract-candidate-resume-prefill";
import { generateCandidateAiAnalysis } from "~/server/resume/generate-candidate-ai-analysis";
import {
  buildCandidateResumeUrl,
  ensureCandidateResumeDirectory,
  formatFileSize,
  getCandidateResumeFilePath,
  hasPdfEofMarker,
  hasPdfExtension,
  hasPdfMagicHeader,
  isAllowedPdfMimeType,
  MAX_RESUME_FILE_SIZE_BYTES,
  sanitizeResumeFileName,
} from "~/server/storage/resume-storage";
import type { CandidateStatus } from "~/types/server/candidates";

function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

function isValidResumeUrl(value: string) {
  if (value.startsWith("/")) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const candidatesRouter = createTRPCRouter({
  uploadResume: protectedProcedure
    .input(
      z.object({
        candidateId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(255).optional().default(""),
        fileBase64: z.string().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { TRPCError } = await import("@trpc/server");

      const normalizedBase64 = input.fileBase64.replace(/\s+/g, "");
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

      let resumePath: string;
      try {
        resumePath = getCandidateResumeFilePath(input.candidateId);
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Некорректный идентификатор кандидата",
        });
      }

      try {
        await ensureCandidateResumeDirectory(input.candidateId);
        await writeFile(resumePath, fileBuffer, { mode: 0o600 });
      } catch (error) {
        console.error("Failed to save candidate resume file", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Не удалось сохранить файл",
        });
      }

      const resumeFileName = sanitizeResumeFileName(input.fileName);
      const resumeFileSize = formatFileSize(fileBuffer.length);
      const resumeUrl = buildCandidateResumeUrl(input.candidateId);

      const [
        contactTypeOptions,
        sourceOptions,
        positionOptions,
        skillOptions,
        languageOptions,
        languageLevelOptions,
        statusOptions,
        vacancyLevelOptions,
      ] = await Promise.all([
        ctx.db
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
        ctx.db
          .select({
            value: candidateSources.value,
            label: candidateSources.label,
          })
          .from(candidateSources)
          .where(eq(candidateSources.isActive, true))
          .orderBy(
            asc(candidateSources.sortOrder),
            asc(candidateSources.label),
          ),
        ctx.db
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
        ctx.db
          .select({
            value: candidateSkills.value,
            label: candidateSkills.label,
          })
          .from(candidateSkills)
          .where(eq(candidateSkills.isActive, true))
          .orderBy(asc(candidateSkills.sortOrder), asc(candidateSkills.label)),
        ctx.db
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
        ctx.db
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
        ctx.db
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
        ctx.db
          .select({
            value: vacancyLevels.value,
            label: vacancyLevels.label,
          })
          .from(vacancyLevels)
          .where(eq(vacancyLevels.isActive, true))
          .orderBy(asc(vacancyLevels.sortOrder), asc(vacancyLevels.label)),
      ]);

      const [prefillExtraction, aiAnalysisResult] = await Promise.all([
        extractCandidateResumePrefillData({
          fileBuffer,
          fileName: resumeFileName,
          lookupOptions: {
            contactTypes: contactTypeOptions,
            sources: sourceOptions,
            positions: positionOptions,
            skills: skillOptions,
            languages: languageOptions,
            languageLevels: languageLevelOptions,
            statusOptions,
            vacancyLevels: vacancyLevelOptions,
          },
        }),
        generateCandidateAiAnalysis({
          fileBuffer,
          fileName: resumeFileName,
        }),
      ]);

      await ctx.db
        .update(candidates)
        .set({
          resumeUrl,
          resumeFileName,
          resumeFileSize,
          aiAnalysis:
            aiAnalysisResult.status === "success"
              ? aiAnalysisResult.text
              : null,
        })
        .where(eq(candidates.id, input.candidateId));

      return {
        candidateId: input.candidateId,
        resumeUrl,
        resumeFileName,
        resumeFileSize,
        prefillData: prefillExtraction.prefillData,
        prefillStatus: prefillExtraction.status,
        prefillErrorMessage: prefillExtraction.errorMessage,
        aiAnalysis:
          aiAnalysisResult.status === "success" ? aiAnalysisResult.text : "",
        aiAnalysisStatus: aiAnalysisResult.status,
        aiAnalysisErrorMessage: aiAnalysisResult.errorMessage,
      };
    }),

  getAllCandidates: protectedProcedure
    .input(
      z
        .object({
          search: z.string().max(255).optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const search = input?.search?.trim();
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      const conditions = search
        ? [ilike(candidates.fullName, `%${escapeLike(search)}%`)]
        : [];

      const rows = await ctx.db
        .select()
        .from(candidates)
        .where(conditions.length > 0 ? conditions[0] : undefined)
        .orderBy(desc(candidates.createdAt))
        .limit(limit)
        .offset(offset);

      return rows.map((c) => {
        const parts = c.fullName.split(" ");
        const name = parts.slice(0, 2).join(" ");
        const patronymic = parts.slice(2).join(" ");

        return {
          id: c.id,
          name,
          patronymic,
          city: c.city ?? "",
          status: (c.status ?? "new") as CandidateStatus,
          createdAt: c.createdAt
            ? new Date(c.createdAt).toLocaleDateString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
              })
            : "",
          source: c.source ?? "",
        };
      });
    }),

  getCandidateById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(candidates)
        .where(eq(candidates.id, input.id))
        .limit(1);

      const c = rows[0];
      if (!c) {
        return null;
      }

      // Build contacts object from contacts array
      const contactsArr = (c.contacts ?? []) as {
        type: string;
        value: string;
      }[];
      const phone = contactsArr.find((ct) => ct.type === "phone")?.value ?? "";
      const telegram =
        contactsArr.find((ct) => ct.type === "telegram")?.value ?? "";
      const email = contactsArr.find((ct) => ct.type === "email")?.value ?? "";

      return {
        id: c.id,
        name: c.fullName,
        location: (c.city ?? "").toUpperCase(),
        experience: c.experience ?? "",
        matchScore: c.matchScore ?? 0,
        salaryExpectation: c.salaryExpectation ?? 0,
        salaryCurrency: c.salaryCurrency ?? "UZS",
        status: c.status ?? "new",
        source: c.source ?? "",
        tags: (c.tags ?? []) as string[],
        currentPosition: c.currentPosition ?? "",
        languages: (c.languages ?? []) as { name: string; level: string }[],
        skills: (c.skills ?? []) as string[],
        contacts: { phone, telegram, email },
        aiAnalysis: c.aiAnalysis ?? "",
        otherVacancies: [] as string[],
        workExperience: (c.workExperience ?? []) as {
          company: string;
          position: string;
          period: string;
          isCurrent?: boolean;
          description: string[];
        }[],
        education: (c.education ?? []) as {
          institution: string;
          gpa: string;
          period: string;
          isCurrent?: boolean;
        }[],
        resumeFile: {
          name: c.resumeFileName ?? "",
          size: c.resumeFileSize ?? "",
          url: c.resumeUrl ?? "",
        },
        notes: (c.notes ?? []) as {
          id: string;
          content: string;
          author: string;
          createdAt: string;
        }[],
        activities: (c.activities ?? []) as {
          id: string;
          userName: string;
          userAvatar: string;
          action: string;
          targetName: string;
          targetStatus: string;
          timeAgo: string;
        }[],
      };
    }),

  createCandidate: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        fullName: z.string().min(1, "Ф.И.О обязательно").max(255),
        city: z.string().min(1, "Город обязателен").max(255),
        contacts: z
          .array(
            z.object({
              type: z.string().min(1).max(50),
              value: z.string().max(255),
            }),
          )
          .max(20)
          .default([]),
        source: z.string().max(255).optional(),
        salaryExpectation: z.number().min(0).max(1_000_000_000).optional(),
        salaryCurrency: z.enum(["UZS", "USD"]).default("UZS"),
        currentPosition: z.string().max(255).optional(),
        skills: z.array(z.string().max(255)).max(50).default([]),
        languages: z
          .array(
            z.object({
              name: z.string().max(255),
              level: z.string().max(10),
            }),
          )
          .max(20)
          .default([]),
        status: z.string().max(50).default("new"),
        aiAnalysis: z.string().max(5000).optional(),
        resumeUrl: z
          .string()
          .max(500)
          .optional()
          .refine((value) => !value || isValidResumeUrl(value), {
            message: "Некорректная ссылка на резюме",
          }),
        resumeFileName: z.string().max(255).optional(),
        resumeFileSize: z.string().max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { TRPCError } = await import("@trpc/server");

      // Validate incoming values against lookup tables
      const [
        allowedContactTypes,
        allowedSources,
        allowedPositions,
        allowedSkills,
        allowedLanguageLabels,
        allowedLanguageLevels,
        allowedStatuses,
      ] = await Promise.all([
        ctx.db
          .select({ value: candidateContactTypes.value })
          .from(candidateContactTypes)
          .where(eq(candidateContactTypes.isActive, true)),
        ctx.db
          .select({ value: candidateSources.value })
          .from(candidateSources)
          .where(eq(candidateSources.isActive, true)),
        ctx.db
          .select({ value: candidatePositions.value })
          .from(candidatePositions)
          .where(eq(candidatePositions.isActive, true)),
        ctx.db
          .select({ value: candidateSkills.value })
          .from(candidateSkills)
          .where(eq(candidateSkills.isActive, true)),
        ctx.db
          .select({ label: candidateLanguages.label })
          .from(candidateLanguages)
          .where(eq(candidateLanguages.isActive, true)),
        ctx.db
          .select({ value: candidateLanguageLevels.value })
          .from(candidateLanguageLevels)
          .where(eq(candidateLanguageLevels.isActive, true)),
        ctx.db
          .select({ value: candidateStatusOptions.value })
          .from(candidateStatusOptions)
          .where(eq(candidateStatusOptions.isActive, true)),
      ]);

      const contactTypeSet = new Set(allowedContactTypes.map((r) => r.value));
      const sourceSet = new Set(allowedSources.map((r) => r.value));
      const positionSet = new Set(allowedPositions.map((r) => r.value));
      const skillSet = new Set(allowedSkills.map((r) => r.value));
      const languageLabelSet = new Set(
        allowedLanguageLabels.map((r) => r.label),
      );
      const languageLevelSet = new Set(
        allowedLanguageLevels.map((r) => r.value),
      );
      const statusSet = new Set(allowedStatuses.map((r) => r.value));

      for (const c of input.contacts) {
        if (!contactTypeSet.has(c.type)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown contact type: ${c.type}`,
          });
        }
      }

      if (input.source && !sourceSet.has(input.source)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown source: ${input.source}`,
        });
      }

      if (input.currentPosition && !positionSet.has(input.currentPosition)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown position: ${input.currentPosition}`,
        });
      }

      for (const s of input.skills) {
        if (!skillSet.has(s)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown skill: ${s}`,
          });
        }
      }

      for (const l of input.languages) {
        if (!languageLabelSet.has(l.name)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown language: ${l.name}`,
          });
        }
        if (!languageLevelSet.has(l.level)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Unknown language level: ${l.level}`,
          });
        }
      }

      if (!statusSet.has(input.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unknown status: ${input.status}`,
        });
      }

      const newCandidate = await ctx.db
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
          status: input.status,
          aiAnalysis: input.aiAnalysis?.trim() || null,
          resumeUrl: input.resumeUrl ?? null,
          resumeFileName: input.resumeFileName ?? null,
          resumeFileSize: input.resumeFileSize ?? null,
        })
        .returning();

      const created = newCandidate[0];
      if (!created) {
        return null;
      }

      const actorName =
        ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";

      try {
        await ctx.db.insert(recentActivityLogs).values({
          entityType: "candidate",
          entityId: created.id,
          actorUserId: ctx.session?.user?.id ?? null,
          actorName,
          action: "Создал(а) кандидата",
          targetName: created.fullName,
          targetStatus: "Создан",
        });
      } catch (error) {
        console.error(
          "Failed to write recent activity log for candidate creation",
          error,
        );
      }

      return created;
    }),

  updateCandidate: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1).max(255),
        fullName: z.string().min(1).max(255).optional(),
        city: z.string().min(1).max(255).optional(),
        source: z.string().max(255).optional(),
        status: z.string().max(50).optional(),
        currentPosition: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { TRPCError } = await import("@trpc/server");

      const rows = await ctx.db
        .select()
        .from(candidates)
        .where(eq(candidates.id, input.id))
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
        .where(eq(candidates.id, input.id))
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

      try {
        await ctx.db.insert(recentActivityLogs).values({
          entityType: "candidate",
          entityId: updated.id,
          actorUserId: ctx.session?.user?.id ?? null,
          actorName,
          action: changedStatus
            ? "Изменил(а) статус кандидата"
            : "Обновил(а) профиль кандидата",
          targetName: updated.fullName,
          targetStatus: changedStatus ?? "Профиль обновлен",
        });
      } catch (error) {
        console.error(
          "Failed to write recent activity log for candidate",
          error,
        );
      }

      return updated;
    }),
});
