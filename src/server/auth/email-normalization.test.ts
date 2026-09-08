import { describe, expect, test } from "bun:test";

import { normalizeEmail } from "./email-verification";

describe("normalizeEmail", () => {
  test("lower-cases and trims", () => {
    expect(normalizeEmail("  Recruiter@Talanty.UZ ")).toBe(
      "recruiter@talanty.uz",
    );
  });

  test("collapses a plus alias onto the base address", () => {
    expect(normalizeEmail("recruiter+hh@talanty.uz")).toBe(
      "recruiter@talanty.uz",
    );
  });

  test("is idempotent", () => {
    const once = normalizeEmail("Recruiter+hh@Talanty.uz");

    expect(normalizeEmail(once)).toBe(once);
  });

  test("leaves a plus in the domain alone", () => {
    expect(normalizeEmail("a@b+c.uz")).toBe("a@b+c.uz");
  });

  test("returns input unchanged when there is no @", () => {
    expect(normalizeEmail("not-an-email")).toBe("not-an-email");
  });
});
