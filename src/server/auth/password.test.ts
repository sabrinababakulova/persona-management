import { describe, expect, test } from "bun:test";
import * as argon2 from "argon2";
import bcrypt from "bcryptjs";

import { hashPassword, verifyPassword } from "./password";

const PASSWORD = "Correct-Horse-1!";

describe("verifyPassword", () => {
  test("accepts a bcrypt digest", async () => {
    const hash = await bcrypt.hash(PASSWORD, 10);

    expect(await verifyPassword(hash, PASSWORD)).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  test("accepts an argon2 digest", async () => {
    // Login has always branched on the `$argon2` prefix; the profile procedures called
    // `bcrypt.compare` unconditionally, so these accounts could sign in but never change
    // or reset their password.
    const hash = await argon2.hash(PASSWORD);

    expect(hash.startsWith("$argon2")).toBe(true);
    expect(await verifyPassword(hash, PASSWORD)).toBe(true);
    expect(await verifyPassword(hash, "wrong")).toBe(false);
  });

  test("reports a malformed argon2 digest as a wrong password, not a throw", async () => {
    expect(await verifyPassword("$argon2id$broken", PASSWORD)).toBe(false);
  });

  test("hashPassword output verifies through the same helper", async () => {
    expect(await verifyPassword(await hashPassword(PASSWORD), PASSWORD)).toBe(
      true,
    );
  });
});
