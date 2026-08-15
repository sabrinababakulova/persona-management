import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, like, or, sql } from "drizzle-orm";
import type { db as database } from "~/server/db";
import { verificationTokens } from "~/server/db/schema";

const IDENTIFIER_PREFIX = "olx-connect";
const TICKET_TTL_MS = 15 * 60 * 1_000;

type Database = typeof database;

function digestTicket(ticket: string): string {
  return createHash("sha256").update(ticket).digest("base64url");
}

export async function createOlxConnectionTicket(
  db: Database,
  userId: string,
  extensionId: string,
): Promise<{ ticket: string; expiresAt: Date }> {
  const identifier = `${IDENTIFIER_PREFIX}:pending:${extensionId}:${userId}`;
  const ticket = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS);

  await db
    .delete(verificationTokens)
    .where(
      or(
        eq(verificationTokens.identifier, identifier),
        like(
          verificationTokens.identifier,
          `${IDENTIFIER_PREFIX}:verifying:%:${extensionId}:${userId}`,
        ),
      ),
    );
  await db.insert(verificationTokens).values({
    identifier,
    token: digestTicket(ticket),
    expires: expiresAt,
  });

  return { ticket, expiresAt };
}

export type ClaimedOlxConnectionTicket = {
  claimIdentifier: string;
  pendingIdentifier: string;
  tokenDigest: string;
  userId: string;
};

export async function claimOlxConnectionTicket(
  db: Database,
  ticket: string,
  extensionId: string,
): Promise<ClaimedOlxConnectionTicket | null> {
  const tokenDigest = digestTicket(ticket);
  const claimId = randomBytes(16).toString("base64url");
  const pendingPrefix = `${IDENTIFIER_PREFIX}:pending:${extensionId}:`;
  const claimPrefix = `${IDENTIFIER_PREFIX}:verifying:${claimId}:${extensionId}:`;
  const rows = await db
    .update(verificationTokens)
    .set({
      identifier: sql`${claimPrefix} || substring(${verificationTokens.identifier} from ${pendingPrefix.length + 1})`,
    })
    .where(
      and(
        eq(verificationTokens.token, tokenDigest),
        like(verificationTokens.identifier, `${pendingPrefix}%`),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .returning({ identifier: verificationTokens.identifier });

  const claimIdentifier = rows[0]?.identifier;
  if (!claimIdentifier?.startsWith(claimPrefix)) return null;
  const userId = claimIdentifier.slice(claimPrefix.length);
  if (!userId) return null;
  return {
    claimIdentifier,
    pendingIdentifier: `${pendingPrefix}${userId}`,
    tokenDigest,
    userId,
  };
}

export async function releaseOlxConnectionTicket(
  db: Database,
  claim: ClaimedOlxConnectionTicket,
): Promise<void> {
  await db
    .update(verificationTokens)
    .set({ identifier: claim.pendingIdentifier })
    .where(
      and(
        eq(verificationTokens.identifier, claim.claimIdentifier),
        eq(verificationTokens.token, claim.tokenDigest),
        gt(verificationTokens.expires, new Date()),
      ),
    );
}

export async function completeOlxConnectionTicket(
  db: Database,
  claim: ClaimedOlxConnectionTicket,
): Promise<void> {
  await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.identifier, claim.claimIdentifier),
        eq(verificationTokens.token, claim.tokenDigest),
      ),
    );
}
