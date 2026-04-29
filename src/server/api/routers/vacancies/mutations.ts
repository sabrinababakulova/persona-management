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
  companies,
  companyTelegramChannels,
  vacancies,
  vacancyPublications,
} from "~/server/db/schema";
import {
  archiveHhVacancy,
  fetchHhAreasUz,
  fetchHhDictionaries,
  fetchHhProfessionalRoles,
  fetchHhVacancyById,
  prolongHhVacancy,
  publishHhVacancy,
  updateHhVacancyContent,
} from "~/server/services/hh";
import {
  getCompanyHhAccount,
  resolveCompanyHhAuth,
} from "~/server/services/hh-company-account";
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

export const getHhConfigProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const companyId = await getOptionalCompanyId(ctx.db, ctx.session?.user?.id);
    if (!companyId) {
      return { enabled: false, companyPhone: null as string | null };
    }

    const [account, companyRows] = await Promise.all([
      getCompanyHhAccount(ctx.db, companyId),
      ctx.db
        .select({ phone: companies.phone })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1),
    ]);

    return {
      enabled: Boolean(account?.accessToken || account?.refreshToken),
      companyPhone: companyRows[0]?.phone ?? null,
    };
  },
);

export const getHhPublishLookupsProcedure = protectedProcedure.query(
  async () => {
    const [dictionaries, areas, roleCategories] = await Promise.all([
      fetchHhDictionaries(),
      fetchHhAreasUz(),
      fetchHhProfessionalRoles(),
    ]);

    return {
      areas,
      employment: dictionaries.employment,
      schedule: dictionaries.schedule,
      experience: dictionaries.experience,
      billingType: dictionaries.vacancy_billing_type,
      currency: dictionaries.currency,
      professionalRoles: roleCategories.flatMap((category) =>
        category.roles.map((role) => ({
          id: role.id,
          name: `${category.name} — ${role.name}`,
        })),
      ),
    };
  },
);

const hhPhoneSchema = z
  .object({
    country: z.string().min(1).max(10),
    city: z.string().min(1).max(10),
    number: z.string().min(1).max(20),
  })
  .nullable()
  .optional();

export const publishHhProcedure = protectedProcedure
  .input(
    z.object({
      vacancyId: z.string().min(1).max(255),
      name: z.string().min(1).max(500),
      descriptionHtml: z
        .string()
        .min(200, "Описание должно быть не короче 200 символов")
        .max(20000),
      areaId: z.string().min(1).max(20),
      employmentId: z.string().min(1).max(50),
      scheduleId: z.string().min(1).max(50),
      experienceId: z.string().min(1).max(50),
      professionalRoleId: z.string().min(1).max(50),
      billingTypeId: z.string().min(1).max(50),
      salaryFrom: z.number().int().nonnegative().nullable().optional(),
      salaryTo: z.number().int().nonnegative().nullable().optional(),
      salaryCurrency: z.string().min(1).max(10).optional(),
      contactPhone: hhPhoneSchema,
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session?.user?.id);

    const vacancyRows = await ctx.db
      .select({ id: vacancies.id, title: vacancies.title })
      .from(vacancies)
      .where(
        and(
          eq(vacancies.id, input.vacancyId),
          eq(vacancies.companyId, companyId),
        ),
      )
      .limit(1);

    const vacancy = vacancyRows[0];
    if (!vacancy) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Вакансия не найдена",
      });
    }

    const hhAccount = await resolveCompanyHhAuth(ctx.db, companyId);
    if (!hhAccount?.accessToken) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "hh.uz аккаунт не подключён. Подключите его в настройках интеграций.",
      });
    }

    const contactName =
      ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Контактное лицо";
    const contactEmail = ctx.session?.user?.email;
    if (!contactEmail) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Email пользователя недоступен — обновите профиль",
      });
    }

    let resolvedPhone = input.contactPhone ?? null;
    if (!resolvedPhone) {
      const companyRows = await ctx.db
        .select({ phone: companies.phone })
        .from(companies)
        .where(eq(companies.id, companyId))
        .limit(1);
      const rawPhone = companyRows[0]?.phone?.trim();
      if (rawPhone) {
        const parsed = parseHhPhone(rawPhone);
        if (parsed) {
          resolvedPhone = parsed;
        }
      }
    }

    let result: Awaited<ReturnType<typeof publishHhVacancy>>;
    try {
      result = await publishHhVacancy(
        {
          name: input.name,
          description: input.descriptionHtml,
          areaId: input.areaId,
          employmentId: input.employmentId,
          scheduleId: input.scheduleId,
          experienceId: input.experienceId,
          professionalRoleId: input.professionalRoleId,
          billingTypeId: input.billingTypeId,
          salaryFrom: input.salaryFrom ?? null,
          salaryTo: input.salaryTo ?? null,
          salaryCurrency: input.salaryCurrency ?? "UZS",
          contactName,
          contactEmail,
          contactPhone: resolvedPhone,
        },
        hhAccount.accessToken,
      );
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? `hh.uz отклонил публикацию: ${error.message}`
            : "Не удалось опубликовать вакансию на hh.uz",
      });
    }

    const existing = await ctx.db
      .select({
        id: vacancyPublications.id,
        sources: vacancyPublications.sources,
      })
      .from(vacancyPublications)
      .where(eq(vacancyPublications.vacancyId, vacancy.id))
      .limit(1);

    const newSource = { platform: "hh.uz" as const, url: result.alternateUrl };
    if (existing[0]) {
      const otherSources = (existing[0].sources ?? []).filter(
        (source) => source.platform !== "hh.uz",
      );
      await ctx.db
        .update(vacancyPublications)
        .set({
          sources: [...otherSources, newSource],
          updatedAt: new Date(),
        })
        .where(eq(vacancyPublications.id, existing[0].id));
    } else {
      await ctx.db.insert(vacancyPublications).values({
        vacancyId: vacancy.id,
        name: input.name,
        description: input.descriptionHtml,
        isActive: true,
        sources: [newSource],
      });
    }

    return {
      success: true,
      hhVacancyId: result.id,
      url: result.alternateUrl,
    };
  });

function parseHhPhone(raw: string): {
  country: string;
  city: string;
  number: string;
} | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9) {
    return null;
  }
  if (digits.startsWith("998") && digits.length >= 12) {
    return {
      country: "998",
      city: digits.slice(3, 5),
      number: digits.slice(5),
    };
  }
  if (digits.length === 9) {
    return {
      country: "998",
      city: digits.slice(0, 2),
      number: digits.slice(2),
    };
  }
  return {
    country: digits.slice(0, digits.length - 9),
    city: digits.slice(digits.length - 9, digits.length - 7),
    number: digits.slice(digits.length - 7),
  };
}
