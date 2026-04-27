import { describe, expect, test } from "bun:test";

import { escapeLike } from "./sql";

describe("escapeLike", () => {
  test("escapes wildcard characters for ilike queries", () => {
    expect(escapeLike("%foo_bar\\baz")).toBe("\\%foo\\_bar\\\\baz");
  });
});
