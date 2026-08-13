import { describe, expect, test } from "bun:test";
import { olxContactPhoneSchema } from "~/server/api/routers/vacancies/schemas";
import { formatOlxUzPhone, normalizeOlxUzPhone } from "~/shared/olx-phone";

describe("OLX Uzbekistan phone validation", () => {
  test("normalizes common local and international input styles", () => {
    for (const value of [
      "+998901234567",
      "+998 90 123 45 67",
      "+998 (90) 123-45-67",
      "998901234567",
      "90 123 45 67",
      "901234567",
    ]) {
      expect(normalizeOlxUzPhone(value)).toBe("+998901234567");
      expect(olxContactPhoneSchema.parse(value)).toBe("+998901234567");
    }
  });

  test("formats valid values for the publication form", () => {
    expect(formatOlxUzPhone("998901234567")).toBe("+998 90 123 45 67");
  });

  test("rejects malformed and non-Uzbekistan phone numbers", () => {
    for (const value of [
      "+1 202 555 0123",
      "+998 90 123 45",
      "+998 01 123 45 67",
      "+998 90 12A 45 67",
      "+998 90.123.45.67",
      "9989981234567",
    ]) {
      expect(normalizeOlxUzPhone(value)).toBeNull();
      expect(olxContactPhoneSchema.safeParse(value).success).toBe(false);
    }
  });
});
