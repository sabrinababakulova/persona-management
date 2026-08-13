/**
 * Human-entered Uzbekistan phone formats accepted by the OLX publication UI.
 *
 * The first two national digits are an Uzbekistan destination/network code.
 * Keeping the rule at `[2-9]\d` avoids accepting an obviously invalid leading
 * zero/one without hard-coding an operator list that can change over time.
 */
export const OLX_UZ_PHONE_INPUT_REGEX =
  /^(?:(?:\+998|998)[ -]?)?(?:[2-9]\d|\([2-9]\d\))[ -]?\d{3}[ -]?\d{2}[ -]?\d{2}$/u;

/** Canonical value persisted in Persona and entered into the OLX.uz form. */
export const OLX_UZ_PHONE_CANONICAL_REGEX = /^\+998[2-9]\d{8}$/u;

export const OLX_UZ_PHONE_EXAMPLE = "+998 90 123 45 67";

/**
 * Converts an accepted human-readable value into Uzbekistan E.164 form.
 * Returns null instead of guessing when the input does not match the rule.
 */
export function normalizeOlxUzPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!OLX_UZ_PHONE_INPUT_REGEX.test(trimmed)) {
    return null;
  }

  const digits = trimmed.replace(/\D/gu, "");
  const nationalNumber = digits.length === 12 ? digits.slice(3) : digits;
  const normalized = `+998${nationalNumber}`;

  return OLX_UZ_PHONE_CANONICAL_REGEX.test(normalized) ? normalized : null;
}

/** Formats a valid value for display without changing its canonical meaning. */
export function formatOlxUzPhone(value: string): string | null {
  const normalized = normalizeOlxUzPhone(value);
  if (!normalized) {
    return null;
  }

  return normalized.replace(
    /^(\+998)(\d{2})(\d{3})(\d{2})(\d{2})$/u,
    "$1 $2 $3 $4 $5",
  );
}
