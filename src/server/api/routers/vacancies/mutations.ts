import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import {
  createVacancyPublicationSchema,
  deleteVacancyPublicationSchema,
  updateVacancyPublicationSchema,
} from "~/schemas/vacancy-publication";
import { writeRecentActivityLog } from "~/server/activity/recent-activity";
import {
  getOptionalCompanyId,
  getRequiredCompanyId,
} from "~/server/api/router-utils/company";
import { protectedProcedure } from "~/server/api/trpc";
import {
  companyTelegramChannels,
  vacancies,
  vacancyPublications,
} from "~/server/db/schema";
import {
  archiveHhVacancy,
  fetchHhVacancyById,
  prolongHhVacancy,
  updateHhVacancyContent,
} from "~/server/services/hh";
import { resolveCompanyHhAuth } from "~/server/services/hh-company-account";
import {
  isTelegramConfigured,
  sendTelegramMessage,
} from "~/server/services/telegram";
import { formatTelegramVacancy } from "~/utils/format-telegram-vacancy";
import { generateVacancyKeyword } from "~/utils/generate-vacancy-keyword";

import { vacancyCreateInputSchema, vacancyUpdateInputSchema } from "./schemas";
import {
  formatVacancy,
  formatVacancyPublication,
  isHhVacancyId,
  type SalaryCurrency,
} from "./shared";

export const createVacancyProcedure = protectedProcedure
  .input(vacancyCreateInputSchema)
  .mutation(async ({ ctx, input }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session?.user?.id);

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
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create vacancy",
      });
    }

    const actorName =
      ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";

    await writeRecentActivityLog(ctx.db, {
      entityType: "vacancy",
      entityId: created.id,
      companyId,
      actorUserId: ctx.session?.user?.id ?? null,
      actorName,
      action: "Создал(а) вакансию",
      targetName: created.title,
      targetStatus: "Создана",
    });

    return formatVacancy(created);
  });

