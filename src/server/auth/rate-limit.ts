import { and, count, eq, gt, lt } from "drizzle-orm";
import { db } from "~/server/db";
import { verificationTokens } from "~/server/db/schema";
import { generateRateLimitToken } from "./email-verification";

async function pruneExpiredRecords(identifier: string) {
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        lt(verificationTokens.expires, new Date()),
      ),
    )
    .catch(() => undefined);
}

export async function getActiveRecordsCount(identifier: string) {
  await pruneExpiredRecords(identifier);

  const [row] = await db
    .select({ count: count() })
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, identifier),
        gt(verificationTokens.expires, new Date()),
      ),
    );

  return Number(row?.count ?? 0);
}

export async function hasActiveRecord(identifier: string) {
  return (await getActiveRecordsCount(identifier)) > 0;
}

export async function isRateLimited(identifier: string, maxAttempts: number) {
  return (await getActiveRecordsCount(identifier)) >= maxAttempts;
}

export async function recordAttempt(identifier: string, windowMs: number) {
  await pruneExpiredRecords(identifier);

  await db.insert(verificationTokens).values({
    identifier,
    token: generateRateLimitToken(),
    expires: new Date(Date.now() + windowMs),
  });
}

export async function setMarker(identifier: string, ttlMs: number) {
  await pruneExpiredRecords(identifier);

  await db.insert(verificationTokens).values({
    identifier,
    token: generateRateLimitToken(),
    expires: new Date(Date.now() + ttlMs),
  });
}

export async function clearIdentifier(identifier: string) {
  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier));
}
