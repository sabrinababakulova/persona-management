import { describe, expect, test } from "bun:test";
import { decryptOlxStorageState, encryptOlxStorageState } from "./crypto";

describe("OLX browser session encryption", () => {
  const secret = "a".repeat(32);
  const state = {
    cookies: [
      {
        name: "session",
        value: "sensitive-value",
        domain: ".olx.uz",
        path: "/",
        expires: -1,
        httpOnly: true,
        secure: true,
        sameSite: "Lax" as const,
      },
    ],
    origins: [],
  };

  test("round-trips storage state without exposing cookie values", () => {
    const encrypted = encryptOlxStorageState(state, secret);
    expect(encrypted).not.toContain("sensitive-value");
    expect(decryptOlxStorageState(encrypted, secret)).toEqual(state);
  });

  test("rejects the wrong application secret", () => {
    const encrypted = encryptOlxStorageState(state, secret);
    expect(() => decryptOlxStorageState(encrypted, "b".repeat(32))).toThrow();
  });

  test("rejects tampered ciphertext", () => {
    const encrypted = encryptOlxStorageState(state, secret);
    const tampered = `${encrypted.slice(0, -2)}aa`;
    expect(() => decryptOlxStorageState(tampered, secret)).toThrow();
  });
});
