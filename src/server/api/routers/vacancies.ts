import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, gte, ilike } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  candidates,
  candidateVacancies,
  companyHhAccounts,
  companyTelegramChannels,
  recentActivityLogs,
  vacancies,
} from "~/server/db/schema";
import {
  fetchCompanyHhVacancies,
  fetchHhVacancyById,
  isHhConfigured,
  refreshHhAccessToken,
  resolveHhEmployerFromAccessToken,
} from "~/server/services/hh";
import {
  isTelegramConfigured,
  sendTelegramMessage,
} from "~/server/services/telegram";
import { getUserCompanyId } from "~/server/utils/get-user-company-id";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";
import { formatTelegramVacancy } from "~/utils/format-telegram-vacancy";
import { generateVacancyKeyword } from "~/utils/generate-vacancy-keyword";

function escapeLike(value: string) {
  return value.replace(/[%_\\]/g, "\\$&");
}

type VacancyStatus = "active" | "draft" | "paused" | "closed" | "archive";
type SalaryCurrency = "UZS" | "USD";

function toVacancyStatus(value: string | null): VacancyStatus {
  switch (value) {
    case "active":
    case "draft":
    case "paused":
    case "closed":
    case "archive":
      return value;
    default:
      return "active";
  }
}

async function getVacancyRelatedCandidates(
  db: typeof import("~/server/db").db,
  vacancyId: string,
  companyId: string,
) {
  return db
    .select({
      id: candidates.id,
      fullName: candidates.fullName,
      status: candidates.status,
    })
    .from(candidateVacancies)
    .innerJoin(candidates, eq(candidateVacancies.candidateId, candidates.id))
    .where(
      and(
        eq(candidateVacancies.vacancyId, vacancyId),
        eq(candidates.companyId, companyId),
      ),
    )
    .orderBy(desc(candidateVacancies.createdAt));
}

function toSalaryCurrency(value: string | null): SalaryCurrency {
  return value === "USD" ? "USD" : "UZS";
}

function formatVacancy(vacancy: typeof vacancies.$inferSelect) {
  return {
    id: vacancy.id,
    title: vacancy.title,
    level: vacancy.level ?? "",
    status: toVacancyStatus(vacancy.status),
    city: vacancy.city ?? "",
    responses: vacancy.responses ?? 0,
    workType: vacancy.workType ?? "",
    salaryExpectation: vacancy.salaryExpectation ?? undefined,
    salaryCurrency: toSalaryCurrency(vacancy.salaryCurrency),
    workScheduleStart: vacancy.workScheduleStart ?? "09:00",
    workScheduleEnd: vacancy.workScheduleEnd ?? "18:00",
    comments: vacancy.comments ?? "",
    tasks: vacancy.tasks ?? "",
    team: vacancy.team ?? "",
    companyDescription: vacancy.companyDescription ?? "",
    companyId: vacancy.companyId ?? undefined,
    publishedAt: undefined,
    source: "local" as const,
    externalUrl: undefined,
  };
}

function formatHhVacancy(
  vacancy: Awaited<ReturnType<typeof fetchCompanyHhVacancies>>[number],
  companyId: string,
) {
  return {
    id: `hh_${vacancy.id}`,
    title: vacancy.title,
    level: vacancy.level,
    status: vacancy.status,
    city: vacancy.city,
    responses: vacancy.responses,
    workType: vacancy.workType,
    salaryExpectation: undefined,
    salaryCurrency: "UZS" as const,
    workScheduleStart: undefined,
    workScheduleEnd: undefined,
    comments: "",
    tasks: "",
    team: "",
    companyDescription: "",
    companyId,
    publishedAt: vacancy.publishedAt,
    source: "hh.uz" as const,
    externalUrl: vacancy.externalUrl,
  };
}

function isHhVacancyId(value: string): boolean {
  return value.startsWith("hh_");
}

function normalizeHhVacancyId(value: string): string {
  if (value.startsWith("hh_")) {
    return value;
  }

  return value;
}

