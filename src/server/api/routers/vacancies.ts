import { and, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import {
  companyHhAccounts,
  companyTelegramChannels,
  recentActivityLogs,
  users,
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
    id: `hh:${vacancy.id}`,
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
  return value.startsWith("hh:") || value.startsWith("hh__");
}

function normalizeHhVacancyId(value: string): string {
  if (value.startsWith("hh__")) {
    return `hh:${value.slice(4)}`;
  }

  return value;
}

export const vacanciesRouter = createTRPCRouter({
  getAllVacancies: protectedProcedure
    .input(
      z
        .object({
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const limit = input?.limit ?? 50;
      const offset = input?.offset ?? 0;

      let userCompanyId: string | null = null;
      if (ctx.session?.user?.id) {
        const userRows = await ctx.db
          .select({ companyId: users.companyId })
          .from(users)
          .where(eq(users.id, ctx.session.user.id))
          .limit(1);
        userCompanyId = userRows[0]?.companyId ?? null;
      }

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(
          userCompanyId ? eq(vacancies.companyId, userCompanyId) : undefined,
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
        console.info("[hh.uz] skipping vacancy sync because employerId is missing", {
          companyId: userCompanyId,
          localVacancies: localVacancies.length,
        });
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
        ];
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

      if (isHhVacancyId(normalizedId)) {
        const hhVacancyId = normalizedId.slice(3);

        let userCompanyId: string | null = null;
        if (ctx.session?.user?.id) {
          const userRows = await ctx.db
            .select({ companyId: users.companyId })
            .from(users)
            .where(eq(users.id, ctx.session.user.id))
            .limit(1);
          userCompanyId = userRows[0]?.companyId ?? null;
        }

        let accessToken: string | undefined;
        if (userCompanyId) {
          const hhAccountRows = await ctx.db
            .select({
              accessToken: companyHhAccounts.accessToken,
            })
            .from(companyHhAccounts)
            .where(eq(companyHhAccounts.companyId, userCompanyId))
            .limit(1);
          accessToken = hhAccountRows[0]?.accessToken ?? undefined;
        }

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
        .where(eq(vacancies.id, normalizedId))
        .limit(1);

      const vacancy = rows[0];
      if (!vacancy) {
        return null;
      }

      return formatVacancy(vacancy);
    }),

  searchVacancies: protectedProcedure
    .input(z.object({ query: z.string().max(255) }))
    .query(async ({ ctx, input }) => {
      const search = input.query.trim();

      let userCompanyId: string | null = null;
      if (ctx.session?.user?.id) {
        const userRows = await ctx.db
          .select({ companyId: users.companyId })
          .from(users)
          .where(eq(users.id, ctx.session.user.id))
          .limit(1);
        userCompanyId = userRows[0]?.companyId ?? null;
      }

      const conditions = [];
      if (userCompanyId) {
        conditions.push(eq(vacancies.companyId, userCompanyId));
      }
      if (search) {
        conditions.push(ilike(vacancies.title, `%${escapeLike(search)}%`));
      }

      const rows = search
        ? await ctx.db
            .select()
            .from(vacancies)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .limit(50)
        : await ctx.db
            .select()
            .from(vacancies)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .limit(50);

      return rows.map(formatVacancy);
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
      // Get the user's companyId
      let companyId: string | null = null;
      if (ctx.session?.user?.id) {
        const userRows = await ctx.db
          .select({ companyId: users.companyId })
          .from(users)
          .where(eq(users.id, ctx.session.user.id))
          .limit(1);
        companyId = userRows[0]?.companyId ?? null;
      }

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
      const { TRPCError } = await import("@trpc/server");

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(eq(vacancies.id, input.id))
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
        .where(eq(vacancies.id, input.id))
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
    let companyId: string | null = null;
    if (ctx.session?.user?.id) {
      const userRows = await ctx.db
        .select({ companyId: users.companyId })
        .from(users)
        .where(eq(users.id, ctx.session.user.id))
        .limit(1);
      companyId = userRows[0]?.companyId ?? null;
    }

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
      const { TRPCError } = await import("@trpc/server");

      if (!isTelegramConfigured()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Telegram не настроен",
        });
      }

      const rows = await ctx.db
        .select()
        .from(vacancies)
        .where(eq(vacancies.id, input.vacancyId))
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

      // Fetch all Telegram channels for this company
      const channels = await ctx.db
        .select()
        .from(companyTelegramChannels)
        .where(eq(companyTelegramChannels.companyId, vacancy.companyId));

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
});
