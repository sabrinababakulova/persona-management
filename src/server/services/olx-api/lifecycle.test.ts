import { describe, expect, test } from "bun:test";
import { OlxApiError, type OlxCredentials } from "./client";
import { deleteOlxAdvert, setOlxAdvertActive } from "./lifecycle";

function jwt(payload: Record<string, unknown>): string {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "unsigned-test-signature",
  ].join(".");
}

const credentials: OlxCredentials = {
  version: 1,
  source: "olx_ciam",
  accessToken: jwt({ exp: Math.floor(Date.now() / 1000) + 3_600 }),
  refreshToken: "refresh-token-value-that-is-long-enough",
  idToken: jwt({ sub: "test-user" }),
  deviceId: "test-device-id-123",
  fingerprint: "test-browser-fingerprint-123",
  cookieHeader: "deviceGUID=test-device; lang=ru",
  userAgent:
    "Mozilla/5.0 Test Browser AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36",
  expiresAt: Date.now() + 3_600_000,
};

function successResponse(adId = 65_713_044) {
  return Response.json({
    data: {
      myAds: {
        updateAd: {
          adId,
          status: "SUCCESS",
          message: null,
          activateResult: null,
        },
      },
    },
  });
}

describe("OLX advert lifecycle", () => {
  test("deactivates with the mutation used by the olx.uz My ads frontend", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = async (input: URL | RequestInfo, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return successResponse();
    };

    const result = await setOlxAdvertActive({
      credentials,
      advertId: "65713044",
      isActive: false,
      fetchImpl,
    });

    expect(result.action).toBe("deactivate");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "https://production-graphql.eu-sharedservices.olxcdn.com/graphql",
    );
    expect(calls[0]?.init?.method).toBe("POST");
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("authorization")).toBe(
      `Bearer ${credentials.accessToken}`,
    );
    expect(headers.get("site")).toBe("olxuz");
    expect(headers.get("x-client")).toBe("DESKTOP");
    expect(headers.has("cookie")).toBe(false);
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      operationName: "UpdateAd",
      variables: { adId: 65_713_044, action: "DEACTIVATE" },
    });
  });

  test("reactivates with the ACTIVATE action", async () => {
    let body = "";
    const fetchImpl = async (_input: URL | RequestInfo, init?: RequestInit) => {
      body = String(init?.body ?? "");
      return successResponse();
    };

    const result = await setOlxAdvertActive({
      credentials,
      advertId: "65713044",
      isActive: true,
      fetchImpl,
    });

    expect(result.action).toBe("activate");
    expect(JSON.parse(body).variables).toEqual({
      adId: 65_713_044,
      action: "ACTIVATE",
    });
  });

  test("permanently removes an inactive advert with the REMOVE action", async () => {
    let body = "";
    const result = await deleteOlxAdvert({
      credentials,
      advertId: "65713044",
      fetchImpl: async (_input, init) => {
        body = String(init?.body ?? "");
        return successResponse();
      },
    });

    expect(result.alreadyDeleted).toBe(false);
    expect(JSON.parse(body).variables).toEqual({
      adId: 65_713_044,
      action: "REMOVE",
    });
  });

  test("treats an already-missing owned advert as idempotent success", async () => {
    const result = await deleteOlxAdvert({
      credentials,
      advertId: "65713044",
      acceptAlreadyDeleted: true,
      fetchImpl: async () =>
        Response.json({
          errors: [
            {
              message: "Advert not found",
              extensions: { code: "NOT_FOUND" },
            },
          ],
          data: null,
        }),
    });

    expect(result.alreadyDeleted).toBe(true);
  });

  test("rejects a non-numeric advert id without making a request", async () => {
    let called = false;

    await expect(
      setOlxAdvertActive({
        credentials,
        advertId: "offer/id with spaces",
        isActive: false,
        fetchImpl: async () => {
          called = true;
          return successResponse();
        },
      }),
    ).rejects.toBeInstanceOf(OlxApiError);
    expect(called).toBe(false);
  });

  test("surfaces an explicit OLX action failure", async () => {
    try {
      await setOlxAdvertActive({
        credentials,
        advertId: "65713044",
        isActive: false,
        fetchImpl: async () =>
          Response.json({
            data: {
              myAds: {
                updateAd: {
                  adId: 65_713_044,
                  status: "FAILED",
                  message: "Advert cannot be updated",
                },
              },
            },
          }),
      });
      throw new Error("Expected the lifecycle request to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(OlxApiError);
      expect((error as OlxApiError).code).toBe("validation_failed");
    }
  });

  test("refreshes once and replays when GraphQL rejects an access token", async () => {
    const refreshedAccessToken = jwt({
      exp: Math.floor(Date.now() / 1000) + 7_200,
    });
    const refreshedIdToken = jwt({ sub: "test-user" });
    const refreshedRefreshToken =
      "replacement-refresh-token-value-that-is-long-enough";
    const calls: Array<{ url: string; init?: RequestInit }> = [];

    const result = await setOlxAdvertActive({
      credentials,
      advertId: "65713044",
      isActive: false,
      fetchImpl: async (input, init) => {
        const url = String(input);
        calls.push({ url, init });

        if (calls.length === 1) {
          return Response.json({
            data: null,
            errors: [
              {
                message: "Access token expired",
                extensions: { code: "UNAUTHENTICATED" },
              },
            ],
          });
        }
        if (url === "https://login.olx.uz/oauth2/token") {
          return Response.json({
            access_token: refreshedAccessToken,
            expires_in: 7_200,
            id_token: refreshedIdToken,
            refresh_token: refreshedRefreshToken,
          });
        }
        return successResponse();
      },
    });

    expect(calls).toHaveLength(3);
    expect(calls.map((call) => call.url)).toEqual([
      "https://production-graphql.eu-sharedservices.olxcdn.com/graphql",
      "https://login.olx.uz/oauth2/token",
      "https://production-graphql.eu-sharedservices.olxcdn.com/graphql",
    ]);
    expect(new Headers(calls[2]?.init?.headers).get("authorization")).toBe(
      `Bearer ${refreshedAccessToken}`,
    );
    expect(result.credentials.accessToken).toBe(refreshedAccessToken);
    expect(result.credentials.refreshToken).toBe(refreshedRefreshToken);
  });
});
