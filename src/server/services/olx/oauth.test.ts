import { describe, expect, test } from "bun:test";

import { buildOlxConnectState, parseOlxConnectState } from "./oauth";

describe("OLX OAuth state", () => {
  test("round-trips a signed user-bound state", () => {
    const state = buildOlxConnectState({ userId: "user-123" });
    const parsed = parseOlxConnectState(state);

    expect(parsed?.userId).toBe("user-123");
    expect(parsed?.issuedAt).toBeGreaterThan(Date.now() - 1000);
  });

  test("rejects a modified signature", () => {
    const state = buildOlxConnectState({ userId: "user-123" });
    const tampered = `${state.slice(0, -1)}${state.endsWith("a") ? "b" : "a"}`;

    expect(parseOlxConnectState(tampered)).toBeNull();
  });
});
