import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
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
  canBotDeleteMessages,
  deleteTelegramMessage,
  isTelegramConfigured,
  parseTelegramMessageUrl,
  sendTelegramMessage,
  sendTelegramPhoto,
} from "~/server/services/telegram";
import { fetchDirectusAsset } from "~/server/storage/directus-storage";
import { formatTelegramVacancy } from "~/utils/format-telegram-vacancy";
import { generateVacancyKeyword } from "~/utils/generate-vacancy-keyword";

import {
  vacancyCreateInputSchema,
  vacancyIdInputSchema,
  vacancyUpdateInputSchema,
} from "./schemas";
import { formatVacancy, isHhVacancyId, type SalaryCurrency } from "./shared";

export const createVacancyProcedure = protectedProcedure
  .input(vacancyCreateInputSchema)
  .mutation(async ({ ctx, input }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session?.user?.id);
    const vacancyId = input.id ?? crypto.randomUUID();

    const createdRows = await ctx.db
      .insert(vacancies)
      .values({
        isActive: input.isActive ?? false,
        isPublication: input.isPublication ?? false,
        destination: input.destination ?? null,
        id: vacancyId,
        parentId: input.parentId ?? vacancyId,
        title: input.title,
        status: input.status,
        responses: input.responses,
        areaId: input.areaId ?? null,
        employmentId: input.employmentId ?? null,
        scheduleId: input.scheduleId ?? null,
        experienceId: input.experienceId ?? null,
        professionalRoleId: input.professionalRoleId ?? null,
        billingTypeId: input.billingTypeId ?? null,
        salaryFrom: input.salaryFrom ?? null,
        salaryTo: input.salaryTo ?? null,
        salaryCurrency: input.salaryCurrency,
        descriptionHtml: input.descriptionHtml ?? null,
        contactPhone: input.contactPhone ?? null,
        telegramFileId: input.telegramFileId ?? null,
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
      if (
        input.descriptionHtml !== undefined &&
        input.descriptionHtml !== null
      ) {
        contentFields.description = input.descriptionHtml;
      }
      if (input.salaryFrom !== undefined) {
        contentFields.salaryFrom = input.salaryFrom;
      }
      if (input.salaryTo !== undefined) {
        contentFields.salaryTo = input.salaryTo;
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
      // hh.uz returns its display labels (city, level, workType) on the search response, but
      // the schema now stores hh.uz lookup IDs we can't recover from those names. Return blank
      // ID fields and let the UI re-resolve names from the dictionaries when needed.
      return {
        id: input.id,
        parentId: input.id,
        title: updated.title,
        status: updated.status,
        responses: updated.responses,
        areaId: "",
        employmentId: "",
        scheduleId: "",
        experienceId: "",
        professionalRoleId: "",
        billingTypeId: "",
        salaryFrom: undefined,
        salaryTo: undefined,
        salaryCurrency: updated.salaryCurrency ?? "UZS",
        descriptionHtml: "",
        contactPhone: "",
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

    // Deactivating a Telegram publication must first remove its channel post — only possible
    // when the bot has the `can_delete_messages` admin right.
    let clearTelegramPostId = false;
    if (
      input.isActive === false &&
      existing.isActive &&
      existing.destination === "telegram" &&
      existing.telegramPostId
    ) {
      const target = parseTelegramMessageUrl(existing.telegramPostId);
      if (target) {
        const canDelete = await canBotDeleteMessages(target.chatId);
        if (!canDelete) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Вы не можете деактивировать эту публикацию, так как её нельзя удалить в Telegram.",
          });
        }
        await deleteTelegramMessage(target.chatId, target.messageId);
        clearTelegramPostId = true;
      }
    }

    const valuesToUpdate: Partial<{
      title: string;
      status: "active" | "draft" | "paused" | "closed" | "archive";
      responses: number;
      areaId: string | null;
      employmentId: string | null;
      scheduleId: string | null;
      experienceId: string | null;
      professionalRoleId: string | null;
      billingTypeId: string | null;
      salaryFrom: number | null;
      salaryTo: number | null;
      salaryCurrency: SalaryCurrency;
      descriptionHtml: string | null;
      contactPhone: string | null;
      telegramFileId: string | null;
      telegramPostId: string | null;
      isActive: boolean;
      isPublication: boolean;
    }> = {};

    if (input.title && input.title !== existing.title)
      valuesToUpdate.title = input.title;
    if (input.status && input.status !== (existing.status ?? "active"))
      valuesToUpdate.status = input.status;
    if (
      input.responses !== undefined &&
      input.responses !== (existing.responses ?? 0)
    )
      valuesToUpdate.responses = input.responses;
    if (
      input.areaId !== undefined &&
      (input.areaId ?? "") !== (existing.areaId ?? "")
    )
      valuesToUpdate.areaId = input.areaId || null;
    if (
      input.employmentId !== undefined &&
      (input.employmentId ?? "") !== (existing.employmentId ?? "")
    )
      valuesToUpdate.employmentId = input.employmentId || null;
    if (
      input.scheduleId !== undefined &&
      (input.scheduleId ?? "") !== (existing.scheduleId ?? "")
    )
      valuesToUpdate.scheduleId = input.scheduleId || null;
    if (
      input.experienceId !== undefined &&
      (input.experienceId ?? "") !== (existing.experienceId ?? "")
    )
      valuesToUpdate.experienceId = input.experienceId || null;
    if (
      input.professionalRoleId !== undefined &&
      (input.professionalRoleId ?? "") !== (existing.professionalRoleId ?? "")
    )
      valuesToUpdate.professionalRoleId = input.professionalRoleId || null;
    if (
      input.billingTypeId !== undefined &&
      (input.billingTypeId ?? "") !== (existing.billingTypeId ?? "")
    )
      valuesToUpdate.billingTypeId = input.billingTypeId || null;
    if (
      input.salaryFrom !== undefined &&
      input.salaryFrom !== existing.salaryFrom
    )
      valuesToUpdate.salaryFrom = input.salaryFrom;
    if (input.salaryTo !== undefined && input.salaryTo !== existing.salaryTo)
      valuesToUpdate.salaryTo = input.salaryTo;
    if (
      input.salaryCurrency !== undefined &&
      input.salaryCurrency !== (existing.salaryCurrency ?? "UZS")
    )
      valuesToUpdate.salaryCurrency = input.salaryCurrency;
    if (
      input.descriptionHtml !== undefined &&
      (input.descriptionHtml ?? "") !== (existing.descriptionHtml ?? "")
    )
      valuesToUpdate.descriptionHtml = input.descriptionHtml || null;
    if (
      input.contactPhone !== undefined &&
      (input.contactPhone ?? "") !== (existing.contactPhone ?? "")
    ) {
      valuesToUpdate.contactPhone = input.contactPhone || null;
    }
    if (
      input.telegramFileId !== undefined &&
      (input.telegramFileId ?? "") !== (existing.telegramFileId ?? "")
    ) {
      valuesToUpdate.telegramFileId = input.telegramFileId || null;
    }
    if (input.isActive !== undefined && input.isActive !== existing.isActive) {
      valuesToUpdate.isActive = input.isActive;
    }
    if (
      input.isPublication !== undefined &&
      input.isPublication !== existing.isPublication
    ) {
      valuesToUpdate.isPublication = input.isPublication;
    }
    if (clearTelegramPostId) {
      valuesToUpdate.telegramPostId = null;
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

export const deleteVacancyPublicationProcedure = protectedProcedure
  .input(vacancyIdInputSchema)
  .mutation(async ({ ctx, input }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session?.user?.id);

    const deletedRows = await ctx.db
      .delete(vacancies)
      .where(
        and(
          eq(vacancies.id, input.id),
          eq(vacancies.companyId, companyId),
          eq(vacancies.isPublication, true),
        ),
      )
      .returning({ id: vacancies.id, parentId: vacancies.parentId });

    const deleted = deletedRows[0];
    if (!deleted) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Публикация не найдена",
      });
    }

    return { success: true, id: deleted.id, parentId: deleted.parentId };
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

    // Telegram publications don't carry their own salary — fall back to the parent vacancy.
    let parentSalary: {
      from: number | null;
      to: number | null;
      currency: string | null;
    } | null = null;
    if (vacancy.parentId && vacancy.parentId !== vacancy.id) {
      const parentRows = await ctx.db
        .select({
          salaryFrom: vacancies.salaryFrom,
          salaryTo: vacancies.salaryTo,
          salaryCurrency: vacancies.salaryCurrency,
        })
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, vacancy.parentId),
            eq(vacancies.companyId, companyId),
          ),
        )
        .limit(1);
      const parent = parentRows[0];
      if (parent) {
        parentSalary = {
          from: parent.salaryFrom,
          to: parent.salaryTo,
          currency: parent.salaryCurrency,
        };
      }
    }

    const salaryFrom = vacancy.salaryFrom ?? parentSalary?.from ?? null;
    const salaryTo = vacancy.salaryTo ?? parentSalary?.to ?? null;
    const salaryCurrency =
      vacancy.salaryCurrency ?? parentSalary?.currency ?? "UZS";
    const salaryRange = [salaryFrom, salaryTo]
      .filter((value): value is number => typeof value === "number")
      .map((value) => value.toLocaleString())
      .join(" – ");
    const salaryLine = salaryRange
      ? `salary: ${salaryRange} ${salaryCurrency}`
      : null;

    // formatTelegramVacancy renders its own salary line — drop the salary fields so the salary
    // is posted once, with the requested "salary:" prefix.
    const messageVacancy = {
      ...formatVacancy(vacancy),
      salaryFrom: undefined,
      salaryTo: undefined,
    };

    const buildMessage = (maxLength: number) => {
      const reserve = salaryLine ? salaryLine.length + 2 : 0;
      const body = formatTelegramVacancy(
        messageVacancy,
        keyword,
        maxLength - reserve,
      );
      return salaryLine ? `${body}\n\n${salaryLine}` : body;
    };

    // Load the publication image once; fall back to a plain text post if it can't be fetched.
    let photo: { data: ArrayBuffer; contentType: string } | null = null;
    if (vacancy.telegramFileId) {
      try {
        const assetResponse = await fetchDirectusAsset(vacancy.telegramFileId);
        photo = {
          data: await assetResponse.arrayBuffer(),
          contentType:
            assetResponse.headers.get("content-type") ?? "image/jpeg",
        };
      } catch (error) {
        console.error("Failed to load Telegram publication image", {
          vacancyId: vacancy.id,
          telegramFileId: vacancy.telegramFileId,
          error,
        });
      }
    }

    // Photo captions are capped at 1024 chars by Telegram; plain messages at 4096.
    const textMessage = buildMessage(4096);
    const photoCaption = photo ? buildMessage(1024) : null;

    const errors: string[] = [];
    let firstMessageUrl: string | null = null;
    for (const channel of channels) {
      try {
        const sent =
          photo && photoCaption !== null
            ? await sendTelegramPhoto(
                {
                  data: photo.data,
                  filename: "vacancy",
                  contentType: photo.contentType,
                },
                photoCaption,
                channel.channelId,
              )
            : await sendTelegramMessage(textMessage, channel.channelId);
        if (!firstMessageUrl) {
          firstMessageUrl = sent.messageUrl;
        }
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

    if (firstMessageUrl) {
      await ctx.db
        .update(vacancies)
        .set({ telegramPostId: firstMessageUrl })
        .where(eq(vacancies.id, vacancy.id));

      if (vacancy.parentId && vacancy.parentId !== vacancy.id) {
        await ctx.db
          .update(vacancies)
          .set({ telegramPostId: firstMessageUrl })
          .where(
            and(
              eq(vacancies.id, vacancy.parentId),
              eq(vacancies.companyId, companyId),
            ),
          );
      }
    }

    const sentTo = channels.length - errors.length;

    return {
      success: true,
      keyword,
      sentTo,
      telegramPostUrl: firstMessageUrl,
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

    await ctx.db
      .update(vacancies)
      .set({ hhVacancyId: result.id })
      .where(eq(vacancies.id, vacancy.id));

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
