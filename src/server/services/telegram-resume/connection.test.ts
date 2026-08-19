import { describe, expect, test } from "bun:test";

import { normalizeTelegramResumeGroupReference } from "./connection";

describe("Telegram resume group references", () => {
  test("accepts public handles and links", () => {
    expect(normalizeTelegramResumeGroupReference("@recruiting_team")).toBe(
      "@recruiting_team",
    );
    expect(normalizeTelegramResumeGroupReference("recruiting_team")).toBe(
      "@recruiting_team",
    );
    expect(
      normalizeTelegramResumeGroupReference("https://t.me/recruiting_team/"),
    ).toBe("@recruiting_team");
    expect(
      normalizeTelegramResumeGroupReference("telegram.me/recruiting_team"),
    ).toBe("@recruiting_team");
  });

  test("accepts private numeric group ids", () => {
    expect(normalizeTelegramResumeGroupReference(" -1001234567890 ")).toBe(
      "-1001234567890",
    );
  });

  test("rejects invite links, message links, and malformed values", () => {
    expect(
      normalizeTelegramResumeGroupReference("https://t.me/+invite-code"),
    ).toBe(null);
    expect(
      normalizeTelegramResumeGroupReference("https://t.me/c/123456/78"),
    ).toBe(null);
    expect(normalizeTelegramResumeGroupReference("@abc")).toBe(null);
    expect(normalizeTelegramResumeGroupReference("123456789")).toBe(null);
  });
});
