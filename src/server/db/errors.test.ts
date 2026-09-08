import { describe, expect, test } from "bun:test";

import { isUniqueViolation } from "./errors";

describe("isUniqueViolation", () => {
  test("detects a top-level SQLSTATE 23505", () => {
    expect(
      isUniqueViolation(Object.assign(new Error("dup"), { code: "23505" })),
    ).toBe(true);
  });

  test("detects one wrapped in a cause chain", () => {
    // Drizzle and the transaction wrapper both re-throw, so the driver error arrives nested.
    const driverError = Object.assign(new Error("dup"), { code: "23505" });
    const wrapped = new Error("insert failed", { cause: driverError });

    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  test("ignores other SQLSTATEs", () => {
    expect(
      isUniqueViolation(Object.assign(new Error("null"), { code: "23502" })),
    ).toBe(false);
  });

  test("ignores non-errors", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});
