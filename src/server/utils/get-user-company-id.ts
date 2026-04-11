import { eq } from "drizzle-orm";

import { users } from "~/server/db/schema";

type DatabaseClient = typeof import("~/server/db").db;

export async function getUserCompanyId(
  db: DatabaseClient,
  userId: string | undefined,
) {
  if (!userId) {
    return null;
  }

  const userRows = await db
    .select({ companyId: users.companyId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return userRows[0]?.companyId ?? null;
}
