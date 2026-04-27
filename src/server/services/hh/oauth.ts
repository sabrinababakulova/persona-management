import { env } from "~/env";

import {
  decodeState,
  fetchHhJson,
  getHhClientCredentials,
  getNestedString,
  HH_API_BASE_URL,
  HH_AUTH_BASE_URL,
  type HhConnectedAccount,
  type HhConnectStatePayload,
  type HhMeResponse,
  type HhTokenResponse,
  signState,
} from "./shared";

export function isHhConfigured() {
  return !!(env.HH_CLIENT_ID && env.HH_CLIENT_SECRET);
}

export function buildHhConnectState(input: {
  companyId: string;
  userId: string;
}) {
  const payload: HhConnectStatePayload = {
    companyId: input.companyId,
    userId: input.userId,
    issuedAt: Date.now(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  return `${encodedPayload}.${signState(encodedPayload)}`;
}

export function parseHhConnectState(state: string) {
  return decodeState(state);
}

export function buildHhAuthorizeUrl(input: {
  requestUrl?: string;
  state: string;
}) {
  const { clientId } = getHhClientCredentials();
  const redirectUri = env.HH_REDIRECT_URI ?? "";

  const searchParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state: input.state,
  });

  return `${HH_AUTH_BASE_URL}/oauth/authorize?${searchParams}`;
}

export async function exchangeHhAuthorizationCode(input: {
  code: string;
  requestUrl?: string;
}): Promise<{ accessToken: string; refreshToken: string | null }> {
  const { clientId, clientSecret } = getHhClientCredentials();
  const redirectUri = env.HH_REDIRECT_URI ?? "";

  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const response = await fetch(`${HH_AUTH_BASE_URL}/oauth/token`, {
    body: payload,
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HH token exchange failed ${response.status}: ${body}`);
  }

  const tokens = (await response.json()) as HhTokenResponse;
  if (!tokens.access_token) {
    throw new Error("HH token exchange did not return access_token");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
  };
}

export async function refreshHhAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string | null }> {
  const { clientId, clientSecret } = getHhClientCredentials();

  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(`${HH_AUTH_BASE_URL}/oauth/token`, {
    body: payload,
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HH token refresh failed ${response.status}: ${body}`);
  }

  const tokens = (await response.json()) as HhTokenResponse;
  if (!tokens.access_token) {
    throw new Error("HH token refresh did not return access_token");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
  };
}

export async function resolveHhEmployerFromAccessToken(
  accessToken: string,
): Promise<HhConnectedAccount> {
  let me: HhMeResponse | null = null;

  for (const url of [
    `${HH_API_BASE_URL}/me?host=hh.uz`,
    `${HH_API_BASE_URL}/me`,
  ]) {
    try {
      me = await fetchHhJson<HhMeResponse>(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      break;
    } catch {}
  }

  if (!me) {
    throw new Error("Failed to load HH account profile");
  }

  const employerId =
    getNestedString(me, ["employer", "id"]) ??
    getNestedString(me, ["manager", "employer", "id"]);

  if (!employerId) {
    throw new Error("Failed to resolve HH employer ID from authorized account");
  }

  const email =
    getNestedString(me, ["email"]) ??
    getNestedString(me, ["manager", "email"]) ??
    null;

  return {
    email,
    employerId,
  };
}
