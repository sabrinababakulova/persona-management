import { timingSafeEqual } from "node:crypto";
import "server-only";

import { env } from "~/env";

/**
 * Bearer authorization shared by every `/api/cron/*` route.
 *
 * Two things were wrong with the inline `authorization !== \`Bearer ${env.AUTH_SECRET}\`` this
 * replaces. It compared with `!==`, which short-circuits on the first differing byte, and it
 * reused the JWT signing key as a bearer credential — so the secret that forges sessions was
 * also sitting in crontab files and shell scripts, and rotating it for one purpose broke the
 * other.
 *
 * `CRON_SECRET` is the credential. It falls back to `AUTH_SECRET` when unset so an existing
 * deployment keeps working across the upgrade; set it and the two are independent.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const expectedSecret = env.CRON_SECRET ?? env.AUTH_SECRET;
  const expected = Buffer.from(`Bearer ${expectedSecret}`);
  const received = Buffer.from(request.headers.get("authorization") ?? "");

  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
