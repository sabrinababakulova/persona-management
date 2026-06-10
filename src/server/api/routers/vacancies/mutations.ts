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
  userTelegramBotSettings,
  userTelegramChannels,
  vacancies,
  vacancyTelegramPosts,
} from "~/server/db/schema";
import {
  archiveHhVacancy,
  fetchHhAreasUz,
  fetchHhDictionaries,
  fetchHhProfessionalRoles,
  fetchHhVacancyById,
  fetchHhVacancyDetail,
  HhApiError,
  prolongHhVacancy,
  publishHhVacancy,
  saveHhVacancyDraft,
  updateHhVacancyContent,
} from "~/server/services/hh";
import {
  getUserHhAccount,
  resolveUserHhAuth,
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
import { decryptSecret } from "~/server/utils/secret-encryption";
import { formatTelegramVacancy } from "~/utils/format-telegram-vacancy";
import { generateVacancyKeyword } from "~/utils/generate-vacancy-keyword";

import {
  vacancyCreateInputSchema,
  vacancyIdInputSchema,
  vacancyUpdateInputSchema,
} from "./schemas";
import { formatVacancy, isHhVacancyId, type SalaryCurrency } from "./shared";

/**
 * Per the hh.uz `vacancy-prolongation` schema, a 403 response can carry one of these
 * `errors[].value` discriminators. We translate them to user-facing Russian messages so
 * the UI can show the recruiter what to do next instead of a raw API failure.
 */
const HH_PROLONGATE_ERROR_MESSAGES: Record<string, string> = {
  unavailable_for_archived:
    "hh.uz не позволяет восстановить эту вакансию из архива.",
  not_enough_purchased_services:
    "Недостаточно купленных услуг для повторной публикации вакансии.",
  quota_exceeded: "Исчерпана квота на публикацию вакансий этого типа.",
  prolongation_forbidden:
    "У этого менеджера нет прав на восстановление вакансии.",
  too_early: "Восстановить вакансию пока нельзя — попробуйте позже.",
  not_premoderated:
    "Вакансия ещё не прошла модерацию hh.uz — восстановление будет доступно позже.",
};

function describeHhProlongateError(error: unknown): string {
  if (error instanceof HhApiError) {
    for (const value of error.errorValues) {
      const message = HH_PROLONGATE_ERROR_MESSAGES[value];
      if (message) {
        return message;
      }
    }
    if (error.status === 404) {
      return "Вакансия не найдена в hh.uz или нет прав на просмотр.";
    }
  }
  return "Не удалось восстановить вакансию из архива. Попробуйте позже.";
}

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
        vacancyTypeId: input.vacancyTypeId ?? null,
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
      const hhAccount = await resolveUserHhAuth(ctx.db, ctx.session.user.id);

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
        vacancyTypeId: "open",
        billingTypeId: "",
        salaryFrom: undefined,
        salaryTo: undefined,
        salaryCurrency: updated.salaryCurrency ?? "UZS",
        descriptionHtml: "",
        contactPhone: "",
        companyId: userCompanyId,
        hhDraftId: null,
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

    // Archived hh.uz-linked rows are read-only stubs (the discovery cron stores only id,
    // title, status="archive"). The one allowed write is flipping `status` back to "active",
    // which is performed via the hh.uz prolongation endpoint and then mirrored locally.
    if (existing.status === "archive" && existing.hhVacancyId) {
      const otherFieldsTouched = (
        Object.keys(input) as (keyof typeof input)[]
      ).some(
        (key) => key !== "id" && key !== "status" && input[key] !== undefined,
      );
      const isUnarchiveRequest =
        input.status === "active" && !otherFieldsTouched;

      if (!isUnarchiveRequest) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Эта вакансия в архиве. Чтобы внести изменения, переведите её в активный статус.",
        });
      }

      const hhAccount = await resolveUserHhAuth(ctx.db, ctx.session.user.id);
      if (!hhAccount?.accessToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "hh.uz аккаунт не подключён",
        });
      }

      try {
        await prolongHhVacancy(existing.hhVacancyId, hhAccount.accessToken);
      } catch (error) {
        if (!(error instanceof HhApiError)) {
          console.error("hh.uz prolongation request failed", {
            hhVacancyId: existing.hhVacancyId,
            error,
          });
        }
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: describeHhProlongateError(error),
        });
      }

      // Now that the vacancy is active again, hydrate the stub with the canonical hh.uz
      // detail so the form has something to render. A failure here is non-fatal — we still
      // mark the row active locally and let the next discovery sync fill in the rest.
      const hhDetail = await fetchHhVacancyDetail(
        existing.hhVacancyId,
        hhAccount.accessToken,
      ).catch((error: unknown) => {
        console.error(
          "Failed to hydrate restored hh.uz vacancy from /vacancies/{id}",
          { hhVacancyId: existing.hhVacancyId, error },
        );
        return null;
      });

      const restoreUpdate: Partial<typeof vacancies.$inferInsert> = {
        status: "active",
      };
      if (hhDetail) {
        if (hhDetail.name) {
          restoreUpdate.title = hhDetail.name;
        }
        if (hhDetail.descriptionHtml) {
          restoreUpdate.descriptionHtml = hhDetail.descriptionHtml;
        }
        restoreUpdate.areaId = hhDetail.areaId ?? null;
        restoreUpdate.employmentId = hhDetail.employmentId ?? null;
        restoreUpdate.scheduleId = hhDetail.scheduleId ?? null;
        restoreUpdate.experienceId = hhDetail.experienceId ?? null;
        restoreUpdate.professionalRoleId =
          hhDetail.professionalRoleIds[0] ?? null;
        restoreUpdate.vacancyTypeId = hhDetail.vacancyTypeId ?? null;
        restoreUpdate.billingTypeId = hhDetail.billingTypeId ?? null;
        restoreUpdate.salaryFrom = hhDetail.salary?.from ?? null;
        restoreUpdate.salaryTo = hhDetail.salary?.to ?? null;
        restoreUpdate.salaryCurrency =
          hhDetail.salary?.currency === "USD" ? "USD" : "UZS";
        const phone = hhDetail.contacts?.phones?.[0];
        restoreUpdate.contactPhone = phone
          ? (phone.formatted ??
            [phone.country, phone.city, phone.number]
              .filter((part): part is string => Boolean(part))
              .join(" "))
          : null;
      }

      const restoredRows = await ctx.db
        .update(vacancies)
        .set(restoreUpdate)
        .where(
          and(
            eq(vacancies.id, input.id),
            eq(vacancies.companyId, userCompanyId),
          ),
        )
        .returning();

      const restored = restoredRows[0];
      if (!restored) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update vacancy",
        });
      }

      const actorName =
        ctx.session?.user?.name ?? ctx.session?.user?.email ?? "Система";
      await writeRecentActivityLog(ctx.db, {
        entityType: "vacancy",
        entityId: restored.id,
        companyId: userCompanyId,
        actorUserId: ctx.session?.user?.id ?? null,
        actorName,
        action: "Восстановил(а) вакансию из архива",
        targetName: restored.title,
        targetStatus: "active",
      });

      return formatVacancy(restored);
    }

    // Deactivating a Telegram publication must first remove its post from every channel it
    // was published to — only possible when the bot has the `can_delete_messages` admin right.
    let clearTelegramPosts = false;
    if (
      input.isActive === false &&
      existing.isActive &&
      existing.destination === "telegram"
    ) {
      const posts = await ctx.db
        .select()
        .from(vacancyTelegramPosts)
        .where(eq(vacancyTelegramPosts.publicationId, existing.id));

      // A post whose channel was removed from the company is frozen — the message
      // there must stay published, so the whole publication can't be deactivated.
      if (posts.some((post) => post.channelId === null)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Вы не можете деактивировать эту публикацию: один из каналов был удалён, и у вас нет прав на удаление сообщения в нём.",
        });
      }

      // Legacy publications (created before per-channel tracking) only have `telegramPostId`.
      const messageUrls =
        posts.length > 0
          ? posts.map((post) => post.messageUrl)
          : existing.telegramPostId
            ? [existing.telegramPostId]
            : [];

      const targets = messageUrls
        .map((url) => parseTelegramMessageUrl(url))
        .filter(
          (target): target is NonNullable<typeof target> => target !== null,
        );

      if (targets.length > 0) {
        const telegramSettings = await ctx.db
          .select({ botToken: userTelegramBotSettings.botToken })
          .from(userTelegramBotSettings)
          .where(eq(userTelegramBotSettings.userId, ctx.session.user.id))
          .limit(1);
        const botToken = telegramSettings[0]?.botToken
          ? decryptSecret(telegramSettings[0].botToken)
          : null;
        if (!isTelegramConfigured(botToken)) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Telegram не настроен",
          });
        }

        // Pre-check delete permission for every distinct chat before deleting anything.
        const distinctChatIds = [...new Set(targets.map((t) => t.chatId))];
        const permissions = await Promise.all(
          distinctChatIds.map(
            async (chatId) =>
              [chatId, await canBotDeleteMessages(chatId, botToken)] as const,
          ),
        );
        if (permissions.some(([, canDelete]) => !canDelete)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "Вы не можете деактивировать эту публикацию, так как её нельзя удалить в Telegram.",
          });
        }

        const deleteErrors: string[] = [];
        for (const target of targets) {
          try {
            await deleteTelegramMessage(
              target.chatId,
              target.messageId,
              botToken,
            );
          } catch (error) {
            deleteErrors.push(
              `${target.chatId}: ${error instanceof Error ? error.message : "ошибка"}`,
            );
          }
        }
        if (deleteErrors.length === targets.length) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Не удалось удалить сообщения в Telegram:\n${deleteErrors.join("\n")}`,
          });
        }
        clearTelegramPosts = true;
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
      vacancyTypeId: string | null;
      billingTypeId: string | null;
      salaryFrom: number | null;
      salaryTo: number | null;
      salaryCurrency: SalaryCurrency;
      descriptionHtml: string | null;
      contactPhone: string | null;
      telegramFileId: string | null;
      telegramPostId: string | null;
      hhDraftId: string | null;
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
      input.vacancyTypeId !== undefined &&
      (input.vacancyTypeId ?? "") !== (existing.vacancyTypeId ?? "")
    )
      valuesToUpdate.vacancyTypeId = input.vacancyTypeId || null;
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
    if (clearTelegramPosts) {
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

    if (clearTelegramPosts) {
      await ctx.db
        .delete(vacancyTelegramPosts)
        .where(eq(vacancyTelegramPosts.publicationId, input.id));
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
    const telegramSettings = await ctx.db
      .select({ botToken: userTelegramBotSettings.botToken })
      .from(userTelegramBotSettings)
      .where(eq(userTelegramBotSettings.userId, ctx.session.user.id))
      .limit(1);
    const botToken = telegramSettings[0]?.botToken
      ? decryptSecret(telegramSettings[0].botToken)
      : null;

    if (!isTelegramConfigured(botToken)) {
      return { enabled: false };
    }

    const channels = await ctx.db
      .select({ id: userTelegramChannels.id })
      .from(userTelegramChannels)
      .where(eq(userTelegramChannels.userId, ctx.session.user.id))
      .limit(1);

    return { enabled: channels.length > 0 };
  },
);

export const publishTelegramProcedure = protectedProcedure
  .input(
    z.object({
      vacancyId: z.string().min(1).max(255),
      channelIds: z
        .array(z.string().min(1).max(255))
        .min(1, "Выберите хотя бы один канал"),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const telegramSettings = await ctx.db
      .select({ botToken: userTelegramBotSettings.botToken })
      .from(userTelegramBotSettings)
      .where(eq(userTelegramBotSettings.userId, ctx.session.user.id))
      .limit(1);
    const botToken = telegramSettings[0]?.botToken
      ? decryptSecret(telegramSettings[0].botToken)
      : null;

    if (!isTelegramConfigured(botToken)) {
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

    const userChannels = await ctx.db
      .select()
      .from(userTelegramChannels)
      .where(eq(userTelegramChannels.userId, ctx.session.user.id));

    if (userChannels.length === 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "У пользователя не настроены Telegram-каналы",
      });
    }

    // Post only to the channels the user picked; reject ids that aren't theirs.
    const channels = userChannels.filter((channel) =>
      input.channelIds.includes(channel.id),
    );

    if (channels.length !== input.channelIds.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Один или несколько выбранных каналов не принадлежат пользователю",
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
    const postRows: {
      id: string;
      publicationId: string;
      channelId: string;
      messageUrl: string;
    }[] = [];
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
                botToken,
              )
            : await sendTelegramMessage(
                textMessage,
                channel.channelId,
                botToken,
              );
        if (!firstMessageUrl) {
          firstMessageUrl = sent.messageUrl;
        }
        postRows.push({
          id: crypto.randomUUID(),
          publicationId: vacancy.id,
          channelId: channel.id,
          messageUrl: sent.messageUrl,
        });
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

    if (postRows.length > 0) {
      await ctx.db.insert(vacancyTelegramPosts).values(postRows);
    }

    if (firstMessageUrl) {
      // Keep `telegramPostId` set to the first URL for backward compatibility.
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

    const [account, companyRows] = await Promise.all([
      getUserHhAccount(ctx.db, ctx.session.user.id),
      companyId
        ? ctx.db
            .select({ phone: companies.phone })
            .from(companies)
            .where(eq(companies.id, companyId))
            .limit(1)
        : Promise.resolve([]),
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
      vacancyType: dictionaries.vacancy_type,
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
      vacancyTypeId: z.string().min(1).max(50),
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
      .select({
        id: vacancies.id,
        title: vacancies.title,
        parentId: vacancies.parentId,
      })
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

    const hhAccount = await resolveUserHhAuth(ctx.db, ctx.session.user.id);
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
          vacancyTypeId: input.vacancyTypeId,
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

    if (vacancy.parentId && vacancy.parentId !== vacancy.id) {
      await ctx.db
        .update(vacancies)
        .set({ hhVacancyId: result.id })
        .where(
          and(
            eq(vacancies.id, vacancy.parentId),
            eq(vacancies.companyId, companyId),
          ),
        );
    }

    return {
      success: true,
      hhVacancyId: result.id,
      url: result.alternateUrl,
    };
  });

export const saveHhDraftProcedure = protectedProcedure
  .input(
    z.object({
      vacancyId: z.string().min(1).max(255),
      name: z.string().min(1).max(500),
      descriptionHtml: z.string().max(20000).optional(),
      areaId: z.string().max(20).optional(),
      employmentId: z.string().max(50).optional(),
      scheduleId: z.string().max(50).optional(),
      experienceId: z.string().max(50).optional(),
      professionalRoleId: z.string().max(50).optional(),
      vacancyTypeId: z.string().max(50).optional(),
      billingTypeId: z.string().max(50).optional(),
      salaryFrom: z.number().int().nonnegative().nullable().optional(),
      salaryTo: z.number().int().nonnegative().nullable().optional(),
      salaryCurrency: z.string().min(1).max(10).optional(),
      contactPhone: hhPhoneSchema,
    }),
  )
  .mutation(async ({ ctx, input }) => {
    const companyId = await getRequiredCompanyId(ctx.db, ctx.session?.user?.id);

    const vacancyRows = await ctx.db
      .select({
        id: vacancies.id,
        hhDraftId: vacancies.hhDraftId,
      })
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

    const hhAccount = await resolveUserHhAuth(ctx.db, ctx.session.user.id);
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

    try {
      const result = await saveHhVacancyDraft(
        {
          name: input.name,
          description: input.descriptionHtml,
          areaId: input.areaId || undefined,
          employmentId: input.employmentId || undefined,
          scheduleId: input.scheduleId || undefined,
          experienceId: input.experienceId || undefined,
          professionalRoleId: input.professionalRoleId || undefined,
          vacancyTypeId: input.vacancyTypeId || undefined,
          billingTypeId: input.billingTypeId || undefined,
          salaryFrom: input.salaryFrom ?? undefined,
          salaryTo: input.salaryTo ?? undefined,
          salaryCurrency: input.salaryCurrency,
          contactName,
          contactEmail: contactEmail ?? undefined,
          contactPhone: resolvedPhone,
        },
        hhAccount.accessToken,
        vacancy.hhDraftId,
      );

      await ctx.db
        .update(vacancies)
        .set({ hhDraftId: result.id })
        .where(eq(vacancies.id, vacancy.id));

      return {
        success: true,
        hhDraftId: result.id,
        name: result.name,
        publicationReady: result.publicationReady,
        ignoredFields: result.ignoredFields,
        validationErrors: result.validationErrors,
        apiUrl: result.apiUrl,
      };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message:
          error instanceof Error
            ? `hh.uz не сохранил черновик: ${error.message}`
            : "Не удалось сохранить черновик на hh.uz",
      });
    }
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
