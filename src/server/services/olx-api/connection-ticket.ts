import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, like, or } from "drizzle-orm";
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

  return db.transaction(async (transaction) => {
    const pendingRows = await transaction
      .select({ identifier: verificationTokens.identifier })
      .from(verificationTokens)
      .where(
        and(
          eq(verificationTokens.token, tokenDigest),
          like(verificationTokens.identifier, `${pendingPrefix}%`),
          gt(verificationTokens.expires, new Date()),
        ),
      )
      .limit(1)
      .for("update");

    const pendingIdentifier = pendingRows[0]?.identifier;
    if (!pendingIdentifier?.startsWith(pendingPrefix)) return null;

    const userId = pendingIdentifier.slice(pendingPrefix.length);
    if (!userId) return null;

    const claimIdentifier = `${claimPrefix}${userId}`;
    const claimedRows = await transaction
      .update(verificationTokens)
      .set({ identifier: claimIdentifier })
      .where(
        and(
          eq(verificationTokens.identifier, pendingIdentifier),
          eq(verificationTokens.token, tokenDigest),
          gt(verificationTokens.expires, new Date()),
        ),
      )
      .returning({ identifier: verificationTokens.identifier });

    if (claimedRows[0]?.identifier !== claimIdentifier) return null;
    return {
      claimIdentifier,
      pendingIdentifier,
      tokenDigest,
      userId,
    };
  });
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
