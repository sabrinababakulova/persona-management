import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { getRequiredCompanyId } from "~/server/api/router-utils/company";
import { protectedProcedure } from "~/server/api/trpc";
import { takeRateLimitSlot } from "~/server/auth/rate-limit";
import { userOlxSessions, vacancies } from "~/server/db/schema";
import {
  getOlxJobCategories,
  OlxApiError,
  searchOlxLocations,
  submitOlxOffer,
} from "~/server/services/olx-api";
import { runOlxOperation } from "./olx-lifecycle";
import { olxPublicationMetaSchema } from "./schemas";
import { isUserVisibleVacancy } from "./shared";

const OLX_ACTION_COOLDOWN_MS = 30 * 1000;
const OLX_ACTION_WINDOW_MS = 60 * 60 * 1000;
const OLX_LOCATION_SEARCH_WINDOW_MS = 15 * 60 * 1000;
const OLX_PUBLISH_CLAIM_STALE_MS = 5 * 60 * 1000;

const olxPublishInputSchema = z.object({
  id: z.string().min(1).max(255),
  /** Validates through OLX's preview endpoint without creating an advert. */
  dryRun: z.boolean().default(true),
});

const olxLocationSearchSchema = z.object({
  query: z.string().trim().min(2).max(100),
});

function describeOlxPublishError(error: unknown): TRPCError {
  if (error instanceof OlxApiError) {
    if (error.code === "reauth_required") {
      return new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Доступ olx.uz истёк. Переподключите аккаунт в настройках компании.",
      });
    }
    if (error.code === "rate_limited") {
      return new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "olx.uz временно ограничил запросы. Повторите позже.",
      });
    }
    if (error.code === "validation_failed") {
      const details = error.validation.length
        ? ` ${error.validation.join("; ")}`
        : "";
      return new TRPCError({
        code: "BAD_REQUEST",
        message: `olx.uz отклонил данные объявления.${details}`,
      });
    }
    return new TRPCError({
      code: "BAD_GATEWAY",
      message: "olx.uz сейчас не отвечает. Попробуйте позже.",
    });
  }

  const localMessage = error instanceof Error ? error.message : "";
  const messageByCode: Record<string, string> = {
    OLX_TITLE_LENGTH:
      "Название для olx.uz должно содержать от 16 до 70 знаков.",
    OLX_DESCRIPTION_LENGTH:
      "Описание для olx.uz должно содержать от 80 до 9000 знаков.",
    OLX_CATEGORY_REQUIRED: "Выберите специальность из списка olx.uz.",
    OLX_CONTACT_REQUIRED: "Укажите имя контактного лица (не менее 2 знаков).",
    OLX_LOCATION_NOT_FOUND: "Выберите местоположение из подсказок olx.uz.",
    OLX_LOCATION_DISTRICT_REQUIRED:
      "Для этого города выберите конкретный район из подсказок olx.uz.",
    OLX_PUBLISH_RESPONSE_INVALID:
      "olx.uz не подтвердил создание объявления. Повторно не отправляйте его; проверьте объявления в olx.uz.",
  };
  if (messageByCode[localMessage]) {
    return new TRPCError({
      code: "BAD_REQUEST",
      message: messageByCode[localMessage],
    });
  }

  console.error("Unexpected OLX API publication error", error);
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Не удалось обработать публикацию olx.uz.",
  });
}

function failedPublicationState(error: unknown): "failed" | "unknown" {
  if (error instanceof OlxApiError) {
    return error.code === "unavailable" || error.code === "unexpected_response"
      ? "unknown"
      : "failed";
  }
  const knownLocalFailures = new Set([
    "OLX_TITLE_LENGTH",
    "OLX_DESCRIPTION_LENGTH",
    "OLX_CATEGORY_REQUIRED",
    "OLX_CONTACT_REQUIRED",
    "OLX_LOCATION_NOT_FOUND",
    "OLX_LOCATION_DISTRICT_REQUIRED",
    "OLX_POSTING_ID_REQUIRED",
  ]);
  return error instanceof Error && knownLocalFailures.has(error.message)
    ? "failed"
    : "unknown";
}

export const getOlxConfigProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const [rows, categoriesResult] = await Promise.all([
      ctx.db
        .select({ status: userOlxSessions.status })
        .from(userOlxSessions)
        .where(eq(userOlxSessions.userId, ctx.session.user.id))
        .limit(1),
      getOlxJobCategories()
        .then((categories) => ({ categories, serviceAvailable: true }))
        .catch((error) => {
          console.error("Failed to load OLX job categories", error);
          return { categories: [], serviceAvailable: false };
        }),
    ]);

    return {
      ...categoriesResult,
      connected: rows[0]?.status === "connected",
      status: rows[0]?.status ?? null,
    };
  },
);

export const searchOlxLocationsProcedure = protectedProcedure
  .input(olxLocationSearchSchema)
  .query(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const ip =
      ctx.headers.get("x-real-ip")?.trim() ??
      ctx.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ??
      "unknown";
    const userKey = `olx-location-search-user:${userId}`;
    const ipKey = `olx-location-search-ip:${ip.slice(0, 100)}`;
    if (
      !(await takeRateLimitSlot(userKey, 120, OLX_LOCATION_SEARCH_WINDOW_MS)) ||
      !(await takeRateLimitSlot(ipKey, 300, OLX_LOCATION_SEARCH_WINDOW_MS))
    ) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "Слишком много поисковых запросов olx.uz. Повторите позже.",
      });
    }
    try {
      return await searchOlxLocations(input.query);
    } catch (error) {
      console.error("Failed to search OLX locations", error);
      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "Не удалось загрузить местоположения olx.uz.",
      });
    }
  });

