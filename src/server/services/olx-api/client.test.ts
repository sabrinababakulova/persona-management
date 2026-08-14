import { describe, expect, test } from "bun:test";
import {
  OlxApiError,
  type OlxCredentials,
  refreshOlxCredentials,
  requestOlxApi,
  verifyOlxCredentials,
} from "./client";

function jwt(payload: Record<string, unknown>): string {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "unsigned-test-signature",
  ].join(".");
}

function credentials(overrides: Partial<OlxCredentials> = {}): OlxCredentials {
  const result: OlxCredentials = {
    version: 1,
    source: "olx_ciam",
    accessToken: jwt({ exp: Math.floor(Date.now() / 1000) + 3_600 }),
    refreshToken: "refresh-token-value-that-is-long-enough",
    idToken: jwt({ sub: "user-123", email: "person@example.com" }),
    deviceId: "test-device-id-123",
    fingerprint: "test-browser-fingerprint-123",
    cookieHeader: "deviceGUID=test-device; lang=ru",
    userAgent:
      "Mozilla/5.0 Test Browser AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36",
    expiresAt: Date.now() + 3_600_000,
  };
  return { ...result, ...overrides };
}

describe("OLX API credentials", () => {
  test("verifies an active account without refreshing", async () => {
    const calls: string[] = [];
    const fetchImpl = async (input: URL | RequestInfo) => {
      calls.push(String(input));
      return Response.json({ data: { id: 123, email: "person@example.com" } });
    };

    const result = await verifyOlxCredentials(credentials(), fetchImpl);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toBe("https://www.olx.uz/api/v1/users/me");
    expect(result.account).toEqual({
      id: "123",
      loginHint: "pe***@example.com",
    });
  });

  test("pairs the bearer access token with OLX's first-party cookies", async () => {
    const input = credentials();
    let requestHeaders = new Headers();
    const fetchImpl = async (_input: URL | RequestInfo, init?: RequestInit) => {
      requestHeaders = new Headers(init?.headers);
      return Response.json({ data: { id: 123 } });
    };

    await verifyOlxCredentials(input, fetchImpl);

    expect(requestHeaders.get("authorization")).toBe(
      `Bearer ${input.accessToken}`,
    );
    expect(requestHeaders.get("cookie")).toBe(input.cookieHeader);
    expect(requestHeaders.get("user-agent")).toBe(input.userAgent);
    expect(requestHeaders.get("x-client")).toBe("DESKTOP");
    expect(requestHeaders.get("x-device-id")).toBe(input.deviceId);
    expect(requestHeaders.get("x-fingerprint")).toBe(input.fingerprint);
    expect(requestHeaders.get("x-platform-type")).toBe("mobile-html5");
    expect(requestHeaders.get("version")).toBe("v1.19");
  });

  test("refreshes an expired access token", async () => {
    const nextAccessToken = jwt({ exp: Math.floor(Date.now() / 1000) + 7_200 });
    const fetchImpl = async (input: URL | RequestInfo) => {
      if (String(input).includes("oauth2/token")) {
        return Response.json({
          access_token: nextAccessToken,
          expires_in: 7_200,
          refresh_token: "rotated-refresh-token-that-is-long-enough",
        });
      }
      return Response.json({ data: { uuid: "uuid-1" } });
    };

    const result = await verifyOlxCredentials(
      credentials({ expiresAt: Date.now() - 1 }),
      fetchImpl,
    );

    expect(result.credentials.accessToken).toBe(nextAccessToken);
    expect(result.credentials.refreshToken).toBe(
      "rotated-refresh-token-that-is-long-enough",
    );
  });

  test("rotates a matching access-token cookie during refresh", async () => {
    const previous = credentials({ expiresAt: Date.now() - 1 });
    previous.cookieHeader = `deviceGUID=test; access_token=${previous.accessToken}; lang=ru`;
    const nextAccessToken = jwt({ exp: Math.floor(Date.now() / 1000) + 7_200 });
    let apiCookie = "";
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      if (String(input).includes("oauth2/token")) {
        return Response.json({
          access_token: nextAccessToken,
          expires_in: 7_200,
        });
      }
      apiCookie = new Headers(init?.headers).get("cookie") ?? "";
      return Response.json({ data: { id: "connected-user" } });
    };

    await verifyOlxCredentials(previous, fetchImpl);

    expect(apiCookie).toContain(`access_token=${nextAccessToken}`);
    expect(apiCookie).not.toContain(`access_token=${previous.accessToken}`);
  });

  test("keeps the current refresh token when OLX does not rotate it", async () => {
    const initial = credentials({ expiresAt: Date.now() - 1 });
    const fetchImpl = async () =>
      Response.json({
        access_token: jwt({ exp: Math.floor(Date.now() / 1000) + 3_600 }),
        expires_in: 3_600,
      });

    const result = await refreshOlxCredentials(initial, fetchImpl);
    expect(result.refreshToken).toBe(initial.refreshToken);
  });

  test("maps an invalid refresh token to reconnection", async () => {
    const fetchImpl = async () =>
      Response.json(
        { error: "invalid_grant", error_description: "expired" },
        { status: 400 },
      );

    try {
      await refreshOlxCredentials(credentials(), fetchImpl);
      throw new Error("Expected refresh to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(OlxApiError);
      expect((error as OlxApiError).code).toBe("reauth_required");
    }
  });

  test("retries account verification once after a 401", async () => {
    let calls = 0;
    const fetchImpl = async (input: URL | RequestInfo) => {
      calls += 1;
      if (calls === 1) {
        return Response.json({ error: "invalid_token" }, { status: 401 });
      }
      if (String(input).includes("oauth2/token")) {
        return Response.json({
          access_token: jwt({ exp: Math.floor(Date.now() / 1000) + 3_600 }),
          expires_in: 3_600,
        });
      }
      return Response.json({ data: { id: "connected-user" } });
    };

    const result = await verifyOlxCredentials(credentials(), fetchImpl);
    expect(calls).toBe(3);
    expect(result.account.id).toBe("connected-user");
  });

  test("keeps OLX validation details without exposing arbitrary response data", async () => {
    const fetchImpl = async () =>
      Response.json(
        {
          error: {
            validation: [
              {
                field: "parameters.salary",
                title: "Salary is required",
                detail: "internal detail",
              },
            ],
          },
          secret_debug_value: "must-not-appear",
        },
        { status: 422 },
      );

    try {
      await requestOlxApi(credentials(), "offers-preview", {}, fetchImpl);
      throw new Error("Expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(OlxApiError);
      const apiError = error as OlxApiError;
      expect(apiError.code).toBe("validation_failed");
      expect(apiError.validation).toEqual([
        "parameters.salary: Salary is required",
      ]);
      expect(apiError.message).not.toContain("must-not-appear");
    }
  });
});
