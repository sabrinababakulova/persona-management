import { describe, expect, test } from "bun:test";

import { normalizeTelegramUsername } from "./telegram";

describe("normalizeTelegramUsername", () => {
  test("accepts the shapes a recruiter is likely to paste", () => {
    // All four must collapse to the same stored value, otherwise the /start
    // lookup misses and the admin silently never receives anything.
    for (const input of [
      "ivanov",
      "@ivanov",
      "https://t.me/ivanov",
      "  @ivanov  ",
    ]) {
      expect(normalizeTelegramUsername(input)).toBe("ivanov");
    }
  });

  test("lowercases, since Telegram handles are case-insensitive", () => {
    expect(normalizeTelegramUsername("@IvanOv")).toBe("ivanov");
  });

  test("rejects handles Telegram itself would not allow", () => {
    expect(normalizeTelegramUsername("abc")).toBeNull(); // under 5 chars
    expect(normalizeTelegramUsername("a".repeat(33))).toBeNull(); // over 32
    expect(normalizeTelegramUsername("ivan ov")).toBeNull(); // space
    expect(normalizeTelegramUsername("ivan-ov")).toBeNull(); // dash
    expect(normalizeTelegramUsername("")).toBeNull();
  });

  test("keeps underscores and digits", () => {
    expect(normalizeTelegramUsername("@ivan_ov_42")).toBe("ivan_ov_42");
  });
});
