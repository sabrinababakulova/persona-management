import { describe, expect, test } from "bun:test";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import {
  decryptOlxCredentials,
  encryptOlxCredentials,
  olxEncryptionKeyId,
} from "./crypto";

describe("OLX API credential encryption", () => {
  const secret = "a".repeat(32);
  const key = { id: olxEncryptionKeyId(secret), secret };
  const aad = "user:user-1\0olx-session:session-1";
  const credentials = {
    version: 1,
    source: "olx_ciam",
    accessToken: "access-token-value-that-is-long-enough",
    refreshToken: "refresh-token-value-that-is-long-enough",
    deviceId: "test-device-id-123",
    fingerprint: "test-browser-fingerprint-123",
    cookieHeader: "deviceGUID=test-device",
    userAgent:
      "Mozilla/5.0 Test Browser AppleWebKit/537.36 Chrome/151.0.0.0 Safari/537.36",
  };

  function encryptLegacy(value: unknown): string {
    const iv = randomBytes(12);
    const legacyKey = createHash("sha256")
      .update("persona:olx-api-credentials:v1")
      .update("\0")
      .update(secret)
      .digest();
    const cipher = createCipheriv("aes-256-gcm", legacyKey, iv);
    const data = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(value), "utf8")),
      cipher.final(),
    ]);
    return Buffer.from(
      JSON.stringify({
        v: 1,
        iv: iv.toString("base64url"),
        tag: cipher.getAuthTag().toString("base64url"),
        data: data.toString("base64url"),
      }),
      "utf8",
    ).toString("base64url");
  }

  test("round-trips credentials", () => {
    const encrypted = encryptOlxCredentials(credentials, key, aad);
    expect(encrypted).not.toContain(credentials.accessToken);
    expect(decryptOlxCredentials(encrypted, [key], aad)).toEqual(credentials);
  });

  test("rejects the wrong key", () => {
    const encrypted = encryptOlxCredentials(credentials, key, aad);
    const wrongSecret = "b".repeat(32);
    expect(() =>
      decryptOlxCredentials(
        encrypted,
        [{ id: olxEncryptionKeyId(wrongSecret), secret: wrongSecret }],
        aad,
      ),
    ).toThrow();
  });

  test("rejects a modified payload", () => {
    const encrypted = encryptOlxCredentials(credentials, key, aad);
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith("A") ? "B" : "A"}`;
    expect(() => decryptOlxCredentials(tampered, [key], aad)).toThrow();
  });

  test("binds ciphertext to its user and session", () => {
    const encrypted = encryptOlxCredentials(credentials, key, aad);
    expect(() =>
      decryptOlxCredentials(
        encrypted,
        [key],
        "user:user-2\0olx-session:session-1",
      ),
    ).toThrow();
  });

  test("decrypts with a retained rotation key", () => {
    const encrypted = encryptOlxCredentials(credentials, key, aad);
    const nextSecret = "c".repeat(32);
    const nextKey = { id: olxEncryptionKeyId(nextSecret), secret: nextSecret };
    expect(decryptOlxCredentials(encrypted, [nextKey, key], aad)).toEqual(
      credentials,
    );
  });

  test("reads legacy AUTH_SECRET ciphertext during migration", () => {
    expect(
      decryptOlxCredentials(encryptLegacy(credentials), [key], aad, secret),
    ).toEqual(credentials);
  });
});
