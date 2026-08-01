/** 32 random bytes, base64url-encoded — see `generateInvitationToken`. */
const INVITATION_TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/;

export function isInvitationTokenValid(token: string): boolean {
  return INVITATION_TOKEN_REGEX.test(token);
}

/**
 * Path of the invite landing page.
 *
 * Always validate the token first — the result is used as a redirect target, and only the
 * fixed token alphabet keeps it from pointing somewhere else.
 */
export function buildInvitePath(token: string): string {
  return `/invite/${token}`;
}
