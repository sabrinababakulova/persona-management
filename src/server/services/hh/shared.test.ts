import { describe, expect, test } from "bun:test";

import { HhApiError, isHhAuthenticationError } from "./shared";

describe("isHhAuthenticationError", () => {
  test("recognizes a rejected hh.uz access token", () => {
    expect(isHhAuthenticationError(new HhApiError(401, "{}"))).toBe(true);
    expect(
      isHhAuthenticationError(
        new HhApiError(
          403,
          JSON.stringify({
            errors: [{ type: "oauth", value: "token_expired" }],
          }),
        ),
      ),
    ).toBe(true);
  });

  test("does not classify permission or unrelated failures as expired auth", () => {
    expect(isHhAuthenticationError(new HhApiError(403, "{}"))).toBe(false);
    expect(isHhAuthenticationError(new Error("network unavailable"))).toBe(
      false,
    );
  });
});
