import { describe, expect, test } from "bun:test";
import {
  browserSafeHeaders,
  cookieHeaderToBrowserCookies,
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
});
