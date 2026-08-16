import { TRPCClientError } from "@trpc/client";

/**
 * tRPC codes whose messages are always authored by us as user-facing text.
 *
 * Every router raises these deliberately with a Russian message (see the
 * `TRPCError` throw sites in `~/server/api/routers`), so the server message is
 * strictly better than any generic fallback we could show.
 */
const AUTHORED_MESSAGE_CODES = new Set([
  "BAD_REQUEST",
  "CONFLICT",
  "FORBIDDEN",
  "NOT_FOUND",
  "PAYLOAD_TOO_LARGE",
  "PRECONDITION_FAILED",
  "TOO_MANY_REQUESTS",
  "UNPROCESSABLE_CONTENT",
  "UNSUPPORTED_MEDIA_TYPE",
]);

/** Keys in the `Errors` translation namespace usable as a failure headline. */
export type ErrorMessageKey =
  | "badRequest"
  | "clientClosed"
  | "conflict"
  | "forbidden"
  | "hhSessionExpired"
  | "hhUnavailable"
  | "network"
  | "notFound"
  | "payloadTooLarge"
  | "preconditionFailed"
  | "serverError"
  | "timeout"
  | "tooManyRequests"
  | "unauthorized"
  | "unsupportedMediaType";

/** Fallback `Errors` message key per tRPC code. */
const MESSAGE_KEY_BY_CODE: Record<string, ErrorMessageKey> = {
  BAD_REQUEST: "badRequest",
  CLIENT_CLOSED_REQUEST: "clientClosed",
  CONFLICT: "conflict",
  FORBIDDEN: "forbidden",
  INTERNAL_SERVER_ERROR: "serverError",
  NOT_FOUND: "notFound",
  PAYLOAD_TOO_LARGE: "payloadTooLarge",
  PRECONDITION_FAILED: "preconditionFailed",
  TIMEOUT: "timeout",
  TOO_MANY_REQUESTS: "tooManyRequests",
  UNAUTHORIZED: "unauthorized",
  UNPROCESSABLE_CONTENT: "badRequest",
  UNSUPPORTED_MEDIA_TYPE: "unsupportedMediaType",
};

const CYRILLIC = /[Ѐ-ӿ]/;

export type ResolvedTrpcError = {
  /** tRPC error code, e.g. `"FORBIDDEN"`. */
  code: string;
  /**
   * The HTTP status this failure represents.
   *
   * The wire response is always 200 because the app uses `httpBatchStreamLink`,
   * which commits response headers before any procedure runs. The real status
   * travels per-call in the body, and this is where it ends up.
   */
  httpStatus: number;
  /** Server-authored user-facing message, when it can be trusted. */
  message: string | null;
  /** Key inside the `Errors` translation namespace to fall back to. */
  messageKey: ErrorMessageKey;
  /** Per-field validation messages from a Zod failure. */
  fieldErrors: Record<string, string[]>;
  /** Form-level validation messages from a Zod failure. */
  formErrors: string[];
  /** True when the request never reached the server. */
  isNetworkError: boolean;
};

const UNKNOWN_ERROR: ResolvedTrpcError = {
  code: "INTERNAL_SERVER_ERROR",
  httpStatus: 500,
  message: null,
  messageKey: "serverError",
  fieldErrors: {},
  formErrors: [],
  isNetworkError: false,
};

/**
 * Decides whether a server message is safe to show.
 *
 * `INTERNAL_SERVER_ERROR` covers both messages we wrote for the user (hh.uz and
 * PersonHunters failures, for instance) and raw exception text from a driver or
 * a third-party SDK. Since every user-facing string in this app is Russian by
 * convention, the presence of Cyrillic is a reliable signal that a human wrote
 * the message for a human — anything else is masked behind a generic string so
 * we never leak internals into the UI.
 */
function canTrustServerMessage(code: string, message: string) {
  if (!message.trim()) {
    return false;
  }
  if (AUTHORED_MESSAGE_CODES.has(code)) {
    return true;
  }
  return CYRILLIC.test(message);
}

/**
 * Normalizes anything thrown by a tRPC call into a consistent, renderable shape.
 *
 * Accepts `unknown` because React Query hands errors back untyped in several
 * places (cache subscribers, error boundaries).
 */
export function resolveTrpcError(error: unknown): ResolvedTrpcError {
  if (!(error instanceof TRPCClientError)) {
    // A non-tRPC rejection here is almost always `fetch` failing outright:
    // offline, DNS, or a dropped connection mid-stream.
    if (error instanceof TypeError) {
      return {
        ...UNKNOWN_ERROR,
        code: "NETWORK_ERROR",
        httpStatus: 0,
        messageKey: "network",
        isNetworkError: true,
      };
    }
    return UNKNOWN_ERROR;
  }

  const data = error.data as
    | {
        code?: string;
        httpStatus?: number;
        zodError?: {
          fieldErrors?: Record<string, string[] | undefined>;
          formErrors?: string[];
        } | null;
      }
    | undefined;

  const code = data?.code ?? "INTERNAL_SERVER_ERROR";
  const zodError = data?.zodError ?? null;

  // A Zod failure carries its detail in `zodError`; the top-level message is
  // just a serialized issue dump, so it is never shown directly.
  const fieldErrors: Record<string, string[]> = {};
  if (zodError?.fieldErrors) {
    for (const [field, messages] of Object.entries(zodError.fieldErrors)) {
      if (messages?.length) {
        fieldErrors[field] = messages;
      }
    }
  }

  const hasValidationDetail =
    Object.keys(fieldErrors).length > 0 ||
    (zodError?.formErrors?.length ?? 0) > 0;

  return {
    code,
    httpStatus: data?.httpStatus ?? 500,
    message:
      !hasValidationDetail && canTrustServerMessage(code, error.message)
        ? error.message
        : null,
    messageKey: MESSAGE_KEY_BY_CODE[code] ?? "serverError",
    fieldErrors,
    formErrors: zodError?.formErrors ?? [],
    isNetworkError: false,
  };
}

/** True when the failure means the session is gone and the user must re-auth. */
export function isUnauthorizedError(error: unknown) {
  return resolveTrpcError(error).code === "UNAUTHORIZED";
}
