/** PostgreSQL `unique_violation`. */
const UNIQUE_VIOLATION = "23505";

/**
 * Whether a thrown value is a PostgreSQL unique-constraint violation.
 *
 * postgres.js surfaces the SQLSTATE on `error.code`, but the error travels through Drizzle
 * (and sometimes a transaction wrapper) first, so the cause chain is walked rather than
 * inspecting only the top-level object.
 */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && current; depth += 1) {
    if (
      typeof current === "object" &&
      "code" in current &&
      (current as { code?: unknown }).code === UNIQUE_VIOLATION
    ) {
      return true;
    }
    current =
      typeof current === "object" && "cause" in current
        ? (current as { cause?: unknown }).cause
        : null;
  }

  return false;
}
