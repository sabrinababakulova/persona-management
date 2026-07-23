import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

import {
  fetchOlxJson,
  getOlxClientCredentials,
  OLX_TOKEN_URL,
  OLX_WEB_BASE_URL,
  parseOlxApiError,
  unwrapOlxData,
} from "./shared";

const OLX_SCOPE = "read write v2";
const STATE_MAX_AGE_MS = 15 * 60 * 1000;

type OlxTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
};

export type OlxTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  scope: string | null;
};

export type OlxAccountProfile = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  isBusiness: boolean;
};

function getOlxRedirectUri(requestUrl?: string): string {
  if (env.OLX_REDIRECT_URI) {
    return env.OLX_REDIRECT_URI;
  }
  if (!requestUrl) {
    throw new Error(
      "OLX_REDIRECT_URI is required when a request URL is unavailable",
    );
  }
  return new URL("/api/integrations/olx/callback", requestUrl).toString();
}

function signState(encodedPayload: string): string {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(encodedPayload)
    .digest("base64url");
}

export function buildOlxConnectState(input: { userId: string }): string {
  const encoded = Buffer.from(
    JSON.stringify({ userId: input.userId, issuedAt: Date.now() }),
  ).toString("base64url");
  return `${encoded}.${signState(encoded)}`;
}

export function parseOlxConnectState(
  state: string,
): { userId: string; issuedAt: number } | null {
  const [encoded, signature, extra] = state.split(".");
  if (!encoded || !signature || extra !== undefined) {
    return null;
  }

  const expected = Buffer.from(signState(encoded));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as { userId?: unknown; issuedAt?: unknown };
    if (
      typeof parsed.userId !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      parsed.issuedAt > Date.now() + 60_000 ||
      Date.now() - parsed.issuedAt > STATE_MAX_AGE_MS
    ) {
      return null;
    }
    return { userId: parsed.userId, issuedAt: parsed.issuedAt };
  } catch {
    return null;
  }
}

export function buildOlxAuthorizeUrl(input: {
  requestUrl: string;
  state: string;
}): string {
  const { clientId } = getOlxClientCredentials();
  const searchParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getOlxRedirectUri(input.requestUrl),
    response_type: "code",
    scope: OLX_SCOPE,
    state: input.state,
  });
  return `${OLX_WEB_BASE_URL}/oauth/authorize/?${searchParams.toString()}`;
}

async function requestOlxToken(payload: URLSearchParams): Promise<OlxTokens> {
  const response = await fetch(OLX_TOKEN_URL, {
    method: "POST",
    body: payload,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  const body: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    throw parseOlxApiError(response.status, body);
  }

  const token = body as OlxTokenResponse;
  if (!token.access_token) {
    throw new Error("OLX token response did not include access_token");
  }

  const expiresIn =
    typeof token.expires_in === "number" && token.expires_in > 0
      ? token.expires_in
      : 3600;
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    scope: token.scope ?? null,
  };
}

export function exchangeOlxAuthorizationCode(input: {
  code: string;
  requestUrl: string;
}): Promise<OlxTokens> {
  const { clientId, clientSecret } = getOlxClientCredentials();
  return requestOlxToken(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: input.code,
      grant_type: "authorization_code",
      redirect_uri: getOlxRedirectUri(input.requestUrl),
      scope: OLX_SCOPE,
    }),
  );
}

export function refreshOlxAccessToken(
  refreshToken: string,
): Promise<OlxTokens> {
  const { clientId, clientSecret } = getOlxClientCredentials();
  return requestOlxToken(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  );
}

export async function resolveOlxAccountProfile(
  accessToken: string,
): Promise<OlxAccountProfile> {
  const body = await fetchOlxJson<unknown>({
    accessToken,
    path: "/users/me",
  });
  const profile = unwrapOlxData<Record<string, unknown>>(body);
  if (
    typeof profile !== "object" ||
    profile === null ||
    (typeof profile.id !== "number" && typeof profile.id !== "string")
  ) {
    throw new Error("OLX account response did not include a user id");
  }

  return {
    id: String(profile.id),
    email: typeof profile.email === "string" ? profile.email : null,
    name: typeof profile.name === "string" ? profile.name : null,
    phone: typeof profile.phone === "string" ? profile.phone : null,
    isBusiness: profile.is_business === true,
  };
}
