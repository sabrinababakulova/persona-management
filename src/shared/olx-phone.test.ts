import { describe, expect, test } from "bun:test";
import { olxContactPhoneSchema } from "~/server/api/routers/vacancies/schemas";
import {
  formatOlxUzPhoneInput,
  hasOlxUzPhoneDigits,
  normalizeOlxUzPhone,
  OLX_UZ_PHONE_PREFIX,
} from "~/shared/olx-phone";

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

  test("adds the Uzbekistan prefix and formats partial input immediately", () => {
    expect(formatOlxUzPhoneInput("")).toBe(OLX_UZ_PHONE_PREFIX);
    expect(formatOlxUzPhoneInput("9")).toBe("+998 9");
    expect(formatOlxUzPhoneInput("90123")).toBe("+998 90 123");
    expect(formatOlxUzPhoneInput("998123456")).toBe("+998 99 812 34 56");
    expect(formatOlxUzPhoneInput("998901234567")).toBe("+998 90 123 45 67");
    expect(formatOlxUzPhoneInput("+998 (90) 123-45-67")).toBe(
      "+998 90 123 45 67",
    );
    expect(formatOlxUzPhoneInput("+1 202 555 0123")).toBe(OLX_UZ_PHONE_PREFIX);
    expect(hasOlxUzPhoneDigits(OLX_UZ_PHONE_PREFIX)).toBe(false);
    expect(hasOlxUzPhoneDigits("+998 90")).toBe(true);
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
