import { describe, expect, test } from "bun:test";

import { env } from "~/env";
import { isAuthorizedCronRequest } from "./cron-auth";

function requestWith(authorization?: string) {
  return new Request("https://talanty.uz/api/cron/hh-enrich", {
    headers: authorization ? { authorization } : {},
  });
}

describe("isAuthorizedCronRequest", () => {
  const secret = env.CRON_SECRET ?? env.AUTH_SECRET;

  test("accepts the configured bearer secret", () => {
    expect(isAuthorizedCronRequest(requestWith(`Bearer ${secret}`))).toBe(true);
  });

  test("rejects a missing header", () => {
    expect(isAuthorizedCronRequest(requestWith())).toBe(false);
  });

  test("rejects the right secret under the wrong scheme", () => {
    expect(isAuthorizedCronRequest(requestWith(`Token ${secret}`))).toBe(false);
  });

  test("rejects a prefix of the secret", () => {
    // Length is compared before `timingSafeEqual`, which throws on unequal buffers.
    expect(
      isAuthorizedCronRequest(requestWith(`Bearer ${secret.slice(0, 8)}`)),
    ).toBe(false);
  });

  test("rejects a same-length wrong secret", () => {
    const wrong = `${"x".repeat(secret.length - 1)}y`;

    expect(isAuthorizedCronRequest(requestWith(`Bearer ${wrong}`))).toBe(false);
  });
});
