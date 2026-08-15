import { z } from "zod";
import { fetchOlxWithBrowser } from "./browser-transport";

const OLX_API_ROOT = "https://www.olx.uz/api/v1/";
const OLX_TOKEN_URL = "https://login.olx.uz/oauth2/token";
const OLX_WEB_CLIENT_ID = "4b7edpvrarh6co2rp6lhae0jva";
const OLX_REDIRECT_URI = "https://www.olx.uz/d/callback/";
const TOKEN_REFRESH_SKEW_MS = 90_000;
const REQUEST_TIMEOUT_MS = 20_000;

export const olxCredentialsSchema = z.object({
  version: z.literal(1),
  source: z.literal("olx_ciam"),
  accessToken: z.string().min(20).max(20_000),
  refreshToken: z.string().min(20).max(20_000),
  deviceId: z.string().min(8).max(255),
  fingerprint: z.string().min(8).max(2_000),
  cookieHeader: z
    .string()
    .min(1)
    .max(4_000)
    .regex(/^[^\r\n]+$/)
    .transform(sanitizeOlxCookieHeader)
    .refine((value) => value.length > 0, "No allowed OLX cookies found"),
  userAgent: z
    .string()
    .min(20)
    .max(1_000)
    .regex(/^[^\r\n]+$/),
  expiresAt: z.number().int().positive().optional(),
  scope: z.string().max(1_000).optional(),
});

export type OlxCredentials = z.infer<typeof olxCredentialsSchema>;

export type OlxAccount = {
  id: string | null;
  loginHint: string | null;
};

type OlxApiErrorCode =
  | "reauth_required"
  | "rate_limited"
  | "not_found"
  | "validation_failed"
  | "unavailable"
  | "unexpected_response";

export class OlxApiError extends Error {
  constructor(
    readonly code: OlxApiErrorCode,
    message: string,
    readonly status?: number,
    readonly validation: string[] = [],
  ) {
    super(message);
    this.name = "OlxApiError";
  }
}

type FetchLike = (
  input: URL | RequestInfo,
  init?: RequestInit,
) => Promise<Response>;

function decodeJwtPayload(token: string | undefined): Record<string, unknown> {
  if (!token) return {};
  const payload = token.split(".")[1];
  if (!payload) return {};

  try {
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function tokenExpiresAt(credentials: OlxCredentials): number | undefined {
  if (credentials.expiresAt) return credentials.expiresAt;
  const exp = decodeJwtPayload(credentials.accessToken).exp;
  return typeof exp === "number" ? exp * 1_000 : undefined;
}

function mustRefresh(credentials: OlxCredentials): boolean {
  const expiresAt = tokenExpiresAt(credentials);
  return !expiresAt || expiresAt <= Date.now() + TOKEN_REFRESH_SKEW_MS;
}

function stringValue(value: unknown, maxLength = 255): string | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const result = String(value).trim();
  return result ? result.slice(0, maxLength) : undefined;
}

function maskEmail(value: string): string {
  const [local, domain] = value.split("@");
  if (!local || !domain) return "olx.uz";
  return `${local.slice(0, 2)}***@${domain}`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return "olx.uz";
  return `+${digits.slice(0, 3)} ** *** ${digits.slice(-4)}`;
}

function accountHintFromPayload(
  payload: Record<string, unknown>,
): string | null {
  const nested =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : payload;
  const email = stringValue(nested.email) ?? stringValue(nested.email_address);
  if (email?.includes("@")) return maskEmail(email);

  const phone = stringValue(nested.phone) ?? stringValue(nested.phone_number);
  return phone ? maskPhone(phone) : null;
}

function accountIdFromPayload(payload: Record<string, unknown>): string | null {
  const nested =
    payload.data && typeof payload.data === "object"
      ? (payload.data as Record<string, unknown>)
      : payload;
  return (
    stringValue(nested.id) ??
    stringValue(nested.uuid) ??
    stringValue(nested.user_id) ??
    null
  );
}

async function parseJson(response: Response): Promise<Record<string, unknown>> {
  try {
    const value = (await response.json()) as unknown;
    return value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function requestHeaders(credentials: OlxCredentials): HeadersInit {
  return {
    Accept: "application/json",
    "Accept-Language": "ru",
    Authorization: `Bearer ${credentials.accessToken}`,
    Cookie: credentials.cookieHeader,
    "User-Agent": credentials.userAgent,
    "X-Client": "DESKTOP",
    "X-Device-Id": credentials.deviceId,
    "X-Fingerprint": credentials.fingerprint,
    "X-Platform-Type": "mobile-html5",
    Version: "v1.19",
  };
}

function cookieValue(header: string, name: string): string | undefined {
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== name) continue;
    return part.slice(separator + 1).trim();
  }
  return undefined;
}

const ALLOWED_OLX_COOKIES = new Set(["access_token", "deviceGUID"]);

export function sanitizeOlxCookieHeader(header: string): string {
  return header
    .split(";")
    .flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return [];
      const name = part.slice(0, separator).trim();
      if (!ALLOWED_OLX_COOKIES.has(name)) return [];
      return [`${name}=${part.slice(separator + 1).trim()}`];
    })
    .join("; ");
}

