import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, gte, ilike, inArray } from "drizzle-orm";
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
  candidateVacancies,
  companyHhAccounts,
  recentActivityLogs,
  users,
  vacancies,
  vacancyLevels,
} from "~/server/db/schema";
import { extractCandidateResumePrefillData } from "~/server/resume/extract-candidate-resume-prefill";
import { generateCandidateAiAnalysis } from "~/server/resume/generate-candidate-ai-analysis";
import {
  fetchCompanyHhVacancies,
  fetchHhResumeById,
  fetchHhVacancyApplicants,
  type HhResumeCandidate,
  type HhVacancyApplicant,
  isHhConfigured,
  iterateHhVacancyApplicantBatches,
  refreshHhAccessToken,
} from "~/server/services/hh";
import { DirectusStorageError } from "~/server/storage/directus-storage";
import {
  buildCandidateResumeUrl,
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
import { getUserCompanyId } from "~/server/utils/get-user-company-id";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";
import type { CandidateStatus } from "~/types/server/candidates";

function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

function formatCandidateActivityTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));

  if (diffSeconds < 60) {
    return "Только что";
  }

  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) {
    return "Сегодня";
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} ч назад`;
  }

  const days = Math.floor(hours / 24);
  if (days === 1) {
    return "Вчера";
  }

  if (days < 7) {
    return `${days} дн назад`;
  }

  return date.toLocaleDateString("ru-RU");
}

function buildActivityStatusPreview(value: string, maxLength = 255) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

const candidatePeriodSchema = z.enum(["day", "week", "month", "year"]);

function getCandidateCreatedAtCutoff(
  period: z.infer<typeof candidatePeriodSchema>,
) {
  const cutoff = new Date();

  switch (period) {
    case "day":
      cutoff.setDate(cutoff.getDate() - 1);
      break;
    case "week":
      cutoff.setDate(cutoff.getDate() - 7);
      break;
    case "month":
      cutoff.setMonth(cutoff.getMonth() - 1);
      break;
    case "year":
      cutoff.setFullYear(cutoff.getFullYear() - 1);
      break;
  }

  return cutoff;
}

async function requireCurrentUserCompanyId(
  db: typeof import("~/server/db").db,
  userId: string | undefined,
) {
  const companyId = await getUserCompanyId(db, userId);

  if (!companyId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "У вас не привязана компания",
    });
  }

  return companyId;
}

type StoredCandidateRecord = typeof candidates.$inferSelect;

function formatHhCandidateForAiAnalysis(candidate: HhResumeCandidate) {
  const contactLines = [
    candidate.contacts.phone
      ? `Телефон: ${candidate.contacts.phone.trim()}`
      : "",
    candidate.contacts.email ? `Email: ${candidate.contacts.email.trim()}` : "",
    candidate.contacts.telegram
      ? `Telegram: ${candidate.contacts.telegram.trim()}`
      : "",
  ].filter(Boolean);

  const workExperienceLines = candidate.workExperience.flatMap((item) => {
    const lines = [
      `Компания: ${item.company || "Не указано"}`,
      `Должность: ${item.position || "Не указано"}`,
      `Период: ${item.period || "Не указан"}`,
    ];

    if (item.description.length > 0) {
      lines.push(`Обязанности и достижения: ${item.description.join("; ")}`);
    }

    return [lines.join("\n")];
  });

  const educationLines = candidate.education.map((item) =>
    [
      `Учебное заведение: ${item.institution || "Не указано"}`,
      `Результат: ${item.gpa || "Не указан"}`,
      `Период: ${item.period || "Не указан"}`,
    ].join("\n"),
  );

  return [
    `ФИО: ${candidate.fullName || "Не указано"}`,
    `Город: ${candidate.city || "Не указан"}`,
    `Текущая должность: ${candidate.currentPosition || "Не указана"}`,
    `Опыт: ${candidate.experience || "Не указан"}`,
    `Зарплатные ожидания: ${
      candidate.salaryExpectation > 0
        ? `${candidate.salaryExpectation} ${candidate.salaryCurrency}`
        : "Не указаны"
    }`,
    `Навыки: ${
      candidate.skills.length > 0 ? candidate.skills.join(", ") : "Не указаны"
    }`,
    `Языки: ${
      candidate.languages.length > 0
        ? candidate.languages
            .map(
              (item) => `${item.name} (${item.level || "уровень не указан"})`,
            )
            .join(", ")
        : "Не указаны"
    }`,
    `Контакты:\n${contactLines.length > 0 ? contactLines.join("\n") : "Не указаны"}`,
    `Опыт работы:\n${
      workExperienceLines.length > 0
        ? workExperienceLines.join("\n\n")
        : "Не указан"
    }`,
    `Образование:\n${
      educationLines.length > 0 ? educationLines.join("\n\n") : "Не указано"
    }`,
  ].join("\n\n");
}

function toStoredCandidateContacts(candidate: HhResumeCandidate) {
  return [
    candidate.contacts.phone
      ? { type: "phone", value: candidate.contacts.phone.trim() }
      : null,
    candidate.contacts.email
      ? { type: "email", value: candidate.contacts.email.trim() }
      : null,
    candidate.contacts.telegram
      ? { type: "telegram", value: candidate.contacts.telegram.trim() }
      : null,
  ].filter((contact): contact is { type: string; value: string } =>
    Boolean(contact?.value),
  );
}

async function getStoredCandidateRecord(
  db: typeof import("~/server/db").db,
  companyId: string,
  candidateId: string,
) {
  const rows = await db
    .select()
    .from(candidates)
    .where(
      and(eq(candidates.id, candidateId), eq(candidates.companyId, companyId)),
    )
    .limit(1);

  return rows[0] ?? null;
}

async function buildCandidateDetailResponse({
  db,
  companyId,
  candidate,
  resumeNameOverride,
  resumeUrlOverride,
}: {
  db: typeof import("~/server/db").db;
  companyId: string;
  candidate: StoredCandidateRecord;
  resumeNameOverride?: string;
  resumeUrlOverride?: string;
}) {
  const contactsArr =
    ((candidate.contacts ?? []) as {
      type: string;
      value: string;
    }[]) ?? [];
  const phone = contactsArr.find((ct) => ct.type === "phone")?.value ?? "";
  const telegram =
    contactsArr.find((ct) => ct.type === "telegram")?.value ?? "";
  const email = contactsArr.find((ct) => ct.type === "email")?.value ?? "";

  const relatedVacancyRows = await db
    .select({
      id: vacancies.id,
      title: vacancies.title,
    })
    .from(candidateVacancies)
    .innerJoin(vacancies, eq(candidateVacancies.vacancyId, vacancies.id))
    .where(
      and(
        eq(candidateVacancies.candidateId, candidate.id),
        eq(vacancies.companyId, companyId),
      ),
    )
    .orderBy(desc(candidateVacancies.id));

  const activityRows = await db
    .select({
      id: recentActivityLogs.id,
      actorName: recentActivityLogs.actorName,
      createdAt: recentActivityLogs.createdAt,
      action: recentActivityLogs.action,
      targetName: recentActivityLogs.targetName,
      targetStatus: recentActivityLogs.targetStatus,
      userAvatar: users.image,
    })
    .from(recentActivityLogs)
    .leftJoin(users, eq(recentActivityLogs.actorUserId, users.id))
    .where(
      and(
        eq(recentActivityLogs.companyId, companyId),
        eq(recentActivityLogs.entityType, "candidate"),
        eq(recentActivityLogs.entityId, candidate.id),
      ),
    )
    .orderBy(desc(recentActivityLogs.createdAt))
    .limit(10);

  return {
    id: candidate.id,
    name: candidate.fullName,
    location: (candidate.city ?? "").toUpperCase(),
    experience: candidate.experience ?? "",
    matchScore: candidate.matchScore ?? 0,
    salaryExpectation: candidate.salaryExpectation ?? 0,
    salaryCurrency: candidate.salaryCurrency ?? "UZS",
    status: candidate.status ?? "new",
    source: candidate.source ?? "",
    tags: (candidate.tags ?? []) as string[],
    currentPosition: candidate.currentPosition ?? "",
    languages: (candidate.languages ?? []) as {
      name: string;
      level: string;
    }[],
    skills: (candidate.skills ?? []) as string[],
    contacts: { phone, telegram, email },
    aiAnalysis: candidate.aiAnalysis ?? "",
    otherVacancies: relatedVacancyRows.map((vacancy) => vacancy.title),
    relatedVacancies: relatedVacancyRows,
    workExperience: (candidate.workExperience ?? []) as {
      company: string;
      position: string;
      period: string;
      isCurrent?: boolean;
      description: string[];
    }[],
    education: (candidate.education ?? []) as {
      institution: string;
      gpa: string;
      period: string;
      isCurrent?: boolean;
    }[],
    resumeFile: {
      name:
        candidate.resumeFileName ??
        (resumeUrlOverride ? (resumeNameOverride ?? "") : ""),
      size: candidate.resumeFileSize ?? "",
      url: candidate.resumeFileId
        ? buildCandidateResumeUrl(candidate.id)
        : (resumeUrlOverride ?? ""),
    },
    notes: (candidate.notes ?? []) as {
      id: string;
      content: string;
      author: string;
      createdAt: string;
    }[],
    activities: activityRows.map((activity) => ({
      id: activity.id,
      userName: activity.actorName,
      userAvatar: activity.userAvatar ?? "",
      action: activity.action,
      targetName: activity.targetName,
      targetStatus: activity.targetStatus,
      timeAgo: formatCandidateActivityTime(
        activity.createdAt ? new Date(activity.createdAt) : new Date(),
      ),
    })),
  };
}

export const candidatesRouter = createTRPCRouter({
  hasCandidates: protectedProcedure.query(async ({ ctx }) => {
    const userCompanyId = await getUserCompanyId(ctx.db, ctx.session?.user?.id);

    if (!userCompanyId) {
      return false;
    }

    const rows = await ctx.db
      .select({ id: candidates.id })
      .from(candidates)
      .where(eq(candidates.companyId, userCompanyId))
      .limit(1);

    return rows.length > 0;
  }),

  uploadResume: protectedProcedure
    .input(
      z.object({
        candidateId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        mimeType: z.string().max(255).optional().default(""),
        fileBase64: z.string().min(1),
        previousResumeFileId: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

      let resumeFileId: string;
      try {
        const userCompanyId = await requireCurrentUserCompanyId(
          ctx.db,
          ctx.session?.user?.id,
        );

        // Validate candidate id and upload to Directus Storage
        getCandidateResumeStorageKey(input.candidateId);
        const [candidate] = await ctx.db
          .select({ resumeFileId: candidates.resumeFileId })
          .from(candidates)
          .where(
            and(
              eq(candidates.id, input.candidateId),
              eq(candidates.companyId, userCompanyId),
            ),
          )
          .limit(1);

        if (!candidate) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Кандидат не найден",
          });
        }

        const uploadResult = await uploadCandidateResumeToStorage(
          input.candidateId,
          fileBuffer,
          candidate.resumeFileId ?? input.previousResumeFileId ?? null,
          input.mimeType || "application/pdf",
        );
        resumeFileId = uploadResult.fileId;
      } catch (error) {
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
          resumeFileId,
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
        resumeFileId,
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
          period: candidatePeriodSchema.optional().default("week"),
          search: z.string().max(255).optional(),
          statuses: z.array(z.string().max(50)).optional(),
          city: z.string().max(255).optional(),
          sources: z.array(z.string().max(255)).optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const period = input?.period ?? "week";
      const search = input?.search?.trim();
      const shouldApplyPeriod = !search;
      const statuses = input?.statuses?.filter(Boolean) ?? [];
      const city = input?.city?.trim();
      const sources = input?.sources?.filter(Boolean) ?? [];
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const createdAtCutoff = getCandidateCreatedAtCutoff(period);

      const userCompanyId = await getUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      if (!userCompanyId) {
        return { items: [], total: 0 };
      }

      const conditions = [];
      conditions.push(eq(candidates.companyId, userCompanyId));
      if (shouldApplyPeriod) {
        conditions.push(gte(candidates.createdAt, createdAtCutoff));
      }
      if (search) {
        conditions.push(ilike(candidates.fullName, `%${escapeLike(search)}%`));
      }
      if (statuses.length > 0) {
        conditions.push(inArray(candidates.status, statuses));
      }
      if (city) {
        conditions.push(eq(candidates.city, city));
      }
      if (sources.length > 0) {
        conditions.push(inArray(candidates.source, sources));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, totalRows] = await Promise.all([
        ctx.db
          .select()
          .from(candidates)
          .where(whereClause)
          .orderBy(desc(candidates.createdAt))
          .limit(limit)
          .offset(offset),
        ctx.db.select({ total: count() }).from(candidates).where(whereClause),
      ]);

      return {
        items: rows.map((c) => {
          const parts = c.fullName.split(" ");
          return {
            id: c.id,
            name: parts.slice(0, 2).join(" "),
            patronymic: parts.slice(2).join(" "),
            city: c.city ?? "",
            status: (c.status ?? "new") as CandidateStatus,
            createdAt: c.createdAt
              ? new Date(c.createdAt).toLocaleDateString("ru-RU", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })
              : "",
            createdAtValue: c.createdAt
              ? new Date(c.createdAt).toISOString()
              : "",
            source: c.source ?? "",
          };
        }),
        total: totalRows[0]?.total ?? 0,
      };
    }),

  getHhCandidates: protectedProcedure
    .input(
      z
        .object({
          search: z.string().max(255).optional(),
          statuses: z.array(z.string().max(50)).optional(),
          city: z.string().max(255).optional(),
          sources: z.array(z.string().max(255)).optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const userCompanyId = await getUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );
      const search = input?.search?.trim().toLowerCase() ?? "";
      const statuses = input?.statuses?.filter(Boolean) ?? [];
      const city = input?.city?.trim();
      const sources = input?.sources?.filter(Boolean) ?? [];
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      if (
        !userCompanyId ||
        userCompanyId !== DEFAULT_COMPANY_ID ||
        !isHhConfigured()
      ) {
        return { items: [], total: 0 };
      }

      if (sources.length > 0 && !sources.includes("hh.uz")) {
        return { items: [], total: 0 };
      }

      if (statuses.length > 0 && !statuses.includes("new")) {
        return { items: [], total: 0 };
      }

      if (city) {
        return { items: [], total: 0 };
      }

      const hhAccountRows = await ctx.db
        .select({
          id: companyHhAccounts.id,
          accessToken: companyHhAccounts.accessToken,
          refreshToken: companyHhAccounts.refreshToken,
          employerId: companyHhAccounts.employerId,
        })
        .from(companyHhAccounts)
        .where(eq(companyHhAccounts.companyId, userCompanyId))
        .limit(1);

      const hhAccount = hhAccountRows[0];
      if (!hhAccount || (!hhAccount.accessToken && !hhAccount.refreshToken)) {
        return { items: [], total: 0 };
      }

      let accessToken = hhAccount.accessToken ?? undefined;
      const refreshToken = hhAccount.refreshToken ?? undefined;
      const employerId = hhAccount.employerId?.trim();

      if (!accessToken && refreshToken && hhAccount.id) {
        try {
          const refreshed = await refreshHhAccessToken(refreshToken);
          accessToken = refreshed.accessToken;
          await ctx.db
            .update(companyHhAccounts)
            .set({
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
            })
            .where(eq(companyHhAccounts.id, hhAccount.id));
        } catch (error) {
          console.error("Failed to refresh HH token for candidates list", {
            error,
          });
        }
      }

      if (!accessToken || !employerId) {
        return { items: [], total: 0 };
      }

      try {
        const hhVacancies = await fetchCompanyHhVacancies(
          employerId,
          accessToken,
        );
        const importedHhCandidateRows = await ctx.db
          .select({ id: candidates.id })
          .from(candidates)
          .where(
            and(
              eq(candidates.companyId, userCompanyId),
              eq(candidates.source, "hh.uz"),
            ),
          );
        const importedHhCandidateIds = new Set(
          importedHhCandidateRows.map((candidate) => candidate.id),
        );

        const mapApplicantToCandidate = (applicant: HhVacancyApplicant) => {
          const parts = applicant.fullName.split(" ");
          return {
            id: `hh_${applicant.id}`,
            name: parts.slice(0, 2).join(" "),
            patronymic: parts.slice(2).join(" "),
            city: "",
            status: "new" as CandidateStatus,
            createdAt: "",
            createdAtValue: "",
            source: "hh.uz",
          };
        };

        if (search) {
          const applicantsById = new Map<string, HhVacancyApplicant>();

          for (const vacancy of hhVacancies) {
            const applicants = await fetchHhVacancyApplicants(
              vacancy.id,
              accessToken,
            );

            for (const applicant of applicants) {
              const candidateId = `hh_${applicant.id}`;
              if (
                applicantsById.has(applicant.id) ||
                importedHhCandidateIds.has(candidateId)
              ) {
                continue;
              }

              const normalizedName = applicant.fullName.toLowerCase();
              if (!normalizedName.includes(search)) {
                continue;
              }

              applicantsById.set(applicant.id, applicant);
            }
          }

          const items = [...applicantsById.values()]
            .slice(offset, offset + limit)
            .map(mapApplicantToCandidate);

          return {
            items,
            total: applicantsById.size,
          };
        }

        const items: Array<{
          id: string;
          name: string;
          patronymic: string;
          city: string;
          status: CandidateStatus;
          createdAt: string;
          createdAtValue: string;
          source: string;
        }> = [];
        const seenApplicantIds = new Set<string>();
        let skipped = 0;
        let hasMore = false;

        outer: for (const vacancy of hhVacancies) {
          if (vacancy.responses <= 0) {
            continue;
          }

          for await (const batch of iterateHhVacancyApplicantBatches({
            accessToken,
            vacancyId: vacancy.id,
          })) {
            for (const applicant of batch) {
              const candidateId = `hh_${applicant.id}`;

              if (
                seenApplicantIds.has(candidateId) ||
                importedHhCandidateIds.has(candidateId)
              ) {
                continue;
              }

              seenApplicantIds.add(candidateId);

              if (skipped < offset) {
                skipped += 1;
                continue;
              }

              if (items.length < limit) {
                items.push(mapApplicantToCandidate(applicant));
                continue;
              }

              hasMore = true;
              break outer;
            }
          }
        }

        const hhResponsesEstimate = hhVacancies.reduce(
          (total, vacancy) => total + Math.max(vacancy.responses, 0),
          0,
        );
        const total = Math.max(
          0,
          Math.max(
            hhResponsesEstimate - importedHhCandidateIds.size,
            offset + items.length + (hasMore ? 1 : 0),
          ),
        );

        return {
          items,
          total,
        };
      } catch (error) {
        console.error("Failed to fetch hh.uz applicants for candidates list", {
          error,
        });
        return { items: [], total: 0 };
      }
    }),

  getCandidateById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const userCompanyId = await getUserCompanyId(ctx.db, ctx.session.user.id);
      if (!userCompanyId) {
        return null;
      }

      const storedCandidate = await getStoredCandidateRecord(
        ctx.db,
        userCompanyId,
        input.id,
      );

      if (input.id.startsWith("hh_")) {
        const resumeId = input.id.slice(3);

        const hhAccountRows = await ctx.db
          .select({
            id: companyHhAccounts.id,
            accessToken: companyHhAccounts.accessToken,
            refreshToken: companyHhAccounts.refreshToken,
          })
          .from(companyHhAccounts)
          .where(eq(companyHhAccounts.companyId, userCompanyId))
          .limit(1);

        const hhAccount = hhAccountRows[0];
        let accessToken = hhAccount?.accessToken ?? undefined;
        const refreshToken = hhAccount?.refreshToken ?? undefined;

        if (!accessToken && refreshToken && isHhConfigured() && hhAccount?.id) {
          try {
            const refreshed = await refreshHhAccessToken(refreshToken);
            accessToken = refreshed.accessToken;
            await ctx.db
              .update(companyHhAccounts)
              .set({
                accessToken: refreshed.accessToken,
                refreshToken: refreshed.refreshToken,
              })
              .where(eq(companyHhAccounts.id, hhAccount.id));
          } catch (error) {
            console.error("Failed to refresh HH token for candidate fetch", {
              error,
            });
          }
        }

        if (!accessToken) {
          return storedCandidate
            ? buildCandidateDetailResponse({
                db: ctx.db,
                companyId: userCompanyId,
                candidate: storedCandidate,
              })
            : null;
        }

        try {
          const hhCandidate = await fetchHhResumeById(resumeId, accessToken);
          let aiAnalysis = storedCandidate?.aiAnalysis?.trim() ?? "";

          if (!aiAnalysis) {
            const aiAnalysisResult = await generateCandidateAiAnalysis({
              resumeText: formatHhCandidateForAiAnalysis(hhCandidate),
              sourceLabel: "резюме hh.uz",
            });

            if (aiAnalysisResult.status === "success") {
              aiAnalysis = aiAnalysisResult.text;
            }
          }

          const importedCandidate = {
            id: input.id,
            fullName: hhCandidate.fullName,
            city: hhCandidate.city || null,
            salaryExpectation:
              hhCandidate.salaryExpectation > 0
                ? hhCandidate.salaryExpectation
                : null,
            salaryCurrency: hhCandidate.salaryCurrency,
            currentPosition: hhCandidate.currentPosition || null,
            source: "hh.uz",
            status: storedCandidate?.status ?? "new",
            resumeFileId: storedCandidate?.resumeFileId ?? null,
            resumeFileName: storedCandidate?.resumeFileName ?? null,
            resumeFileSize: storedCandidate?.resumeFileSize ?? null,
            experience: hhCandidate.experience || null,
            matchScore: storedCandidate?.matchScore ?? null,
            aiAnalysis: aiAnalysis || null,
            contacts: toStoredCandidateContacts(hhCandidate),
            skills: hhCandidate.skills,
            languages: hhCandidate.languages,
            tags: storedCandidate?.tags ?? [],
            workExperience: hhCandidate.workExperience,
            education: hhCandidate.education,
            notes: storedCandidate?.notes ?? [],
            activities: storedCandidate?.activities ?? [],
            companyId: userCompanyId,
          };
          const { id, ...set } = importedCandidate;

          await ctx.db
            .insert(candidates)
            .values(importedCandidate)
            .onConflictDoUpdate({
              target: candidates.id,
              set,
            });

          const persistedCandidate = await getStoredCandidateRecord(
            ctx.db,
            userCompanyId,
            input.id,
          );

          if (!persistedCandidate) {
            return null;
          }

          return buildCandidateDetailResponse({
            db: ctx.db,
            companyId: userCompanyId,
            candidate: persistedCandidate,
            resumeNameOverride: "Резюме на hh.uz",
            resumeUrlOverride: hhCandidate.resumeUrl,
          });
        } catch (error) {
          console.error("Failed to fetch HH resume for candidate page", {
            resumeId,
            companyId: userCompanyId,
            error,
          });
          return storedCandidate
            ? buildCandidateDetailResponse({
                db: ctx.db,
                companyId: userCompanyId,
                candidate: storedCandidate,
              })
            : null;
        }
      }

      if (!storedCandidate) {
        return null;
      }

      return buildCandidateDetailResponse({
        db: ctx.db,
        companyId: userCompanyId,
        candidate: storedCandidate,
      });
    }),

  addCandidateNote: protectedProcedure
    .input(
      z.object({
        candidateId: z.string().min(1).max(255),
        content: z
          .string()
          .trim()
          .min(1, "Текст заметки обязателен")
          .max(2000, "Заметка не должна превышать 2000 символов"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userCompanyId = await requireCurrentUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      const candidateRows = await ctx.db
        .select({
          id: candidates.id,
          fullName: candidates.fullName,
          companyId: candidates.companyId,
          notes: candidates.notes,
        })
        .from(candidates)
        .where(
          and(
            eq(candidates.id, input.candidateId),
            eq(candidates.companyId, userCompanyId),
          ),
        )
        .limit(1);

      const candidate = candidateRows[0];
      if (!candidate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Кандидат не найден",
        });
      }

      const authorName =
        ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";
      const newNote = {
        id: crypto.randomUUID(),
        content: input.content,
        author: authorName,
        createdAt: new Date().toISOString(),
      };
      const existingNotes = (candidate.notes ?? []) as {
        id: string;
        content: string;
        author: string;
        createdAt: string;
      }[];
      const updatedNotes = [newNote, ...existingNotes];

      await ctx.db
        .update(candidates)
        .set({
          notes: updatedNotes,
        })
        .where(
          and(
            eq(candidates.id, input.candidateId),
            eq(candidates.companyId, userCompanyId),
          ),
        );

      try {
        await ctx.db.insert(recentActivityLogs).values({
          entityType: "candidate",
          entityId: input.candidateId,
          companyId: userCompanyId,
          actorUserId: ctx.session?.user?.id ?? null,
          actorName: authorName,
          action: "Сохранил(а) заметку",
          targetName: candidate.fullName,
          targetStatus: buildActivityStatusPreview(input.content),
        });
      } catch (error) {
        console.error(
          "Failed to write recent activity log for candidate note",
          error,
        );
      }

      return newNote;
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
        workExperience: z
          .array(
            z.object({
              company: z.string().min(1).max(255),
              position: z.string().min(1).max(255),
              period: z.string().min(1).max(255),
              isCurrent: z.boolean().optional(),
              description: z
                .array(z.string().min(1).max(1000))
                .max(20)
                .default([]),
            }),
          )
          .max(20)
          .default([]),
        education: z
          .array(
            z.object({
              institution: z.string().min(1).max(255),
              gpa: z.string().min(1).max(50),
              period: z.string().min(1).max(255),
              isCurrent: z.boolean().optional(),
            }),
          )
          .max(20)
          .default([]),
        status: z.string().max(50).default("new"),
        aiAnalysis: z.string().max(5000).optional(),
        resumeFileId: z.string().max(255).optional(),
        resumeFileName: z.string().max(255).optional(),
        resumeFileSize: z.string().max(50).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
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

      const companyId = await requireCurrentUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

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
            aiAnalysis: input.aiAnalysis?.trim() || null,
            resumeFileId: input.resumeFileId ?? null,
            resumeFileName: input.resumeFileName ?? null,
            resumeFileSize: input.resumeFileSize ?? null,
            companyId,
          })
          .returning();

        const insertedCandidate = newCandidate[0];
        if (!insertedCandidate) {
          return null;
        }

        return insertedCandidate;
      });

      if (!created) {
        return null;
      }

      const actorName =
        ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";

      try {
        await ctx.db.insert(recentActivityLogs).values({
          entityType: "candidate",
          entityId: created.id,
          companyId,
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
      const userCompanyId = await requireCurrentUserCompanyId(
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

      try {
        await ctx.db.insert(recentActivityLogs).values({
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
      } catch (error) {
        console.error(
          "Failed to write recent activity log for candidate",
          error,
        );
      }

      return updated;
    }),
});
