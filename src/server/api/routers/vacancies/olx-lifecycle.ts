import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { env } from "~/env";
import {
  hasActiveRecord,
  isRateLimited,
  recordAttempt,
  setMarker,
} from "~/server/auth/rate-limit";
import { userOlxSessions } from "~/server/db/schema";
import {
  decryptOlxCredentials,
  encryptOlxCredentials,
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
  // Limit the connected OLX account, not the teammate clicking the action.
  // Otherwise several Persona users could unintentionally bypass the cap for
  // the same OLX account. The shared cooldown also prevents rapid toggling.
  const cooldownKey = `olx-lifecycle-cooldown:${accountUserId}`;
  const hourlyKey = `olx-lifecycle-actions:${accountUserId}`;
  if (
    (await hasActiveRecord(cooldownKey)) ||
    (await isRateLimited(hourlyKey, OLX_LIFECYCLE_ACTION_LIMIT))
  ) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message:
        "Слишком много действий с olx.uz. Подождите несколько секунд и повторите.",
    });
  }

  await Promise.all([
    recordAttempt(hourlyKey, OLX_LIFECYCLE_WINDOW_MS),
    setMarker(cooldownKey, OLX_LIFECYCLE_COOLDOWN_MS),
  ]);
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
  const [session] = await database
    .select()
    .from(userOlxSessions)
    .where(eq(userOlxSessions.userId, publisherUserId))
    .limit(1);

  if (!session || session.status !== "connected") {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "Подключите аккаунт olx.uz, с которого было опубликовано объявление.",
    });
  }

  let credentials: OlxCredentials;
  try {
    credentials = decryptOlxCredentials(
      session.encryptedStorageState,
      env.AUTH_SECRET,
    );
  } catch {
    await database
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

  try {
    const result = await operation(credentials);
    const now = new Date();
    await database
      .update(userOlxSessions)
      .set({
        encryptedStorageState: encryptOlxCredentials(
          result.credentials,
          env.AUTH_SECRET,
        ),
        status: "connected",
        lastVerifiedAt: now,
        lastOperationAt: now,
        lastError: null,
      })
      .where(eq(userOlxSessions.id, session.id));
    return result;
  } catch (error) {
    const requiresReconnect =
      error instanceof OlxApiError && error.code === "reauth_required";
    await database
      .update(userOlxSessions)
      .set({
        status: requiresReconnect ? "reauth_required" : session.status,
        lastOperationAt: new Date(),
        lastError: safeOlxLifecycleError(error),
      })
      .where(eq(userOlxSessions.id, session.id));
    throw error;
  }
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
