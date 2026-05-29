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

/** A connected hh.uz employer account usable for company-wide sync. */
export type CompanyHhAccount = { accessToken: string; employerId: string };

/**
 * Resolves every hh.uz employer account connected within a company.
 *
 * A company can have several users, each connecting their own hh.uz employer
 * account. Sync must cover them all. Accounts are deduped by `employerId` so
 * the same employer connected by two users is only processed once.
 */
export async function resolveCompanyHhAccounts(
  db: DatabaseClient,
  companyId: string,
): Promise<CompanyHhAccount[]> {
  const rows = await db
    .select({ userId: userHhAccounts.userId })
    .from(userHhAccounts)
    .innerJoin(users, eq(users.id, userHhAccounts.userId))
    .where(
      and(
        eq(users.companyId, companyId),
        isNotNull(userHhAccounts.refreshToken),
      ),
    );

  const byEmployer = new Map<string, CompanyHhAccount>();
  for (const row of rows) {
    const auth = await resolveUserHhAuth(db, row.userId);
    if (
      auth?.accessToken &&
      auth.employerId &&
      !byEmployer.has(auth.employerId)
    ) {
      byEmployer.set(auth.employerId, {
        accessToken: auth.accessToken,
        employerId: auth.employerId,
      });
    }
  }

  return [...byEmployer.values()];
}

/** Ids of every company that has at least one connected hh.uz account. */
export async function listHhConnectedCompanyIds(
  db: DatabaseClient,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ companyId: users.companyId })
    .from(userHhAccounts)
    .innerJoin(users, eq(users.id, userHhAccounts.userId))
    .where(isNotNull(userHhAccounts.refreshToken));

  return rows
    .map((row) => row.companyId)
    .filter((id): id is string => Boolean(id));
}
