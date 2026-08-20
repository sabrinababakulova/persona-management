import { describe, expect, test } from "bun:test";

import { updateCompanySchema } from "~/schemas/company";

const VALID_COMPANY = {
  name: "Talanty",
  city: "Tashkent",
  country: "Uzbekistan",
  description: "",
  website: "",
};

describe("company phone validation", () => {
  test("keeps the optional phone empty", () => {
    expect(
      updateCompanySchema.parse({ ...VALID_COMPANY, phone: "" }).phone,
    ).toBe("");
  });

  test("accepts and normalizes common Uzbekistan phone formats", () => {
    for (const phone of [
      "+998 90 123 45 67",
      "+998901234567",
      "998901234567",
      "90 123 45 67",
      "901234567",
    ]) {
      expect(updateCompanySchema.parse({ ...VALID_COMPANY, phone }).phone).toBe(
        "+998901234567",
      );
    }
  });

  test("rejects malformed and non-Uzbekistan phone numbers", () => {
    for (const phone of [
      "+1 202 555 0123",
      "+998 90 123 45",
      "+998 01 123 45 67",
      "+998 90 12A 45 67",
    ]) {
      expect(
        updateCompanySchema.safeParse({ ...VALID_COMPANY, phone }).success,
      ).toBe(false);
    }
  });
});
