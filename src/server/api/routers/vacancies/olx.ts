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
  decryptOlxStorageState,
  htmlToOlxPlainText,
  OlxBrowserFlowError,
  OlxBrowserRuntimeError,
  type OlxStorageState,
  publishOlxAdvertWithBrowser,
  resolveOlxBrowserExecutable,
} from "~/server/services/olx-browser";
import { isUserVisibleVacancy } from "./shared";

const OLX_ACTION_COOLDOWN_MS = 30 * 1000;
const OLX_ACTION_WINDOW_MS = 60 * 60 * 1000;

const olxPublishInputSchema = z.object({
  id: z.string().min(1).max(255),
  /** Fills and validates the live form, then closes Chrome without submitting. */
  dryRun: z.boolean().default(true),
});

function describeOlxPublishError(error: unknown): TRPCError {
  if (error instanceof OlxBrowserRuntimeError) {
    if (error.code === "busy") {
      return new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "Сейчас выполняется другая операция OLX.uz. Дождитесь её завершения.",
      });
    }
    if (error.code === "unavailable") {
      return new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Chrome/Chromium для OLX.uz не найден на сервере. Настройте OLX_BROWSER_EXECUTABLE_PATH.",
      });
    }
    return new TRPCError({
      code: "TIMEOUT",
      message: "OLX.uz не ответил вовремя. Попробуйте позже.",
    });
  }

  if (error instanceof OlxBrowserFlowError) {
    const messageByCode: Record<typeof error.code, string> = {
      invalid_credentials: "OLX.uz отклонил данные входа.",
      challenge_required:
        "OLX.uz запросил CAPTCHA или код подтверждения. Автоматизация остановлена; подключите аккаунт заново после проверки.",
      reauth_required:
        "Сессия OLX.uz истекла. Подключите аккаунт заново в настройках профиля.",
      form_changed:
        "Форма OLX.uz изменилась или указанное значение не найдено. Объявление не отправлено.",
      publish_failed:
        "OLX.uz не подтвердил публикацию. Объявление не было отмечено опубликованным в Persona.",
    };
    return new TRPCError({
      code:
        error.code === "reauth_required" || error.code === "challenge_required"
          ? "PRECONDITION_FAILED"
          : "BAD_REQUEST",
      message: messageByCode[error.code],
    });
  }

  console.error("Unexpected OLX browser publication error", error);
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Не удалось обработать публикацию OLX.uz.",
  });
}

export const getOlxBrowserConfigProcedure = protectedProcedure.query(
  async ({ ctx }) => {
    const rows = await ctx.db
      .select({ status: userOlxSessions.status })
      .from(userOlxSessions)
      .where(eq(userOlxSessions.userId, ctx.session.user.id))
      .limit(1);

    return {
      browserAvailable: Boolean(resolveOlxBrowserExecutable()),
      connected: rows[0]?.status === "connected",
      status: rows[0]?.status ?? null,
    };
  },
);

export const publishOlxBrowserProcedure = protectedProcedure
  .input(olxPublishInputSchema)
  .mutation(async ({ ctx, input }) => {
    const userId = ctx.session.user.id;
    const companyId = await getRequiredCompanyId(ctx.db, userId);
    const action = input.dryRun ? "preview" : "publish";
    const cooldownKey = `olx-${action}-cooldown:${userId}`;
    const hourlyKey = `olx-browser-actions:${userId}`;

    if (
      (await hasActiveRecord(cooldownKey)) ||
      (await isRateLimited(hourlyKey, 10))
    ) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message:
          "OLX.uz запускается только по явному действию и не чаще одного раза в 30 секунд. Подождите и повторите.",
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
        message: "Публикация OLX.uz не найдена.",
      });
    }
    if (!vacancy.olxBrowserMeta) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Заполните параметры публикации OLX.uz.",
      });
    }
    if (!htmlToOlxPlainText(vacancy.descriptionHtml ?? "")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Заполните описание публикации OLX.uz.",
      });
    }
    if (!input.dryRun && vacancy.olxAdvertUrl) {
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Эта версия уже опубликована на OLX.uz. Откройте существующее объявление, чтобы избежать дубликата.",
      });
    }

    const session = sessionRows[0];
    if (!session || session.status !== "connected") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Подключите OLX.uz аккаунт в настройках профиля.",
      });
    }

    await Promise.all([
      recordAttempt(hourlyKey, OLX_ACTION_WINDOW_MS),
      setMarker(cooldownKey, OLX_ACTION_COOLDOWN_MS),
    ]);

    let storageState: OlxStorageState;
    try {
      storageState = decryptOlxStorageState<OlxStorageState>(
        session.encryptedStorageState,
        env.AUTH_SECRET,
      );
    } catch {
      await ctx.db
        .update(userOlxSessions)
        .set({
          status: "reauth_required",
          lastOperationAt: new Date(),
          lastError: "session_decryption_failed",
        })
        .where(eq(userOlxSessions.id, session.id));
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Сохранённая сессия OLX.uz больше недействительна. Подключите аккаунт заново.",
      });
    }

    try {
      const result = await publishOlxAdvertWithBrowser({
        storageState,
        dryRun: input.dryRun,
        advert: {
          title: vacancy.title,
          descriptionHtml: vacancy.descriptionHtml ?? "",
          salaryFrom: vacancy.salaryFrom,
          salaryTo: vacancy.salaryTo,
          salaryCurrency: vacancy.salaryCurrency === "USD" ? "USD" : "UZS",
          meta: vacancy.olxBrowserMeta,
        },
      });
      const now = new Date();

      await ctx.db
        .update(userOlxSessions)
        .set({
          status: "connected",
          lastVerifiedAt: now,
          lastOperationAt: now,
          lastError: null,
        })
        .where(eq(userOlxSessions.id, session.id));

      if (result.mode === "published") {
        await ctx.db
          .update(vacancies)
          .set({
            olxAdvertUrl: result.advertUrl,
            olxAdvertId: result.advertId,
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

      return result;
    } catch (error) {
      const reauthenticationNeeded =
        error instanceof OlxBrowserFlowError &&
        (error.code === "reauth_required" ||
          error.code === "challenge_required");
      const safeError =
        error instanceof OlxBrowserFlowError
          ? `flow:${error.code}`
          : error instanceof OlxBrowserRuntimeError
            ? `runtime:${error.code}`
            : "unexpected_browser_error";

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
