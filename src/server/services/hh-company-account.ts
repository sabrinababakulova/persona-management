import { eq } from "drizzle-orm";

import { companyHhAccounts } from "~/server/db/schema";
import {
  isHhConfigured,
  refreshHhAccessToken,
  resolveHhEmployerFromAccessToken,
} from "~/server/services/hh";

type DatabaseClient = typeof import("~/server/db").db;

export async function getCompanyHhAccount(
  db: DatabaseClient,
  companyId: string,
) {
  const rows = await db
    .select({
      id: companyHhAccounts.id,
      accessToken: companyHhAccounts.accessToken,
      refreshToken: companyHhAccounts.refreshToken,
      employerId: companyHhAccounts.employerId,
      email: companyHhAccounts.email,
    })
    .from(companyHhAccounts)
    .where(eq(companyHhAccounts.companyId, companyId))
    .limit(1);

  return rows[0] ?? null;
}

export async function resolveCompanyHhAuth(
  db: DatabaseClient,
  companyId: string,
) {
  const account = await getCompanyHhAccount(db, companyId);
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
        .update(companyHhAccounts)
        .set({
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken,
        })
        .where(eq(companyHhAccounts.id, account.id));
    } catch (error) {
      console.error("Failed to refresh HH access token", {
        companyId,
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
        .update(companyHhAccounts)
        .set({
          email: resolvedAccount.email,
          employerId: resolvedAccount.employerId,
        })
        .where(eq(companyHhAccounts.id, account.id));
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
            .update(companyHhAccounts)
            .set({
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              email: resolvedAccount.email,
              employerId: resolvedAccount.employerId,
            })
            .where(eq(companyHhAccounts.id, account.id));
        } catch (refreshError) {
          console.error("Failed to resolve HH employer after refresh", {
            companyId,
            error: refreshError,
          });
        }
      } else {
        console.error("Failed to resolve HH employer", {
          companyId,
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
