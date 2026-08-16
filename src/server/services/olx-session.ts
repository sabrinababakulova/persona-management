import "server-only";

import { and, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { userOlxSessions } from "~/server/db/schema";

export async function hasConnectedOlxSession(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: userOlxSessions.id })
    .from(userOlxSessions)
    .where(
      and(
        eq(userOlxSessions.userId, userId),
        eq(userOlxSessions.status, "connected"),
      ),
    )
    .limit(1);

  return Boolean(rows[0]);
}