function replaceCookieValue(header: string, name: string, value: string) {
  return header
    .split(";")
    .map((part) => {
      const separator = part.indexOf("=");
      if (separator < 0 || part.slice(0, separator).trim() !== name)
        return part;
      return `${part.slice(0, separator + 1)}${value}`;
    })
    .join(";");
}

function refreshCookieHeader(
  previous: OlxCredentials,
  nextAccessToken: string,
) {
  const current = cookieValue(previous.cookieHeader, "access_token");
  if (current === previous.accessToken) {
    return replaceCookieValue(
      previous.cookieHeader,
      "access_token",
      nextAccessToken,
    );
  }
  return previous.cookieHeader;
}

function validationMessages(payload: Record<string, unknown>): string[] {
  const error =
    payload.error && typeof payload.error === "object"
      ? (payload.error as Record<string, unknown>)
      : undefined;
  const values = Array.isArray(error?.validation) ? error.validation : [];

  return values
    .flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const item = value as Record<string, unknown>;
      const field = stringValue(item.field, 120);
      const title = stringValue(item.title, 300);
      const detail = stringValue(item.detail, 300);
      const message = [field, title ?? detail].filter(Boolean).join(": ");
      return message ? [message] : [];
    })
    .slice(0, 8);
}

export async function requestOlxApi(
  input: OlxCredentials,
  path: string,
  init: Omit<RequestInit, "headers"> & { headers?: HeadersInit } = {},
  fetchImpl?: FetchLike,
): Promise<{
  credentials: OlxCredentials;
  payload: Record<string, unknown>;
}> {
  const apiFetch = fetchImpl ?? fetchOlxWithBrowser;
  let credentials = await ensureFreshOlxCredentials(input, {
    fetchImpl: fetchImpl ?? fetch,
  });

  const request = () => {
    const headers = new Headers(requestHeaders(credentials));
    new Headers(init.headers).forEach((value, key) => {
      headers.set(key, value);
    });
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return apiFetch(new URL(path.replace(/^\/+/, ""), OLX_API_ROOT), {
      ...init,
      headers,
      signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  };

  let response: Response;
  try {
    response = await request();
    if (response.status === 401) {
      credentials = await ensureFreshOlxCredentials(credentials, {
        force: true,
        fetchImpl: fetchImpl ?? fetch,
      });
      response = await request();
    }
  } catch (error) {
    if (error instanceof OlxApiError) throw error;
    throw new OlxApiError(
      "unavailable",
      error instanceof Error ? error.message : "OLX API unavailable",
    );
  }

  const payload = await parseJson(response);
  if (response.status === 401 || response.status === 403) {
    const rejectionReason = [
      stringValue(payload.error, 80),
      stringValue(payload.error_description, 300),
    ]
      .filter(Boolean)
      .join(": ");
    throw new OlxApiError(
      "reauth_required",
      rejectionReason || "OLX rejected the saved credentials",
      response.status,
    );
  }
  if (response.status === 429) {
    throw new OlxApiError(
      "rate_limited",
      "OLX rate limited the request",
      response.status,
    );
  }
  if (response.status === 404) {
    throw new OlxApiError(
      "not_found",
      "OLX advert was not found",
      response.status,
    );
  }
  if (response.status === 400 || response.status === 422) {
    throw new OlxApiError(
      "validation_failed",
      "OLX rejected the publication data",
      response.status,
      validationMessages(payload),
    );
  }
  if (!response.ok) {
    throw new OlxApiError("unavailable", "OLX request failed", response.status);
  }

  return { credentials, payload };
}

export async function refreshOlxCredentials(
  input: OlxCredentials,
  fetchImpl: FetchLike = fetch,
): Promise<OlxCredentials> {
  const credentials = olxCredentialsSchema.parse(input);
  const body = new URLSearchParams({
    client_id: OLX_WEB_CLIENT_ID,
    grant_type: "refresh_token",
    redirect_uri: OLX_REDIRECT_URI,
    refresh_token: credentials.refreshToken,
  });

  let response: Response;
  try {
    response = await fetchImpl(OLX_TOKEN_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new OlxApiError(
      "unavailable",
      error instanceof Error ? error.message : "OLX token service unavailable",
    );
  }

  const payload = await parseJson(response);
  if (!response.ok) {
    const oauthError = stringValue(payload.error);
    if (
      oauthError === "invalid_grant" ||
      oauthError === "missing_refresh_token"
    ) {
      throw new OlxApiError(
        "reauth_required",
        "OLX refresh token is no longer valid",
        response.status,
      );
    }
    if (response.status === 429) {
      throw new OlxApiError(
        "rate_limited",
        "OLX token service rate limited the request",
        response.status,
      );
    }
    throw new OlxApiError(
      "unavailable",
      "OLX token refresh failed",
      response.status,
    );
  }

  const accessToken = stringValue(payload.access_token, 20_000);
  if (!accessToken) {
    throw new OlxApiError(
      "unexpected_response",
      "OLX token response did not contain an access token",
      response.status,
    );
  }
  const expiresIn =
    typeof payload.expires_in === "number" && payload.expires_in > 0
      ? payload.expires_in
      : 3_600;

  return olxCredentialsSchema.parse({
    ...credentials,
    accessToken,
    refreshToken:
      stringValue(payload.refresh_token, 20_000) ?? credentials.refreshToken,
    cookieHeader: refreshCookieHeader(credentials, accessToken),
    scope: stringValue(payload.scope, 1_000) ?? credentials.scope,
    expiresAt: Date.now() + expiresIn * 1_000,
  });
}

export async function ensureFreshOlxCredentials(
  input: OlxCredentials,
  options: { force?: boolean; fetchImpl?: FetchLike } = {},
): Promise<OlxCredentials> {
  const credentials = olxCredentialsSchema.parse(input);
  if (!options.force && !mustRefresh(credentials)) return credentials;
  return refreshOlxCredentials(credentials, options.fetchImpl);
}

export async function verifyOlxCredentials(
  input: OlxCredentials,
  fetchImpl?: FetchLike,
): Promise<{ credentials: OlxCredentials; account: OlxAccount }> {
  const { credentials, payload } = await requestOlxApi(
    input,
    "users/me",
    {},
    fetchImpl,
  );

  return {
    credentials,
    account: {
      id: accountIdFromPayload(payload),
      loginHint: accountHintFromPayload(payload),
    },
  };
}
