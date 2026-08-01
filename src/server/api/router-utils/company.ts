import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";

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
  isAdmin: boolean;
};

/** The company the user belongs to plus the role they hold in it. */
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
    .select({ companyId: users.companyId, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!membership?.companyId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "У вас не привязана компания",
    });
  }

  return {
    companyId: membership.companyId,
    role: membership.role,
    isAdmin: isCompanyAdmin(membership.role),
  };
}

/**
 * Same as `getCompanyMembership`, but rejects everyone except the company admin.
 *
 * Used by every mutation that changes company-wide state — members get the read-only view.
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

export async function ensureUserCompanyId(userId: string) {
  await db
    .insert(companies)
    .values({
      id: DEFAULT_COMPANY_ID,
      name: "Default Company",
    })
    .onConflictDoNothing({ target: companies.id });

  await db
    .update(users)
    .set({
      companyId: DEFAULT_COMPANY_ID,
    })
    .where(and(eq(users.id, userId), isNull(users.companyId)));

  const userRows = await db
    .select({ companyId: users.companyId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return userRows[0]?.companyId ?? DEFAULT_COMPANY_ID;
}
