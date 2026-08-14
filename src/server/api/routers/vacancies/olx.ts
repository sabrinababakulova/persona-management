import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { env } from "~/env";
import { getRequiredCompanyId } from "~/server/api/router-utils/company";
import { protectedProcedure } from "~/server/api/trpc";
import {
  hasActiveRecord,
  isRateLimited,
  recordAttempt,
  setMarker,
} from "~/server/auth/rate-limit";
import { userOlxSessions, vacancies } from "~/server/db/schema";
import {
  decryptOlxCredentials,
  encryptOlxCredentials,
  getOlxJobCategories,
  OlxApiError,
  type OlxCredentials,
  searchOlxLocations,
  submitOlxOffer,
} from "~/server/services/olx-api";
import { olxPublicationMetaSchema } from "./schemas";
import { isUserVisibleVacancy } from "./shared";

const OLX_ACTION_COOLDOWN_MS = 30 * 1000;
const OLX_ACTION_WINDOW_MS = 60 * 60 * 1000;

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
  .query(async ({ input }) => {
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
      (await hasActiveRecord(cooldownKey)) ||
      (await isRateLimited(hourlyKey, 10))
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

    let credentials: OlxCredentials;
    try {
      credentials = decryptOlxCredentials(
        session.encryptedStorageState,
        env.AUTH_SECRET,
      );
    } catch {
      await ctx.db
        .update(userOlxSessions)
        .set({
          status: "reauth_required",
          lastOperationAt: new Date(),
          lastError: "credential_decryption_failed",
        })
        .where(eq(userOlxSessions.id, session.id));
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Сохранённый доступ olx.uz недействителен. Подключите аккаунт заново.",
      });
    }

    await Promise.all([
      recordAttempt(hourlyKey, OLX_ACTION_WINDOW_MS),
      setMarker(cooldownKey, OLX_ACTION_COOLDOWN_MS),
    ]);

    try {
      const submitted = await submitOlxOffer({
        credentials,
        dryRun: input.dryRun,
        advert: {
          title: vacancy.title,
          descriptionHtml: vacancy.descriptionHtml ?? "",
          salaryFrom: vacancy.salaryFrom,
          salaryTo: vacancy.salaryTo,
          salaryCurrency: vacancy.salaryCurrency === "USD" ? "USD" : "UZS",
          meta: parsedMeta.data,
        },
      });
      const now = new Date();

      await ctx.db
        .update(userOlxSessions)
        .set({
          encryptedStorageState: encryptOlxCredentials(
            submitted.credentials,
            env.AUTH_SECRET,
          ),
          status: "connected",
          lastVerifiedAt: now,
          lastOperationAt: now,
          lastError: null,
        })
        .where(eq(userOlxSessions.id, session.id));

      if (submitted.result.mode === "published") {
        await ctx.db
          .update(vacancies)
          .set({
            olxAdvertUrl: submitted.result.advertUrl,
            olxAdvertId: submitted.result.advertId,
            olxLastPublishedAt: now,
            olxLastError: null,
            isActive: true,
          })
          .where(eq(vacancies.id, vacancy.id));
      } else {
        await ctx.db
          .update(vacancies)
          .set({ olxLastError: null })
          .where(eq(vacancies.id, vacancy.id));
      }

      return submitted.result;
    } catch (error) {
      const reauthenticationNeeded =
        error instanceof OlxApiError && error.code === "reauth_required";
      const safeError =
        error instanceof OlxApiError
          ? `api:${error.code}`
          : error instanceof Error && error.message.startsWith("OLX_")
            ? `input:${error.message}`
            : "unexpected_api_error";

      await Promise.all([
        ctx.db
          .update(vacancies)
          .set({ olxLastError: safeError })
          .where(eq(vacancies.id, vacancy.id)),
        ctx.db
          .update(userOlxSessions)
          .set({
            status: reauthenticationNeeded ? "reauth_required" : session.status,
            lastOperationAt: new Date(),
            lastError: safeError,
          })
          .where(eq(userOlxSessions.id, session.id)),
      ]);

      throw describeOlxPublishError(error);
    }
  });