export const updateVacancyProcedure = protectedProcedure
  .input(vacancyUpdateInputSchema)
  .mutation(async ({ ctx, input }) => {
    const userCompanyId = await getRequiredCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    if (isHhVacancyId(input.id)) {
      const hhVacancyId = input.id.slice(3);
      const hhAccount = await resolveCompanyHhAuth(ctx.db, userCompanyId);

      if (!hhAccount?.accessToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "hh.uz аккаунт не подключён",
        });
      }

      const errors: string[] = [];
      const contentFields: Parameters<typeof updateHhVacancyContent>[2] = {};
      if (input.title !== undefined) contentFields.name = input.title;
      if (input.tasks !== undefined) contentFields.description = input.tasks;
      if (input.salaryExpectation !== undefined) {
        contentFields.salaryFrom = input.salaryExpectation;
      }
      if (input.salaryCurrency !== undefined) {
        contentFields.salaryCurrency = input.salaryCurrency;
      }

      if (Object.keys(contentFields).length > 0) {
        try {
          await updateHhVacancyContent(
            hhVacancyId,
            hhAccount.accessToken,
            contentFields,
          );
        } catch (error) {
          errors.push(
            `Не удалось обновить вакансию: ${error instanceof Error ? error.message : "ошибка"}`,
          );
        }
      }

      if (input.status !== undefined) {
        if (input.status === "archive" && hhAccount.employerId) {
          try {
            await archiveHhVacancy(
              hhVacancyId,
              hhAccount.employerId,
              hhAccount.accessToken,
            );
          } catch (error) {
            errors.push(
              `Не удалось архивировать: ${error instanceof Error ? error.message : "ошибка"}`,
            );
          }
        } else if (input.status === "active") {
          try {
            await prolongHhVacancy(hhVacancyId, hhAccount.accessToken);
          } catch (error) {
            errors.push(
              `Не удалось активировать: ${error instanceof Error ? error.message : "ошибка"}`,
            );
          }
        }
      }

      if (errors.length > 0) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: errors.join("; "),
        });
      }

      const updated = await fetchHhVacancyById(
        hhVacancyId,
        hhAccount.accessToken,
      );
      return {
        id: input.id,
        title: updated.title,
        level: updated.level ?? "",
        status: updated.status,
        city: updated.city ?? "",
        responses: updated.responses,
        workType: updated.workType ?? "",
        salaryExpectation: updated.salaryExpectation,
        salaryCurrency: updated.salaryCurrency ?? "UZS",
        workScheduleStart: "09:00",
        workScheduleEnd: "18:00",
        comments: "",
        tasks: updated.tasks ?? "",
        team: "",
        companyDescription: "",
        companyId: userCompanyId,
        publishedAt: updated.publishedAt,
        source: "hh.uz" as const,
        externalUrl: updated.externalUrl,
      };
    }

    const rows = await ctx.db
      .select()
      .from(vacancies)
      .where(
        and(eq(vacancies.id, input.id), eq(vacancies.companyId, userCompanyId)),
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

    if (input.title && input.title !== existing.title)
      valuesToUpdate.title = input.title;
    if (input.level !== undefined && input.level !== (existing.level ?? ""))
      valuesToUpdate.level = input.level || null;
    if (input.status && input.status !== (existing.status ?? "active"))
      valuesToUpdate.status = input.status;
    if (input.city !== undefined && input.city !== (existing.city ?? ""))
      valuesToUpdate.city = input.city || null;
    if (
      input.responses !== undefined &&
      input.responses !== (existing.responses ?? 0)
    )
      valuesToUpdate.responses = input.responses;
    if (
      input.workType !== undefined &&
      input.workType !== (existing.workType ?? "")
    )
      valuesToUpdate.workType = input.workType || null;
    if (
      input.salaryExpectation !== undefined &&
      input.salaryExpectation !== existing.salaryExpectation
    )
      valuesToUpdate.salaryExpectation = input.salaryExpectation;
    if (
      input.salaryCurrency !== undefined &&
      input.salaryCurrency !== (existing.salaryCurrency ?? "UZS")
    )
      valuesToUpdate.salaryCurrency = input.salaryCurrency;
    if (
      input.workScheduleStart !== undefined &&
      input.workScheduleStart !== (existing.workScheduleStart ?? "")
    )
      valuesToUpdate.workScheduleStart = input.workScheduleStart || null;
    if (
      input.workScheduleEnd !== undefined &&
      input.workScheduleEnd !== (existing.workScheduleEnd ?? "")
    )
      valuesToUpdate.workScheduleEnd = input.workScheduleEnd || null;
    if (
      input.comments !== undefined &&
      input.comments !== (existing.comments ?? "")
    )
      valuesToUpdate.comments = input.comments || null;
    if (input.tasks !== undefined && input.tasks !== (existing.tasks ?? ""))
      valuesToUpdate.tasks = input.tasks || null;
    if (input.team !== undefined && input.team !== (existing.team ?? ""))
      valuesToUpdate.team = input.team || null;
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
        and(eq(vacancies.id, input.id), eq(vacancies.companyId, userCompanyId)),
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

    await writeRecentActivityLog(ctx.db, {
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

    return formatVacancy(updated);
  });

export const createVacancyPublicationProcedure = protectedProcedure
  .input(createVacancyPublicationSchema)
  .mutation(async ({ ctx, input }) => {
    const userCompanyId = await getRequiredCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    const vacancyRows = await ctx.db
      .select({ id: vacancies.id })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.id, input.vacancyId),
          eq(vacancies.companyId, userCompanyId),
        ),
      )
      .limit(1);

    if (!vacancyRows[0]) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Вакансия не найдена",
      });
    }

    const createdRows = await ctx.db
      .insert(vacancyPublications)
      .values({
        vacancyId: input.vacancyId,
        name: input.name,
        description: input.description,
        isActive: input.isActive,
        sources: input.sources,
      })
      .returning();

    const created = createdRows[0];
    if (!created) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Не удалось создать публикацию",
      });
    }

    return formatVacancyPublication(created);
  });