export const publishOlxProcedure = protectedProcedure
  .input(olxPublishInputSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const companyId = await getRequiredCompanyId(ctx.db, userId);
    const action = input.dryRun ? "preview" : "publish";
    const cooldownKey = `olx-${action}-cooldown:${userId}`;
    const hourlyKey = `olx-api-actions:${userId}`;

    if (
      !(await takeRateLimitSlot(cooldownKey, 1, OLX_ACTION_COOLDOWN_MS)) ||
      !(await takeRateLimitSlot(hourlyKey, 10, OLX_ACTION_WINDOW_MS))
    ) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "olx.uz отправляется только по вашему нажатию и не чаще одного раза в 30 секунд. Подождите и повторите.",
      });
    }

    const [vacancyRows, sessionRows] = await Promise.all([
      ctx.db
        .select()
        .from(vacancies)
        .where(
          and(
            eq(vacancies.id, input.id),
            eq(vacancies.companyId, companyId),
            eq(vacancies.isPublication, true),
            eq(vacancies.destination, "olx.uz"),
            isUserVisibleVacancy(),
          ),
        )
        .limit(1),
      ctx.db
        .select()
        .from(userOlxSessions)
        .where(eq(userOlxSessions.userId, userId))
        .limit(1),
    ]);

    const vacancy = vacancyRows[0];
    if (!vacancy) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Публикация olx.uz не найдена.",
      });
    }
    const parsedMeta = olxPublicationMetaSchema.safeParse(
      vacancy.olxBrowserMeta,
    );
    if (!parsedMeta.success) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Проверьте обязательные параметры публикации olx.uz.",
      });
    }
    if (!input.dryRun && (vacancy.olxAdvertId || vacancy.olxAdvertUrl)) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Эта версия уже отправлена в olx.uz. Откройте существующее объявление, чтобы не создать дубликат.",
      });
    }

    const session = sessionRows[0];
    if (!session || session.status !== "connected") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Подключите аккаунт olx.uz в настройках компании.",
      });
    }

    let postingId: string | undefined;
    if (!input.dryRun) {
      const claimTime = new Date();
      const staleBefore = new Date(
        claimTime.getTime() - OLX_PUBLISH_CLAIM_STALE_MS,
      );
      const claimed = await ctx.db
        .update(vacancies)
        .set({
          olxPostingId: sql`coalesce(${vacancies.olxPostingId}, ${randomUUID()})`,
          olxPublicationState: "publishing",
          olxPublishClaimedAt: claimTime,
          olxLastError: null,
        })
        .where(
          and(
            eq(vacancies.id, vacancy.id),
            isNull(vacancies.olxAdvertId),
            isNull(vacancies.olxAdvertUrl),
            or(
              isNull(vacancies.olxPublicationState),
              inArray(vacancies.olxPublicationState, ["failed", "unknown"]),
              and(
                eq(vacancies.olxPublicationState, "publishing"),
                or(
                  isNull(vacancies.olxPublishClaimedAt),
                  lt(vacancies.olxPublishClaimedAt, staleBefore),
                ),
              ),
            ),
          ),
        )
        .returning({ postingId: vacancies.olxPostingId });
      postingId = claimed[0]?.postingId ?? undefined;
      if (!postingId) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Публикация уже отправлена или обрабатывается. Обновите страницу перед повторной попыткой.",
        });
      }
    }

    try {
      const submitted = await runOlxOperation(ctx.db, userId, (credentials) =>
        submitOlxOffer({
          credentials,
          dryRun: input.dryRun,
          postingId,
          advert: {
            title: vacancy.title,
            descriptionHtml: vacancy.descriptionHtml ?? "",
            salaryFrom: vacancy.salaryFrom,
            salaryTo: vacancy.salaryTo,
            salaryCurrency: vacancy.salaryCurrency === "USD" ? "USD" : "UZS",
            meta: parsedMeta.data,
          },
        }),
      );
      const now = new Date();

      if (submitted.result.mode === "published") {
        const persisted = await ctx.db
          .update(vacancies)
          .set({
            olxAdvertUrl: submitted.result.advertUrl,
            olxAdvertId: submitted.result.advertId,
            olxPublisherUserId: userId,
            olxLastPublishedAt: now,
            olxLastError: null,
            olxPublicationState: "succeeded",
            olxPublishClaimedAt: null,
            isActive: true,
          })
          .where(
            and(
              eq(vacancies.id, vacancy.id),
              eq(vacancies.olxPostingId, postingId as string),
            ),
          )
          .returning({ id: vacancies.id });
        if (!persisted[0]) throw new Error("OLX_PUBLICATION_PERSIST_FAILED");
      } else {
        await ctx.db
          .update(vacancies)
          .set({ olxLastError: null })
          .where(eq(vacancies.id, vacancy.id));
      }

      return submitted.result;
    } catch (error) {
      const safeError =
        error instanceof OlxApiError
          ? `api:${error.code}`
          : error instanceof Error && error.message.startsWith("OLX_")
            ? `input:${error.message}`
            : "unexpected_api_error";

      await ctx.db
        .update(vacancies)
        .set({
          olxLastError: safeError,
          ...(input.dryRun
            ? {}
            : {
                olxPublicationState: failedPublicationState(error),
                olxPublishClaimedAt: null,
              }),
        })
        .where(eq(vacancies.id, vacancy.id))
        .catch(() => undefined);

      throw describeOlxPublishError(error);
    }
  });
