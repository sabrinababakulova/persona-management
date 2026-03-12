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

const VERIFICATION_FLOW_ID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

export function hashEmailVerificationCode(code: string, userId: string) {
  if (!env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required for email verification hashing");
  }

  return createHmac("sha256", env.AUTH_SECRET)
    .update(`${userId}:${code}`)
    .digest("hex");
}

export function isEmailVerificationCodeValid(code: string) {
  return /^\d{6}$/.test(code);
}
