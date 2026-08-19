import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

import { ensureCompanyTelegramResumeWarehouse } from "~/server/company/telegram-resume-warehouse";
import { db } from "~/server/db";
import { companies, users } from "~/server/db/schema";
import { isCompanyAdmin } from "~/shared/company-roles";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";

type DatabaseClient = typeof import("~/server/db").db;

export async function getOptionalCompanyId(
  database: DatabaseClient,
  userId: string | undefined,
) {
  if (!userId) {
    return null;
  }

  const userRows = await database
    .select({ companyId: users.companyId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return userRows[0]?.companyId ?? null;
}

export async function getRequiredCompanyId(
  database: DatabaseClient,
  userId: string | undefined,
) {
  const companyId = await getOptionalCompanyId(database, userId);

  if (!companyId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "У вас не привязана компания",
    });
  }

  return companyId;
}

export type CompanyMembership = {
  companyId: string;
  role: string;
  /** Created the company — outranks `isAdmin` and keeps its rights whatever the role says. */
  isMaster: boolean;
  /** May edit the company and invite people. The master account always counts as one. */
  isAdmin: boolean;
};

/** The company the user belongs to plus the rights they hold in it. */
export async function getCompanyMembership(
  database: DatabaseClient,
  userId: string | undefined,
): Promise<CompanyMembership> {
  if (!userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Пользователь не авторизован",
    });
  }

  const [membership] = await database
    .select({
      companyId: users.companyId,
      role: users.role,
      isMasterAccount: users.isMasterAccount,
      deactivatedAt: users.deactivatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (membership?.deactivatedAt) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Ваш доступ к компании отключен",
    });
  }

  if (!membership?.companyId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "У вас не привязана компания",
    });
  }

  return {
    companyId: membership.companyId,
    role: membership.role,
    isMaster: membership.isMasterAccount,
    isAdmin: membership.isMasterAccount || isCompanyAdmin(membership.role),
  };
}

/**
 * Same as `getCompanyMembership`, but rejects everyone below admin.
 *
 * Used by mutations that change company-wide state — company profile and invitation links.
 */
export async function requireCompanyAdmin(
  database: DatabaseClient,
  userId: string | undefined,
): Promise<CompanyMembership> {
  const membership = await getCompanyMembership(database, userId);

  if (!membership.isAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Только администратор компании может изменять эти данные",
    });
  }

  return membership;
}

/**
 * Rejects everyone except the master account.
 *
 * Managing people — their roles and their access — belongs to whoever created the company;
 * admins can invite, but not touch existing members.
 */
export async function requireCompanyMaster(
  database: DatabaseClient,
  userId: string | undefined,
): Promise<CompanyMembership> {
  const membership = await getCompanyMembership(database, userId);

  if (!membership.isMaster) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Управлять участниками может только владелец компании",
    });
  }

  return membership;
}

export async function ensureUserCompanyId(userId: string) {
  return db.transaction(async (transaction) => {
    await transaction
      .insert(companies)
      .values({
        id: DEFAULT_COMPANY_ID,
        name: "Default Company",
      })
      .onConflictDoNothing({ target: companies.id });

    await ensureCompanyTelegramResumeWarehouse(transaction, DEFAULT_COMPANY_ID);
    await transaction
      .update(users)
      .set({
        companyId: DEFAULT_COMPANY_ID,
      })
      .where(and(eq(users.id, userId), isNull(users.companyId)));

    const userRows = await transaction
      .select({ companyId: users.companyId })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return userRows[0]?.companyId ?? DEFAULT_COMPANY_ID;
  });
}
