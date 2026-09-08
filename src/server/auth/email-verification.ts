import { createHmac, randomInt, randomUUID } from "node:crypto";
import "server-only";
import { env } from "~/env";

export const EMAIL_VERIFICATION_CODE_LENGTH = 6;
export const EMAIL_VERIFICATION_CODE_TTL_MS = 10 * 60 * 1000;
export const EMAIL_VERIFICATION_FLOW_TTL_MS = 30 * 60 * 1000;

export const REGISTER_RATE_LIMIT_MAX_ATTEMPTS = 3;
export const REGISTER_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const REGISTER_RESEND_COOLDOWN_MS = 60 * 1000;

export const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export const VERIFY_RATE_LIMIT_MAX_ATTEMPTS = 8;
export const VERIFY_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Per-IP ceilings, deliberately far higher than their per-identity counterparts.
 *
 * An IP is shared: an office behind NAT, a mobile carrier, a school. The per-account limits
 * above are the precise control — these exist only to blunt a spray across many accounts from
 * one source, so they are set where no plausible group of real users reaches them.
 *
 * They also, unlike the per-account counters, survive a successful sign-in. Clearing them on
 * success let an attacker who owned a single valid credential reset the budget for every other
 * account they were guessing from the same address.
 */
export const LOGIN_IP_RATE_LIMIT_MAX_ATTEMPTS = 60;
export const REGISTER_IP_RATE_LIMIT_MAX_ATTEMPTS = 20;
export const VERIFY_IP_RATE_LIMIT_MAX_ATTEMPTS = 50;

export const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;
export const PASSWORD_RESET_FLOW_TTL_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_REQUEST_MAX_ATTEMPTS = 3;
export const PASSWORD_RESET_REQUEST_WINDOW_MS = 60 * 60 * 1000;
export const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;
export const PASSWORD_RESET_VERIFY_MAX_ATTEMPTS = 8;
export const PASSWORD_RESET_VERIFY_WINDOW_MS = 15 * 60 * 1000;

/** Shared-address ceilings for the reset flow. See the login/register note above. */
export const PASSWORD_RESET_REQUEST_IP_MAX_ATTEMPTS = 30;
export const PASSWORD_RESET_VERIFY_IP_MAX_ATTEMPTS = 50;

const VERIFICATION_FLOW_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Canonical form of an e-mail address, used as the lookup key for every account.
 *
 * Lower-cases, trims, and collapses `+tag` aliases so `user+hh@example.com` and
 * `user@example.com` resolve to one account.
 *
 * Applied on **every** path that resolves an address to a user — credentials sign-up, sign-in,
 * password reset, and the Google provider. The Google path used to skip it, so signing in with
 * an aliased address through Google created a second row alongside the credentials account for
 * the same person.
 */
export function normalizeEmail(email: string) {
  const trimmed = email.trim().toLowerCase();
  const atIndex = trimmed.indexOf("@");
  if (atIndex === -1) return trimmed;

  let localPart = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  // Strip + addressing (user+tag@domain → user@domain)
  const plusIndex = localPart.indexOf("+");
  if (plusIndex !== -1) {
    localPart = localPart.slice(0, plusIndex);
  }

  return `${localPart}@${domain}`;
}

export function createEmailVerificationIdentifier(userId: string) {
  return `email-verification:${userId}`;
}

export function createEmailVerificationFlowIdentifier(flowId: string) {
  return `email-verification-flow:${flowId}`;
}

/**
 * Parks the invitation this sign-up came from until the code is confirmed.
 *
 * The invitation must not be counted as used while the address is still unproven, but
 * `verify-code` only receives a flow id — so the link is remembered against the flow and
 * consumed there. Expires with the flow.
 */
export function createEmailVerificationInviteIdentifier(flowId: string) {
  return `email-verification-invite:${flowId}`;
}

export function createPasswordResetIdentifier(userId: string) {
  return `password-reset:${userId}`;
}

export function createPasswordResetFlowIdentifier(flowId: string) {
  return `password-reset-flow:${flowId}`;
}

export function createRateLimitIdentifier(scope: string, key: string) {
  return `rate-limit:${scope}:${key}`;
}

export function generateEmailVerificationCode() {
  return randomInt(0, 1_000_000)
    .toString()
    .padStart(EMAIL_VERIFICATION_CODE_LENGTH, "0");
}

export function generateEmailVerificationFlowId() {
  return randomUUID();
}

export function isEmailVerificationFlowIdValid(flowId: string) {
  return VERIFICATION_FLOW_ID_REGEX.test(flowId);
}

export function generateRateLimitToken() {
  return randomUUID();
}

function hashVerificationCode(code: string, userId: string) {
  if (!env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required for email verification hashing");
  }

  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${userId}:${code}`)
    .digest("hex");
}

export function hashEmailVerificationCode(code: string, userId: string) {
  return hashVerificationCode(code, userId);
}

export function hashPasswordResetCode(code: string, userId: string) {
  return hashVerificationCode(code, userId);
}

export function isEmailVerificationCodeValid(code: string) {
  return /^\d{6}$/.test(code);
}
