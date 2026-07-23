import { eq } from "drizzle-orm";

import { userOlxAccounts } from "~/server/db/schema";

import { refreshOlxAccessToken } from "./oauth";
import { isOlxConfigured, OlxApiError } from "./shared";

type DatabaseClient = typeof import("~/server/db").db;

export class OlxReconnectRequiredError extends Error {
  constructor(message = "Переподключите OLX.uz в настройках интеграций") {
    super(message);
    this.name = "OlxReconnectRequiredError";
  }
}

export async function getUserOlxAccount(db: DatabaseClient, userId: string) {
  const rows = await db
    .select()
    .from(userOlxAccounts)
    .where(eq(userOlxAccounts.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

export async function resolveUserOlxAuth(db: DatabaseClient, userId: string) {
  const account = await getUserOlxAccount(db, userId);
  if (!account) {
    return null;
  }

  const expiresSoon =
    !account.accessTokenExpiresAt ||
    account.accessTokenExpiresAt.getTime() <= Date.now() + 60_000;
  if (account.accessToken && !expiresSoon) {
    return account;
  }

  if (!account.refreshToken || !isOlxConfigured()) {
    throw new OlxReconnectRequiredError();
  }

  try {
    const refreshed = await refreshOlxAccessToken(account.refreshToken);
    const refreshToken = refreshed.refreshToken ?? account.refreshToken;
    await db
      .update(userOlxAccounts)
      .set({
        accessToken: refreshed.accessToken,
        accessTokenExpiresAt: refreshed.expiresAt,
        refreshToken,
        scope: refreshed.scope,
      })
      .where(eq(userOlxAccounts.id, account.id));

    return {
      ...account,
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: refreshed.expiresAt,
      refreshToken,
      scope: refreshed.scope,
    };
  } catch (error) {
    if (
      error instanceof OlxApiError &&
      (error.code === "invalid_grant" ||
        error.code === "invalid_token" ||
        error.status === 401)
    ) {
      throw new OlxReconnectRequiredError();
    }
    throw error;
  }
}
