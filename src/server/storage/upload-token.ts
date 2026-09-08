import { createHmac, timingSafeEqual } from "node:crypto";
import "server-only";

import { env } from "~/env";

/**
 * Binds a freshly uploaded Directus file to the account that uploaded it.
 *
 * `storage.uploadImage` hands the client a bare file id, and the mutations that persist one
 * (`profile.updateAvatar`, `company.updateLogo`) used to accept whatever id they were given.
 * Since the id is opaque but not secret — the app hands them out in `logoUrl`, member lists
 * and vacancy payloads — a caller could point their avatar at another company's logo, and the
 * "delete the previous file" cleanup would then destroy it on the next replacement.
 *
 * A short HMAC over `(userId, fileId)` closes that without a new table: only the uploader
 * holds a valid handle, and it is worthless to anyone else.
 */
function sign(userId: string, fileId: string) {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(`upload:${userId}:${fileId}`)
    .digest("hex");
}

export function createUploadToken(userId: string, fileId: string) {
  return sign(userId, fileId);
}

export function verifyUploadToken(
  userId: string,
  fileId: string,
  token: string,
) {
  const expected = Buffer.from(sign(userId, fileId));
  const received = Buffer.from(token);

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
