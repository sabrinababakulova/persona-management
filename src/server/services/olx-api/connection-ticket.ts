import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, like } from "drizzle-orm";
import type { db as database } from "~/server/db";
import { verificationTokens } from "~/server/db/schema";

const IDENTIFIER_PREFIX = "olx-connect:";
const TICKET_TTL_MS = 15 * 60 * 1_000;

type Database = typeof database;

function digestTicket(ticket: string): string {
  return createHash("sha256").update(ticket).digest("base64url");
}

export async function createOlxConnectionTicket(
  db: Database,
  userId: string,
): Promise<{ ticket: string; expiresAt: Date }> {
  const identifier = `${IDENTIFIER_PREFIX}${userId}`;
  const ticket = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TICKET_TTL_MS);

  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier));
  await db.insert(verificationTokens).values({
    identifier,
    token: digestTicket(ticket),
    expires: expiresAt,
  });

  return { ticket, expiresAt };
}

export async function consumeOlxConnectionTicket(
  db: Database,
  ticket: string,
): Promise<string | null> {
  const rows = await db
    .delete(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, digestTicket(ticket)),
        like(verificationTokens.identifier, `${IDENTIFIER_PREFIX}%`),
        gt(verificationTokens.expires, new Date()),
      ),
    )
    .returning({ identifier: verificationTokens.identifier });

  const identifier = rows[0]?.identifier;
  if (!identifier?.startsWith(IDENTIFIER_PREFIX)) return null;
  return identifier.slice(IDENTIFIER_PREFIX.length) || null;
}
