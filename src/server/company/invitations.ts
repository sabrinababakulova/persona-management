import { eq, sql } from "drizzle-orm";

import { db } from "~/server/db";
import { companies, companyInvitations } from "~/server/db/schema";
import { isInvitationTokenValid } from "~/shared/invitation-token";

/** How long a freshly generated invitation link stays usable. */
export const INVITATION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** Upper bound on simultaneously active links per company — keeps stale links from piling up. */
export const MAX_ACTIVE_INVITATIONS = 10;

/** 32 random bytes, base64url-encoded (43 chars, no padding). */
export function generateInvitationToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Buffer.from(bytes).toString("base64url");
}

export type UsableInvitation = {
  id: string;
  companyId: string;
  companyName: string;
};

/**
 * Resolves a raw token to the company it grants access to.
 *
 * Returns `null` for unknown, revoked or expired tokens — callers should treat every falsy
 * result the same way so an attacker cannot tell them apart.
 */
export async function findUsableInvitation(
  token: string,
): Promise<UsableInvitation | null> {
  if (!isInvitationTokenValid(token)) {
    return null;
  }

  const [invitation] = await db
    .select({
      id: companyInvitations.id,
      companyId: companyInvitations.companyId,
      companyName: companies.name,
      expiresAt: companyInvitations.expiresAt,
      revokedAt: companyInvitations.revokedAt,
    })
    .from(companyInvitations)
    .innerJoin(companies, eq(companies.id, companyInvitations.companyId))
    .where(eq(companyInvitations.token, token))
    .limit(1);

  if (
    !invitation ||
    invitation.revokedAt ||
    invitation.expiresAt.getTime() <= Date.now()
  ) {
    return null;
  }

  return {
    id: invitation.id,
    companyId: invitation.companyId,
    companyName: invitation.companyName,
  };
}

/** Bumps the usage counters. Best-effort: a failure here must not fail the join itself. */
export async function markInvitationUsed(invitationId: string): Promise<void> {
  await db
    .update(companyInvitations)
    .set({
      usesCount: sql`${companyInvitations.usesCount} + 1`,
      lastUsedAt: new Date(),
    })
    .where(eq(companyInvitations.id, invitationId))
    .catch((error) => {
      console.error("Failed to record invitation usage", {
        error,
        invitationId,
      });
    });
}