const vacancyPeriodSchema = z.enum(["day", "week", "month", "year"]);

function getVacancyDateCutoff(period: z.infer<typeof vacancyPeriodSchema>) {
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

function isDateWithinPeriod(value: string | undefined, cutoff: Date) {
  if (!value) {
    return false;
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return false;
  }

  return parsedDate >= cutoff;
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

export const vacanciesRouter = createTRPCRouter({
  hasVacancies: protectedProcedure.query(async ({ ctx }) => {
    const userCompanyId = await getUserCompanyId(ctx.db, ctx.session?.user?.id);

    if (!userCompanyId) {
      return false;
    }

    const localRows = await ctx.db
      .select({ id: vacancies.id })
      .from(vacancies)
      .where(eq(vacancies.companyId, userCompanyId))
      .limit(1);

    if (localRows.length > 0) {
      return true;
    }

    if (userCompanyId !== DEFAULT_COMPANY_ID) {
      return false;
    }

    const hhAccountRows = await ctx.db
      .select({
        accessToken: companyHhAccounts.accessToken,
        employerId: companyHhAccounts.employerId,
        id: companyHhAccounts.id,
        refreshToken: companyHhAccounts.refreshToken,
      })
      .from(companyHhAccounts)
      .where(eq(companyHhAccounts.companyId, userCompanyId))
      .limit(1);

    const hhAccount = hhAccountRows[0];
    const hasHhOAuth = Boolean(
      hhAccount?.accessToken || hhAccount?.refreshToken,
    );
    if (!hasHhOAuth) {
      return false;
    }

    let employerId = hhAccount?.employerId?.trim();

    if (!employerId && hhAccount?.accessToken && isHhConfigured()) {
      try {
        const resolvedAccount = await resolveHhEmployerFromAccessToken(
          hhAccount.accessToken,
        );
        employerId = resolvedAccount.employerId;

        await ctx.db
          .update(companyHhAccounts)
          .set({
            email: resolvedAccount.email,
            employerId: resolvedAccount.employerId,
          })
          .where(eq(companyHhAccounts.id, hhAccount.id));
      } catch (_resolveError) {
        if (hhAccount.refreshToken) {
          try {
            const refreshedTokens = await refreshHhAccessToken(
              hhAccount.refreshToken,
            );
            const resolvedAccount = await resolveHhEmployerFromAccessToken(
              refreshedTokens.accessToken,
            );
            employerId = resolvedAccount.employerId;

            await ctx.db
              .update(companyHhAccounts)
              .set({
                accessToken: refreshedTokens.accessToken,
                email: resolvedAccount.email,
                employerId: resolvedAccount.employerId,
                refreshToken: refreshedTokens.refreshToken,
              })
              .where(eq(companyHhAccounts.id, hhAccount.id));
          } catch {
            return false;
          }
        } else {
          return false;
        }
      }
    }

    if (!employerId) {
      return false;
    }

    try {
      const hhVacancies = await fetchCompanyHhVacancies(employerId);
      return hhVacancies.length > 0;
    } catch {
      return false;
    }
  }),

  getAllVacancies: protectedProcedure
    .input(
      z
        .object({
          period: vacancyPeriodSchema.optional().default("week"),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const period = input?.period ?? "week";
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;
      const createdAtCutoff = getVacancyDateCutoff(period);
      const userCompanyId = await getUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      if (!userCompanyId) {
        return [];
      }

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(
          and(
            eq(vacancies.companyId, userCompanyId),
            gte(vacancies.createdAt, createdAtCutoff),
          ),
        )
        .orderBy(desc(vacancies.createdAt))
        .limit(limit)
        .offset(offset);

      const localVacancies = rows.map(formatVacancy);

      if (userCompanyId !== DEFAULT_COMPANY_ID) {
        console.info("[hh.uz] skipping vacancy sync for non-default company", {
          userCompanyId,
          defaultCompanyId: DEFAULT_COMPANY_ID,
          localVacancies: localVacancies.length,
        });
        return localVacancies;
      }

      const hhAccountRows = await ctx.db
        .select({
          accessToken: companyHhAccounts.accessToken,
          employerId: companyHhAccounts.employerId,
          id: companyHhAccounts.id,
          refreshToken: companyHhAccounts.refreshToken,
        })
        .from(companyHhAccounts)
        .where(eq(companyHhAccounts.companyId, userCompanyId))
        .limit(1);

      const hhAccount = hhAccountRows[0];
      const hasHhOAuth = Boolean(
        hhAccount?.accessToken || hhAccount?.refreshToken,
      );
      if (!hasHhOAuth) {
        console.info("[hh.uz] skipping vacancy sync because OAuth is missing", {
          companyId: userCompanyId,
          localVacancies: localVacancies.length,
        });
        return localVacancies;
      }

      let employerId = hhAccount?.employerId?.trim();

      if (!employerId && hhAccount?.accessToken && isHhConfigured()) {
        try {
          const resolvedAccount = await resolveHhEmployerFromAccessToken(
            hhAccount.accessToken,
          );
          employerId = resolvedAccount.employerId;

          await ctx.db
            .update(companyHhAccounts)
            .set({
              email: resolvedAccount.email,
              employerId: resolvedAccount.employerId,
            })
            .where(eq(companyHhAccounts.id, hhAccount.id));
        } catch (resolveError) {
          if (hhAccount.refreshToken) {
            try {
              const refreshedTokens = await refreshHhAccessToken(
                hhAccount.refreshToken,
              );
              const resolvedAccount = await resolveHhEmployerFromAccessToken(
                refreshedTokens.accessToken,
              );
              employerId = resolvedAccount.employerId;

              await ctx.db
                .update(companyHhAccounts)
                .set({
                  accessToken: refreshedTokens.accessToken,
                  email: resolvedAccount.email,
                  employerId: resolvedAccount.employerId,
                  refreshToken: refreshedTokens.refreshToken,
                })
                .where(eq(companyHhAccounts.id, hhAccount.id));
            } catch (refreshError) {
              console.error(
                "Failed to refresh HH account before vacancy sync",
                {
                  companyId: userCompanyId,
                  error: refreshError,
                },
              );
            }
          } else {
            console.error("Failed to resolve HH employer ID for company", {
              companyId: userCompanyId,
              error: resolveError,
            });
          }
        }
      }

      if (!employerId) {
        console.info(
          "[hh.uz] skipping vacancy sync because employerId is missing",
          {
            companyId: userCompanyId,
            localVacancies: localVacancies.length,
          },
        );
        return localVacancies;
      }

      try {
        const hhVacancies = await fetchCompanyHhVacancies(employerId);

        console.info("[hh.uz] merging vacancies into response", {
          companyId: userCompanyId,
          employerId,
          localVacancies: localVacancies.length,
          hhVacancies: hhVacancies.length,
        });

        return [
          ...localVacancies,
          ...hhVacancies.map((vacancy) =>
            formatHhVacancy(vacancy, userCompanyId),
          ),
        ].filter((vacancy) =>
          vacancy.source === "hh.uz"
            ? isDateWithinPeriod(vacancy.publishedAt, createdAtCutoff)
            : true,
        );
      } catch (error) {
        console.error("Failed to fetch hh.uz vacancies for company", {
          companyId: userCompanyId,
          employerId,
          error,
        });

        return localVacancies;
      }
    }),

  getVacancyById: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .query(async ({ ctx, input }) => {
      const normalizedId = normalizeHhVacancyId(input.id);
      const userCompanyId = await getUserCompanyId(ctx.db, ctx.session.user.id);

      if (!userCompanyId) {
        return null;
      }

      if (isHhVacancyId(normalizedId)) {
        const hhVacancyId = normalizedId.slice(3);

        let accessToken: string | undefined;
        const hhAccountRows = await ctx.db
          .select({
            accessToken: companyHhAccounts.accessToken,
          })
          .from(companyHhAccounts)
          .where(eq(companyHhAccounts.companyId, userCompanyId))
          .limit(1);
        accessToken = hhAccountRows[0]?.accessToken ?? undefined;

        try {
          const hhVacancy = await fetchHhVacancyById(hhVacancyId, accessToken);

          return {
            id: normalizedId,
            title: hhVacancy.title,
            level: hhVacancy.level,
            status: hhVacancy.status,
            city: hhVacancy.city,
            responses: hhVacancy.responses,
            workType: hhVacancy.workType,
            salaryExpectation: hhVacancy.salaryExpectation,
            salaryCurrency: hhVacancy.salaryCurrency ?? "UZS",
            workScheduleStart: hhVacancy.workScheduleStart,
            workScheduleEnd: hhVacancy.workScheduleEnd,
            comments: hhVacancy.comments ?? "",
            tasks: hhVacancy.tasks ?? "",
            team: hhVacancy.team ?? "",
            companyDescription: hhVacancy.companyDescription ?? "",
            companyId: userCompanyId ?? undefined,
            publishedAt: hhVacancy.publishedAt,
            source: "hh.uz" as const,
            externalUrl: hhVacancy.externalUrl,
            relatedCandidates: [] as {
              id: string;
              fullName: string;
              status: string | null;
            }[],
          };
        } catch (error) {
          console.error("Failed to fetch HH vacancy by id", {
            hhVacancyId,
            companyId: userCompanyId,
            error,
          });

          return null;
        }
      }

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, normalizedId),
            eq(vacancies.companyId, userCompanyId),
          ),
        )
        .limit(1);

      const vacancy = rows[0];
      if (!vacancy) {
        return null;
      }

      const relatedCandidateRows = await getVacancyRelatedCandidates(
        ctx.db,
        vacancy.id,
        userCompanyId,
      );

      return {
        ...formatVacancy(vacancy),
        relatedCandidates: relatedCandidateRows,
      };
    }),

  getVacancyFunnel: protectedProcedure
    .input(z.object({ id: z.string().min(1).max(255) }))
    .query(async ({ ctx, input }) => {
      const userCompanyId = await getUserCompanyId(ctx.db, ctx.session.user.id);

      if (!userCompanyId || isHhVacancyId(input.id)) {
        return null;
      }

      const rows = await ctx.db
        .select({
          id: vacancies.id,
          title: vacancies.title,
        })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, input.id),
            eq(vacancies.companyId, userCompanyId),
          ),
        )
        .limit(1);

      const vacancy = rows[0];
      if (!vacancy) {
        return null;
      }

      const candidateRows = await getVacancyRelatedCandidates(
        ctx.db,
        vacancy.id,
        userCompanyId,
      );

      return {
        id: vacancy.id,
        title: vacancy.title,
        candidates: candidateRows,
      };
    }),

  searchVacancies: protectedProcedure
    .input(
      z.object({
        query: z.string().max(255),
        limit: z.number().min(1).max(50).optional(),
        offset: z.number().min(0).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const search = input.query.trim();
      const limit = input.limit ?? 8;
      const offset = input.offset ?? 0;

      const userCompanyId = await getUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      if (!userCompanyId) {
        return {
          items: [],
          total: 0,
        };
      }

      const conditions = [];
      conditions.push(eq(vacancies.companyId, userCompanyId));
      if (search) {
        conditions.push(ilike(vacancies.title, `%${escapeLike(search)}%`));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [rows, totalRows] = await Promise.all([
        ctx.db
          .select()
          .from(vacancies)
          .where(whereClause)
          .orderBy(desc(vacancies.createdAt))
          .limit(limit)
          .offset(offset),
        ctx.db.select({ total: count() }).from(vacancies).where(whereClause),
      ]);

      return {
        items: rows.map(formatVacancy),
        total: totalRows[0]?.total ?? 0,
      };
    }),

  createVacancy: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1, "Название вакансии обязательно").max(255),
        level: z.string().max(100).optional(),
        status: z
          .enum(["active", "draft", "paused", "closed", "archive"])
          .default("active"),
        city: z.string().max(255).optional(),
        responses: z.number().int().min(0).default(0),
        workType: z.string().max(100).optional(),
        salaryExpectation: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000)
          .optional(),
        salaryCurrency: z.enum(["UZS", "USD"]).default("UZS"),
        workScheduleStart: z.string().max(10).optional(),
        workScheduleEnd: z.string().max(10).optional(),
        comments: z.string().max(4000).optional(),
        tasks: z.string().max(4000).optional(),
        team: z.string().max(4000).optional(),
        companyDescription: z.string().max(8000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const companyId = await requireCurrentUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      const createdRows = await ctx.db
        .insert(vacancies)
        .values({
          title: input.title,
          level: input.level ?? null,
          status: input.status,
          city: input.city ?? null,
          responses: input.responses,
          workType: input.workType ?? null,
          salaryExpectation: input.salaryExpectation ?? null,
          salaryCurrency: input.salaryCurrency,
          workScheduleStart: input.workScheduleStart ?? null,
          workScheduleEnd: input.workScheduleEnd ?? null,
          comments: input.comments ?? null,
          tasks: input.tasks ?? null,
          team: input.team ?? null,
          companyDescription: input.companyDescription ?? null,
          companyId,
        })
        .returning();

      const created = createdRows[0];
      if (!created) {
        const { TRPCError } = await import("@trpc/server");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create vacancy",
        });
      }

      const actorName =
        ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";

      try {
        await ctx.db.insert(recentActivityLogs).values({
          entityType: "vacancy",
          entityId: created.id,
          companyId,
          actorUserId: ctx.session?.user?.id ?? null,
          actorName,
          action: "Создал(а) вакансию",
          targetName: created.title,
          targetStatus: "Создана",
        });
      } catch (error) {
        console.error(
          "Failed to write recent activity log for vacancy creation",
          error,
        );
      }

      return formatVacancy(created);
    }),

  updateVacancy: protectedProcedure
    .input(
      z.object({
        id: z.string().min(1).max(255),
        title: z.string().min(1).max(255).optional(),
        level: z.string().max(100).optional(),
        status: z
          .enum(["active", "draft", "paused", "closed", "archive"])
          .optional(),
        city: z.string().max(255).optional(),
        responses: z.number().int().min(0).optional(),
        workType: z.string().max(100).optional(),
        salaryExpectation: z
          .number()
          .int()
          .min(0)
          .max(1_000_000_000)
          .nullable()
          .optional(),
        salaryCurrency: z.enum(["UZS", "USD"]).optional(),
        workScheduleStart: z.string().max(10).optional(),
        workScheduleEnd: z.string().max(10).optional(),
        comments: z.string().max(4000).optional(),
        tasks: z.string().max(4000).optional(),
        team: z.string().max(4000).optional(),
        companyDescription: z.string().max(8000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userCompanyId = await requireCurrentUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, input.id),
            eq(vacancies.companyId, userCompanyId),
          ),
        )
        .limit(1);

      const existing = rows[0];
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Vacancy not found",
        });
      }

      const valuesToUpdate: Partial<{
        title: string;
        level: string | null;
        status: "active" | "draft" | "paused" | "closed" | "archive";
        city: string | null;
        responses: number;
        workType: string | null;
        salaryExpectation: number | null;
        salaryCurrency: SalaryCurrency;
        workScheduleStart: string | null;
        workScheduleEnd: string | null;
        comments: string | null;
        tasks: string | null;
        team: string | null;
        companyDescription: string | null;
      }> = {};

      if (input.title && input.title !== existing.title) {
        valuesToUpdate.title = input.title;
      }

      if (input.level !== undefined && input.level !== (existing.level ?? "")) {
        valuesToUpdate.level = input.level || null;
      }

      if (input.status && input.status !== (existing.status ?? "active")) {
        valuesToUpdate.status = input.status;
      }

      if (input.city !== undefined && input.city !== (existing.city ?? "")) {
        valuesToUpdate.city = input.city || null;
      }

      if (
        input.responses !== undefined &&
        input.responses !== (existing.responses ?? 0)
      ) {
        valuesToUpdate.responses = input.responses;
      }

      if (
        input.workType !== undefined &&
        input.workType !== (existing.workType ?? "")
      ) {
        valuesToUpdate.workType = input.workType || null;
      }

      if (
        input.salaryExpectation !== undefined &&
        input.salaryExpectation !== existing.salaryExpectation
      ) {
        valuesToUpdate.salaryExpectation = input.salaryExpectation;
      }

      if (
        input.salaryCurrency !== undefined &&
        input.salaryCurrency !== toSalaryCurrency(existing.salaryCurrency)
      ) {
        valuesToUpdate.salaryCurrency = input.salaryCurrency;
      }

      if (
        input.workScheduleStart !== undefined &&
        input.workScheduleStart !== (existing.workScheduleStart ?? "")
      ) {
        valuesToUpdate.workScheduleStart = input.workScheduleStart || null;
      }

      if (
        input.workScheduleEnd !== undefined &&
        input.workScheduleEnd !== (existing.workScheduleEnd ?? "")
      ) {
        valuesToUpdate.workScheduleEnd = input.workScheduleEnd || null;
      }

      if (
        input.comments !== undefined &&
        input.comments !== (existing.comments ?? "")
      ) {
        valuesToUpdate.comments = input.comments || null;
      }

      if (input.tasks !== undefined && input.tasks !== (existing.tasks ?? "")) {
        valuesToUpdate.tasks = input.tasks || null;
      }

      if (input.team !== undefined && input.team !== (existing.team ?? "")) {
        valuesToUpdate.team = input.team || null;
      }

      if (
        input.companyDescription !== undefined &&
        input.companyDescription !== (existing.companyDescription ?? "")
      ) {
        valuesToUpdate.companyDescription = input.companyDescription || null;
      }

      if (Object.keys(valuesToUpdate).length === 0) {
        return formatVacancy(existing);
      }

      const updatedRows = await ctx.db
        .update(vacancies)
        .set(valuesToUpdate)
        .where(
          and(
            eq(vacancies.id, input.id),
            eq(vacancies.companyId, userCompanyId),
          ),
        )
        .returning();

      const updated = updatedRows[0];
      if (!updated) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update vacancy",
        });
      }

      const actorName =
        ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";
      const changedStatus = valuesToUpdate.status ?? null;

      try {
        await ctx.db.insert(recentActivityLogs).values({
          entityType: "vacancy",
          entityId: updated.id,
          companyId: userCompanyId,
          actorUserId: ctx.session?.user?.id ?? null,
          actorName,
          action: changedStatus
            ? "Изменил(а) статус вакансии"
            : "Обновил(а) вакансию",
          targetName: updated.title,
          targetStatus: changedStatus ?? "Профиль обновлен",
        });
      } catch (error) {
        console.error("Failed to write recent activity log for vacancy", error);
      }

      return formatVacancy(updated);
    }),

  isTelegramEnabled: protectedProcedure.query(async ({ ctx }) => {
    if (!isTelegramConfigured()) {
      return { enabled: false };
    }

    // Check if the user's company has at least one Telegram channel
    const companyId = await getUserCompanyId(ctx.db, ctx.session?.user?.id);

    if (!companyId) {
      return { enabled: false };
    }

    const channels = await ctx.db
      .select({ id: companyTelegramChannels.id })
      .from(companyTelegramChannels)
      .where(eq(companyTelegramChannels.companyId, companyId))
      .limit(1);

    return { enabled: channels.length > 0 };
  }),

  postVacancyToTelegram: protectedProcedure
    .input(z.object({ vacancyId: z.string().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      if (!isTelegramConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Telegram не настроен",
        });
      }

      const companyId = await requireCurrentUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, input.vacancyId),
            eq(vacancies.companyId, companyId),
          ),
        )
        .limit(1);

      const vacancy = rows[0];
      if (!vacancy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Вакансия не найдена",
        });
      }

      if (!vacancy.companyId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "У вакансии не указана компания",
        });
      }

      const channels = await ctx.db
        .select()
        .from(companyTelegramChannels)
        .where(eq(companyTelegramChannels.companyId, companyId));

      if (channels.length === 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "У компании не настроены Telegram-каналы",
        });
      }

      const keyword = generateVacancyKeyword(vacancy.id, vacancy.companyId);
      const formatted = formatVacancy(vacancy);
      const message = formatTelegramVacancy(formatted, keyword);

      // Post to all company channels
      const errors: string[] = [];
      for (const channel of channels) {
        try {
          await sendTelegramMessage(message, channel.channelId);
        } catch (err) {
          errors.push(
            `Канал ${channel.channelId}: ${err instanceof Error ? err.message : "Неизвестная ошибка"}`,
          );
        }
      }

      if (errors.length === channels.length) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Не удалось отправить ни в один канал:\n${errors.join("\n")}`,
        });
      }

      return {
        success: true,
        keyword,
        sentTo: channels.length - errors.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    }),

  linkCandidateToVacancy: protectedProcedure
    .input(
      z.object({
        candidateId: z.string().min(1).max(255),
        vacancyId: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userCompanyId = await requireCurrentUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      const [candidateRow, vacancyRow] = await Promise.all([
        ctx.db
          .select({
            id: candidates.id,
            companyId: candidates.companyId,
          })
          .from(candidates)
          .where(
            and(
              eq(candidates.id, input.candidateId),
              eq(candidates.companyId, userCompanyId),
            ),
          )
          .limit(1),
        ctx.db
          .select({
            id: vacancies.id,
            companyId: vacancies.companyId,
          })
          .from(vacancies)
          .where(
            and(
              eq(vacancies.id, input.vacancyId),
              eq(vacancies.companyId, userCompanyId),
            ),
          )
          .limit(1),
      ]);

      const candidate = candidateRow[0];
      if (!candidate) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Кандидат не найден",
        });
      }

      const vacancy = vacancyRow[0];
      if (!vacancy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Вакансия не найдена",
        });
      }

      if (!candidate.companyId || !vacancy.companyId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Кандидат или вакансия не привязаны к компании",
        });
      }

      if (candidate.companyId !== vacancy.companyId) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Кандидат и вакансия должны принадлежать одной компании",
        });
      }

      const existingLink = await ctx.db
        .select({ candidateId: candidateVacancies.candidateId })
        .from(candidateVacancies)
        .where(
          and(
            eq(candidateVacancies.candidateId, input.candidateId),
            eq(candidateVacancies.vacancyId, input.vacancyId),
          ),
        )
        .limit(1);

      if (existingLink[0]) {
        return { success: true, alreadyLinked: true };
      }

      await ctx.db.insert(candidateVacancies).values({
        candidateId: input.candidateId,
        vacancyId: input.vacancyId,
      });

      return { success: true, alreadyLinked: false };
    }),

  unlinkCandidateFromVacancy: protectedProcedure
    .input(
      z.object({
        candidateId: z.string().min(1).max(255),
        vacancyId: z.string().min(1).max(255),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userCompanyId = await requireCurrentUserCompanyId(
        ctx.db,
        ctx.session?.user?.id,
      );

      const vacancyRow = await ctx.db
        .select({
          companyId: vacancies.companyId,
        })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, input.vacancyId),
            eq(vacancies.companyId, userCompanyId),
          ),
        )
        .limit(1);

      if (!vacancyRow[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Вакансия не найдена",
        });
      }

      await ctx.db
        .delete(candidateVacancies)
        .where(
          and(
            eq(candidateVacancies.candidateId, input.candidateId),
            eq(candidateVacancies.vacancyId, input.vacancyId),
          ),
        );

      return { success: true };
    }),
});
