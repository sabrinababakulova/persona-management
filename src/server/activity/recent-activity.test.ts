import { describe, expect, test } from "bun:test";

import { buildActivityPreview, formatActivityTime } from "./recent-activity";

describe("recent activity helpers", () => {
  test("truncates long previews with ellipsis", () => {
    expect(buildActivityPreview("123456", 5)).toBe("1234…");
  });

  test("formats fresh timestamps as just now", () => {
    expect(formatActivityTime(new Date())).toBe("Только что");
  });
});
