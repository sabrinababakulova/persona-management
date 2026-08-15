import { TRPCError } from "@trpc/server";
import { eq, sql } from "drizzle-orm";
import { env } from "~/env";
import { takeRateLimitSlot } from "~/server/auth/rate-limit";
import { userOlxSessions } from "~/server/db/schema";
import {
  decryptStoredOlxCredentials,
  encryptStoredOlxCredentials,
  OlxApiError,
  type OlxCredentials,
} from "~/server/services/olx-api";

const OLX_LIFECYCLE_COOLDOWN_MS = 10 * 1000;
const OLX_LIFECYCLE_WINDOW_MS = 60 * 60 * 1000;
const OLX_LIFECYCLE_ACTION_LIMIT = 20;

type DatabaseClient = typeof import("~/server/db").db;

export type OlxLifecycleAction = "activate" | "deactivate" | "delete";

type OlxOperationResult = {
  credentials: OlxCredentials;
};

export async function enforceOlxLifecycleRateLimit(accountUserId: string) {
  // Limit the connected OLX account. The shared cooldown also prevents rapid
  // toggling from concurrent tabs belonging to its owner.
  const cooldownKey = `olx-lifecycle-cooldown:${accountUserId}`;
  const hourlyKey = `olx-lifecycle-actions:${accountUserId}`;
  if (
    !(await takeRateLimitSlot(cooldownKey, 1, OLX_LIFECYCLE_COOLDOWN_MS)) ||
    !(await takeRateLimitSlot(
      hourlyKey,
      OLX_LIFECYCLE_ACTION_LIMIT,
      OLX_LIFECYCLE_WINDOW_MS,
    ))
  ) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "Слишком много действий с olx.uz. Подождите несколько секунд и повторите.",
    });
  }
}

/**
 * Resolves the publishing user's saved OLX credentials, persists token rotation,
 * and marks rejected credentials for reconnection without exposing them to the caller.
 */
export async function runOlxOperation<T extends OlxOperationResult>(
  database: DatabaseClient,
  publisherUserId: string,
  operation: (credentials: OlxCredentials) => Promise<T>,
): Promise<T> {
  if (!env.OLX_CREDENTIALS_ENCRYPTION_KEY && env.NODE_ENV !== "test") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Хранилище учётных данных olx.uz не настроено.",
    });
  }
  const outcome = await database.transaction(async (transaction) => {
    // Refresh tokens rotate. Keep one operation per connected account in flight
    // across all application instances so an older response cannot overwrite a
    // newer token set.
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`olx-account:${publisherUserId}`}, 0))`,
    );

    const [session] = await transaction
      .select()
      .from(userOlxSessions)
      .where(eq(userOlxSessions.userId, publisherUserId))
      .limit(1);

    if (!session || session.status !== "connected") {
      return {
        error: new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Подключите аккаунт olx.uz, с которого было опубликовано объявление.",
        }),
      } as const;
    }

    let credentials: OlxCredentials;
    try {
      credentials = decryptStoredOlxCredentials(
        session.encryptedStorageState,
        session.userId,
        session.id,
      );
    } catch {
      await transaction
        .update(userOlxSessions)
        .set({
          status: "reauth_required",
          lastOperationAt: new Date(),
          lastError: "credential_decryption_failed",
        })
        .where(eq(userOlxSessions.id, session.id));
      return {
        error: new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Сохранённый доступ olx.uz недействителен. Подключите аккаунт заново.",
        }),
      } as const;
    }

    try {
      const result = await operation(credentials);
      const now = new Date();
      await transaction
        .update(userOlxSessions)
        .set({
          encryptedStorageState: encryptStoredOlxCredentials(
            result.credentials,
            session.userId,
            session.id,
          ),
          status: "connected",
          lastVerifiedAt: now,
          lastOperationAt: now,
          lastError: null,
        })
        .where(eq(userOlxSessions.id, session.id));
      return { result } as const;
    } catch (error) {
      const requiresReconnect =
        error instanceof OlxApiError && error.code === "reauth_required";
      await transaction
        .update(userOlxSessions)
        .set({
          status: requiresReconnect ? "reauth_required" : session.status,
          lastOperationAt: new Date(),
          lastError: safeOlxLifecycleError(error),
        })
        .where(eq(userOlxSessions.id, session.id));
      return { error } as const;
    }
  });

  if ("error" in outcome) throw outcome.error;
  return outcome.result;
}

export function safeOlxLifecycleError(error: unknown): string {
  return error instanceof OlxApiError
    ? `api:${error.code}`
    : "unexpected_lifecycle_error";
}

export function describeOlxLifecycleError(
  error: unknown,
  action: OlxLifecycleAction,
): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }
  if (error instanceof OlxApiError) {
    if (error.code === "reauth_required") {
      return new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Доступ olx.uz истёк. Подключите аккаунт заново в настройках компании.",
      });
    }
    if (error.code === "rate_limited") {
      return new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "olx.uz временно ограничил запросы. Повторите позже.",
      });
    }
    if (error.code === "not_found") {
      return new TRPCError({
        code: "NOT_FOUND",
        message: "Объявление не найдено в подключённом аккаунте olx.uz.",
      });
    }
    if (error.code === "validation_failed") {
      const details = error.validation.length
        ? ` ${error.validation.join("; ")}`
        : "";
      const message =
        action === "delete"
          ? "olx.uz не удалил объявление. Сначала деактивируйте его."
          : action === "activate"
            ? "olx.uz не активировал объявление."
            : "olx.uz не деактивировал объявление.";
      return new TRPCError({
        code: "BAD_REQUEST",
        message: `${message}${details}`,
      });
    }
    return new TRPCError({
      code: "BAD_GATEWAY",
      message: "olx.uz сейчас не отвечает. Попробуйте позже.",
    });
  }

  console.error("Unexpected OLX lifecycle error", { action, error });
  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Не удалось выполнить действие с объявлением olx.uz.",
  });
}
