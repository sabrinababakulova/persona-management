import * as argon2 from "argon2";
import bcrypt from "bcryptjs";

/**
 * Password hashing lives behind these two helpers so every call site agrees on the format.
 *
 * The `user.password` column holds two shapes: argon2 digests (imported accounts) and bcrypt
 * digests (everything the app writes). Login has always branched on the prefix; the profile
 * procedures used to call `bcrypt.compare` unconditionally, which silently rejected every
 * correct argon2 password and left those accounts unable to change or reset it.
 */

/** Work factor for newly written passwords. Matches what registration has always used. */
export const PASSWORD_HASH_ROUNDS = 12;

function isArgon2Hash(hash: string) {
  return hash.startsWith("$argon2");
}

/** Verifies `plain` against a stored digest of either supported format. */
export async function verifyPassword(
  hash: string,
  plain: string,
): Promise<boolean> {
  if (isArgon2Hash(hash)) {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // A malformed or truncated argon2 digest must read as "wrong password",
      // never as a thrown 500 that tells the caller the hash is unusual.
      return false;
    }
  }

  return bcrypt.compare(plain, hash);
}

/** Hashes a new password in the format the app writes. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, PASSWORD_HASH_ROUNDS);
}
