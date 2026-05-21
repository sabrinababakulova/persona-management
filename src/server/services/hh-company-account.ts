import { and, eq, isNotNull } from "drizzle-orm";

import { userHhAccounts, users } from "~/server/db/schema";
import {
  isHhConfigured,
  refreshHhAccessToken,
  resolveHhEmployerFromAccessToken,
} from "~/server/services/hh";

type DatabaseClient = typeof import("~/server/db").db;

export async function getUserHhAccount(db: DatabaseClient, userId: string) {
  const rows = await db
    .select({
      id: userHhAccounts.id,
      accessToken: userHhAccounts.accessToken,
      refreshToken: userHhAccounts.refreshToken,
      employerId: userHhAccounts.employerId,
      email: userHhAccounts.email,
    })
    .from(userHhAccounts)
    .where(eq(userHhAccounts.userId, userId))
    .limit(1);

  return rows[0] ?? null;
}

export async function resolveUserHhAuth(db: DatabaseClient, userId: string) {
  const account = await getUserHhAccount(db, userId);
  if (!account) {
    return null;
  }

  let accessToken = account.accessToken ?? undefined;
  let refreshToken = account.refreshToken ?? undefined;
  let employerId = account.employerId?.trim();

  if (!accessToken && refreshToken && isHhConfigured() && account.id) {
    try {
      const refreshed = await refreshHhAccessToken(refreshToken);
      accessToken = refreshed.accessToken;
      refreshToken = refreshed.refreshToken ?? undefined;

      await db
        .update(userHhAccounts)
        .set({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
        })
        .where(eq(userHhAccounts.id, account.id));
    } catch (error) {
      console.error("Failed to refresh HH access token", {
        userId,
        error,
      });
    }
  }

  if (!employerId && accessToken && isHhConfigured() && account.id) {
    try {
      const resolvedAccount =
        await resolveHhEmployerFromAccessToken(accessToken);
      employerId = resolvedAccount.employerId;

      await db
        .update(userHhAccounts)
        .set({
          email: resolvedAccount.email,
          employerId: resolvedAccount.employerId,
        })
        .where(eq(userHhAccounts.id, account.id));
    } catch (resolveError) {
      if (refreshToken) {
        try {
          const refreshed = await refreshHhAccessToken(refreshToken);
          const resolvedAccount = await resolveHhEmployerFromAccessToken(
            refreshed.accessToken,
          );
          accessToken = refreshed.accessToken;
          refreshToken = refreshed.refreshToken ?? undefined;
          employerId = resolvedAccount.employerId;

          await db
            .update(userHhAccounts)
            .set({
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              email: resolvedAccount.email,
              employerId: resolvedAccount.employerId,
            })
            .where(eq(userHhAccounts.id, account.id));
        } catch (refreshError) {
          console.error("Failed to resolve HH employer after refresh", {
            userId,
            error: refreshError,
          });
        }
      } else {
        console.error("Failed to resolve HH employer", {
          userId,
          error: resolveError,
        });
      }
    }
  }

  return {
    ...account,
    accessToken,
    refreshToken,
    employerId,
  };
}

/**
 * Resolves an hh.uz access token usable for a whole company.
 *
 * hh accounts are stored per user; the enrichment worker runs outside any user
 * session, so it picks any connected account belonging to the company. hh.uz
 * resume ids are global, so any valid employer token can read them.
 */
export async function resolveCompanyHhAuth(
  db: DatabaseClient,
  companyId: string,
) {
  const rows = await db
    .select({ userId: userHhAccounts.userId })
    .from(userHhAccounts)
    .innerJoin(users, eq(users.id, userHhAccounts.userId))
    .where(
      and(
        eq(users.companyId, companyId),
        isNotNull(userHhAccounts.refreshToken),
      ),
    )
    .limit(1);

  const userId = rows[0]?.userId;
  if (!userId) {
    return null;
  }

  return resolveUserHhAuth(db, userId);
}
