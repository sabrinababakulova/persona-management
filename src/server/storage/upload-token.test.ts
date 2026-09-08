import { describe, expect, test } from "bun:test";

import { createUploadToken, verifyUploadToken } from "./upload-token";

describe("upload handles", () => {
  test("verifies for the user and file it was issued to", () => {
    const token = createUploadToken("user-1", "file-a");

    expect(verifyUploadToken("user-1", "file-a", token)).toBe(true);
  });

  test("does not verify for another user", () => {
    // The point of the handle: a file id is opaque but not secret, so without this a caller
    // could claim someone else's logo or avatar as their own.
    const token = createUploadToken("user-1", "file-a");

    expect(verifyUploadToken("user-2", "file-a", token)).toBe(false);
  });

  test("does not verify for another file", () => {
    const token = createUploadToken("user-1", "file-a");

    expect(verifyUploadToken("user-1", "file-b", token)).toBe(false);
  });

  test("rejects an empty or truncated token without throwing", () => {
    const token = createUploadToken("user-1", "file-a");

    expect(verifyUploadToken("user-1", "file-a", "")).toBe(false);
    expect(verifyUploadToken("user-1", "file-a", token.slice(0, 10))).toBe(
      false,
    );
  });
});
