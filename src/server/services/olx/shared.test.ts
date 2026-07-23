import { afterEach, describe, expect, test } from "bun:test";

import {
  fetchOlxJson,
  OlxApiError,
  parseOlxApiError,
  unwrapOlxData,
} from "./shared";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("unwrapOlxData", () => {
  test("supports direct and data-wrapped Partner API responses", () => {
    expect(unwrapOlxData<{ id: number }>({ id: 1 })).toEqual({ id: 1 });
    expect(unwrapOlxData<{ id: number }>({ data: { id: 2 } })).toEqual({
      id: 2,
    });
  });
});

describe("parseOlxApiError", () => {
  test("preserves OLX validation details", () => {
    const error = parseOlxApiError(400, {
      error: {
        code: "VALIDATION_ERROR",
        detail: "Data validation error occurred",
        validation: [
          {
            field: "title",
            title: "Too many capital letters",
          },
        ],
      },
    });

    expect(error).toBeInstanceOf(OlxApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.validationErrors).toEqual([
      {
        field: "title",
        title: "Too many capital letters",
        detail: "Too many capital letters",
      },
    ]);
  });

  test("parses OAuth error responses", () => {
    const error = parseOlxApiError(401, {
      error: "invalid_grant",
      error_description: "Invalid refresh token",
    });

    expect(error.code).toBe("invalid_grant");
    expect(error.message).toBe("Invalid refresh token");
  });
});

describe("fetchOlxJson", () => {
  test("adds required Partner API v2 headers and JSON body", async () => {
    const capturedRequests: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      capturedRequests.push({ url: String(input), init });
      return new Response(JSON.stringify({ id: 123 }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }) as typeof fetch;

    await fetchOlxJson({
      accessToken: "access-token",
      path: "/adverts",
      method: "POST",
      body: { title: "Test" },
    });

    const capturedRequest = capturedRequests[0];
    expect(capturedRequest?.url).toBe("https://www.olx.uz/api/partner/adverts");
    expect(capturedRequest?.init?.method).toBe("POST");
    expect(capturedRequest?.init?.body).toBe('{"title":"Test"}');
    expect(
      new Headers(capturedRequest?.init?.headers).get("Authorization"),
    ).toBe("Bearer access-token");
    expect(new Headers(capturedRequest?.init?.headers).get("Version")).toBe(
      "2.0",
    );
    expect(
      new Headers(capturedRequest?.init?.headers).get("Accept-Language"),
    ).toBe("ru");
  });

  test("throws a structured error for failed requests", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          error: {
            code: "forbidden",
            detail: "Advert packet is required",
          },
        }),
        {
          headers: { "Content-Type": "application/json" },
          status: 403,
        },
      )) as typeof fetch;

    await expect(
      fetchOlxJson({
        accessToken: "access-token",
        path: "/adverts",
      }),
    ).rejects.toMatchObject({
      code: "forbidden",
      status: 403,
    });
  });
});
