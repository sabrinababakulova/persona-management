import { describe, expect, test } from "bun:test";

import { summarizeTelegramDeletion } from "./telegram-deletion";

describe("summarizeTelegramDeletion", () => {
  test("reports a fully successful deletion as complete", () => {
    const summary = summarizeTelegramDeletion([
      { url: "https://t.me/a/1", error: null },
      { url: "https://t.me/b/2", error: null },
    ]);

    expect(summary.isComplete).toBe(true);
    expect(summary.errors).toEqual([]);
    expect(summary.deletedUrls).toEqual([
      "https://t.me/a/1",
      "https://t.me/b/2",
    ]);
  });

  test("does not report success when only some messages were deleted", () => {
    // Regression: a partial failure used to fall through as a clean success,
    // deactivating the publication while messages stayed live in Telegram.
    const summary = summarizeTelegramDeletion([
      { url: "https://t.me/a/1", error: null },
      { url: "https://t.me/b/2", error: "@b: message can't be deleted" },
      { url: "https://t.me/c/3", error: null },
    ]);

    expect(summary.isComplete).toBe(false);
    expect(summary.errors).toEqual(["@b: message can't be deleted"]);
  });

  test("keeps only confirmed deletions so a retry re-attempts the rest", () => {
    // The surviving rows are what a retry works from; including a URL that was
    // never deleted would strand a live message with no record of it.
    const summary = summarizeTelegramDeletion([
      { url: "https://t.me/a/1", error: null },
      { url: "https://t.me/b/2", error: "@b: forbidden" },
    ]);

    expect(summary.deletedUrls).toEqual(["https://t.me/a/1"]);
    expect(summary.deletedUrls).not.toContain("https://t.me/b/2");
  });

  test("reports a total failure as incomplete with every error", () => {
    const summary = summarizeTelegramDeletion([
      { url: "https://t.me/a/1", error: "@a: forbidden" },
      { url: "https://t.me/b/2", error: "@b: forbidden" },
    ]);

    expect(summary.isComplete).toBe(false);
    expect(summary.deletedUrls).toEqual([]);
    expect(summary.errors).toHaveLength(2);
  });

  test("treats an empty attempt list as complete", () => {
    const summary = summarizeTelegramDeletion([]);

    expect(summary.isComplete).toBe(true);
    expect(summary.deletedUrls).toEqual([]);
  });
});
