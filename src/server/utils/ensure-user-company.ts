import { and, eq, isNull } from "drizzle-orm";

import { db } from "~/server/db";
import { companies, users } from "~/server/db/schema";
import { DEFAULT_COMPANY_ID } from "~/shared/default-company";

export async function ensureUserCompanyId(userId: string): Promise<string> {
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
