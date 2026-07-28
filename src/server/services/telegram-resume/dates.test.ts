import { describe, expect, test } from "bun:test";

import { parseDatabaseTimestamp } from "./dates";

describe("parseDatabaseTimestamp", () => {
  test("preserves a valid Date", () => {
    const timestamp = new Date("2026-07-28T07:12:01.000Z");
    expect(parseDatabaseTimestamp(timestamp)).toBe(timestamp);
  });

  test("converts the string returned by a raw PostgreSQL query", () => {
    expect(
      parseDatabaseTimestamp("2026-07-28T07:12:01.000Z")?.toISOString(),
    ).toBe("2026-07-28T07:12:01.000Z");
  });

  test("preserves a missing Telegram message date as null", () => {
    expect(parseDatabaseTimestamp(null)).toBe(null);
  });

  test("rejects an invalid database timestamp", () => {
    let message = "";
    try {
      parseDatabaseTimestamp("not-a-date");
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message.includes("invalid message timestamp")).toBe(true);
  });
});
