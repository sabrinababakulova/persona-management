import { describe, expect, test } from "bun:test";

import { getClientIp } from "./client-ip";

function headers(entries: Record<string, string>) {
  return new Headers(entries);
}

describe("getClientIp", () => {
  test("prefers x-real-ip", () => {
    expect(
      getClientIp(
        headers({
          "x-real-ip": "203.0.113.7",
          "x-forwarded-for": "198.51.100.1",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  test("takes the rightmost x-forwarded-for entry, not the leftmost", () => {
    // nginx appends the socket peer, so everything to the left is client-supplied. Reading
    // the leftmost entry let a caller rotate the header and bypass every per-IP limit.
    expect(
      getClientIp(
        headers({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 203.0.113.7" }),
      ),
    ).toBe("203.0.113.7");
  });

  test("a spoofed leftmost value does not change the result", () => {
    const spoofed = getClientIp(
      headers({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }),
    );
    const alsoSpoofed = getClientIp(
      headers({ "x-forwarded-for": "8.8.8.8, 203.0.113.7" }),
    );

    expect(spoofed).toBe(alsoSpoofed);
  });

  test("ignores empty entries and surrounding whitespace", () => {
    expect(
      getClientIp(headers({ "x-forwarded-for": " 1.1.1.1 , 203.0.113.7 , " })),
    ).toBe("203.0.113.7");
  });

  test("falls back to a constant when no proxy header is present", () => {
    expect(getClientIp(headers({}))).toBe("unknown");
  });

  test("caps an absurdly long value", () => {
    expect(getClientIp(headers({ "x-real-ip": "a".repeat(500) })).length).toBe(
      100,
    );
  });
});
