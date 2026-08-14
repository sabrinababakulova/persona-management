import { describe, expect, test } from "bun:test";
import { decryptOlxCredentials, encryptOlxCredentials } from "./crypto";

describe("OLX API credential encryption", () => {
  const secret = "a".repeat(32);
  const credentials = {
    version: 1,
    source: "olx_ciam",
    accessToken: "access-token-value-that-is-long-enough",
    refreshToken: "refresh-token-value-that-is-long-enough",
    idToken: "identity-token-value-that-is-long-enough",
    deviceId: "test-device-id-123",
    fingerprint: "test-browser-fingerprint-123",
    cookieHeader: "deviceGUID=test-device; lang=ru",
    userAgent:
      "Mozilla/5.0 Test Browser AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36",
  };

  test("round-trips credentials", () => {
    const encrypted = encryptOlxCredentials(credentials, secret);
    expect(encrypted).not.toContain(credentials.accessToken);
    expect(decryptOlxCredentials(encrypted, secret)).toEqual(credentials);
  });

  test("rejects the wrong key", () => {
    const encrypted = encryptOlxCredentials(credentials, secret);
    expect(() => decryptOlxCredentials(encrypted, "b".repeat(32))).toThrow();
  });

  test("rejects a modified payload", () => {
    const encrypted = encryptOlxCredentials(credentials, secret);
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;
    expect(() => decryptOlxCredentials(tampered, secret)).toThrow();
  });
});
