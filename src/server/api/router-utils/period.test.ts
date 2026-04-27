import { describe, expect, test } from "bun:test";

import { getPeriodDateCutoff } from "./period";

describe("getPeriodDateCutoff", () => {
  test("moves day back by one day", () => {
    const now = new Date();
    const cutoff = getPeriodDateCutoff("day");

    expect(now.getTime() - cutoff.getTime()).toBeGreaterThan(0);
    expect(now.getTime() - cutoff.getTime()).toBeLessThanOrEqual(
      24 * 60 * 60 * 1000 + 1000,
    );
  });

  test("moves year back by about one year", () => {
    const now = new Date();
    const cutoff = getPeriodDateCutoff("year");

    expect(cutoff.getFullYear()).toBe(now.getFullYear() - 1);
  });
});
