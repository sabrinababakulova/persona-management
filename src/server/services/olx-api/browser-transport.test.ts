import { describe, expect, test } from "bun:test";
import {
  browserSafeHeaders,
  cookieHeaderToBrowserCookies,
  isAllowedOlxBrowserUrl,
  shouldDisableOlxBrowserSandbox,
} from "./browser-transport";

describe("OLX browser transport", () => {
  test("turns a request cookie header into same-origin browser cookies", () => {
    expect(
      cookieHeaderToBrowserCookies(
        "deviceGUID=abc; access_token=one.two.three; empty=",
        "https://www.olx.uz",
      ),
    ).toEqual([
      { name: "deviceGUID", value: "abc", url: "https://www.olx.uz" },
      {
        name: "access_token",
        value: "one.two.three",
        url: "https://www.olx.uz",
      },
      { name: "empty", value: "", url: "https://www.olx.uz" },
    ]);
  });

  test("keeps API headers but lets Chromium own protected browser headers", () => {
    expect(
      browserSafeHeaders({
        headers: {
          Authorization: "Bearer test",
          Cookie: "secret=value",
          Origin: "https://www.olx.uz",
          "User-Agent": "Test",
          "X-Device-Id": "device-1",
        },
      }),
    ).toEqual({
      authorization: "Bearer test",
      "x-device-id": "device-1",
    });
  });

  test("accepts only HTTPS olx.uz hosts", () => {
    expect(isAllowedOlxBrowserUrl("https://olx.uz/path")).toBe(true);
    expect(isAllowedOlxBrowserUrl("https://www.olx.uz/path")).toBe(true);
    expect(isAllowedOlxBrowserUrl("https://evilolx.uz/path")).toBe(false);
    expect(isAllowedOlxBrowserUrl("https://olx.uz.evil.example/path")).toBe(
      false,
    );
    expect(isAllowedOlxBrowserUrl("http://www.olx.uz/path")).toBe(false);
  });

  test("never disables the Chromium sandbox in production", () => {
    expect(shouldDisableOlxBrowserSandbox("production", "true")).toBe(false);
    expect(shouldDisableOlxBrowserSandbox("development", "true")).toBe(true);
    expect(shouldDisableOlxBrowserSandbox("development", "false")).toBe(false);
  });
});