export const updateVacancyPublicationProcedure = protectedProcedure
  .input(updateVacancyPublicationSchema)
  .mutation(async ({ ctx, input }) => {
    const userCompanyId = await getRequiredCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    const rows = await ctx.db
      .select({
        id: vacancyPublications.id,
        vacancyId: vacancyPublications.vacancyId,
        name: vacancyPublications.name,
        description: vacancyPublications.description,
        isActive: vacancyPublications.isActive,
        sources: vacancyPublications.sources,
        createdAt: vacancyPublications.createdAt,
        updatedAt: vacancyPublications.updatedAt,
      })
      .from(vacancyPublications)
      .innerJoin(vacancies, eq(vacancyPublications.vacancyId, vacancies.id))
      .where(
        and(
          eq(vacancyPublications.id, input.id),
          eq(vacancies.companyId, userCompanyId),
        ),
      )
      .limit(1);

    const existing = rows[0];
    if (!existing) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Публикация не найдена",
      });
    }

    const valuesToUpdate: Partial<{
      name: string;
      description: string;
      isActive: boolean;
      sources: NonNullable<typeof vacancyPublications.$inferInsert.sources>;
      updatedAt: Date;
    }> = {};

    if (input.name !== undefined && input.name !== existing.name) {
      valuesToUpdate.name = input.name;
    }
    if (
      input.description !== undefined &&
      input.description !== existing.description
    ) {
      valuesToUpdate.description = input.description;
    }
    if (input.isActive !== undefined && input.isActive !== existing.isActive) {
      valuesToUpdate.isActive = input.isActive;
    }
    if (input.sources !== undefined) {
      valuesToUpdate.sources = input.sources;
    }

    if (Object.keys(valuesToUpdate).length === 0) {
      return formatVacancyPublication(existing);
    }

    valuesToUpdate.updatedAt = new Date();

    const updatedRows = await ctx.db
      .update(vacancyPublications)
      .set(valuesToUpdate)
      .where(eq(vacancyPublications.id, input.id))
      .returning();

    const updated = updatedRows[0];
    if (!updated) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Не удалось обновить публикацию",
      });
    }

    return formatVacancyPublication(updated);
  });

export const deleteVacancyPublicationProcedure = protectedProcedure
  .input(deleteVacancyPublicationSchema)
  .mutation(async ({ ctx, input }) => {
    const userCompanyId = await getRequiredCompanyId(
      ctx.db,
      ctx.session?.user?.id,
    );

    const rows = await ctx.db
      .select({ id: vacancyPublications.id })
      .from(vacancyPublications)
      .innerJoin(vacancies, eq(vacancyPublications.vacancyId, vacancies.id))
      .where(
        and(
          eq(vacancyPublications.id, input.id),
          eq(vacancies.companyId, userCompanyId),
        ),
      )
      .limit(1);

    if (!rows[0]) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Публикация не найдена",
      });
    }

    await ctx.db
      .delete(vacancyPublications)
      .where(eq(vacancyPublications.id, input.id));

    return { success: true };
  });

export const getTelegramConfigProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    if (!isTelegramConfigured()) {
      return { enabled: false };
    }

    const companyId = await getOptionalCompanyId(ctx.db, ctx.session?.user?.id);
    if (!companyId) {
      return { enabled: false };
    }

    const channels = await ctx.db
      .select({ id: companyTelegramChannels.id })
      .from(companyTelegramChannels)
      .where(eq(companyTelegramChannels.companyId, companyId))
      .limit(1);

    return { enabled: channels.length > 0 };
  },
);

export const publishTelegramProcedure = protectedProcedure
  .input(z.object({ vacancyId: z.string().min(1).max(255) }))
  .mutation(async ({ ctx, input }) => {
    if (!isTelegramConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Telegram не настроен",
      });
    }

    const companyId = await getRequiredCompanyId(ctx.db, ctx.session?.user?.id);
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
    const message = formatTelegramVacancy(formatVacancy(vacancy), keyword);

    const errors: string[] = [];
    for (const channel of channels) {
      try {
        await sendTelegramMessage(message, channel.channelId);
      } catch (error) {
        errors.push(
          `Канал ${channel.channelId}: ${error instanceof Error ? error.message : "Неизвестная ошибка"}`,
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
  });
