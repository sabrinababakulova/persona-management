import { describe, expect, test } from "bun:test";

import { getRequestLocale } from "./server-locale";

describe("request locale", () => {
  test("prefers the explicit app locale header", () => {
    expect(
      getRequestLocale(
        new Headers({ cookie: "NEXT_LOCALE=ru", "x-app-locale": "uz" }),
      ),
    ).toBe("uz");
  });

  test("reads the platform locale cookie", () => {
    expect(getRequestLocale(new Headers({ cookie: "NEXT_LOCALE=en" }))).toBe(
      "en",
    );
  });

  test("defaults to Russian for unsupported locales", () => {
    expect(getRequestLocale(new Headers({ "x-app-locale": "fr" }))).toBe("ru");
  });
});
