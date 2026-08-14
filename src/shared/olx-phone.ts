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

export const OLX_UZ_PHONE_PREFIX = "+998 ";
export const OLX_UZ_PHONE_HTML_PATTERN =
  "\\+998 [2-9][0-9] [0-9]{3} [0-9]{2} [0-9]{2}";

/**
 * Keeps the Uzbekistan prefix fixed and groups up to nine national digits as
 * the user types. Characters that are not digits never enter the field.
 */
export function formatOlxUzPhoneInput(value: string): string {
  const digits = value.replace(/\D/gu, "");
  if (!digits) return OLX_UZ_PHONE_PREFIX;

  const hasInternationalPrefix =
    value.trim().startsWith("+998") ||
    (digits.length > 9 && digits.startsWith("998"));
  if (
    (value.trim().startsWith("+") || digits.length > 9) &&
    !hasInternationalPrefix
  ) {
    return OLX_UZ_PHONE_PREFIX;
  }

  const nationalNumber = (
    hasInternationalPrefix ? digits.slice(3) : digits
  ).slice(0, 9);
  const groups = [
    nationalNumber.slice(0, 2),
    nationalNumber.slice(2, 5),
    nationalNumber.slice(5, 7),
    nationalNumber.slice(7, 9),
  ].filter(Boolean);

  return `${OLX_UZ_PHONE_PREFIX}${groups.join(" ")}`;
}

export function hasOlxUzPhoneDigits(value: string): boolean {
  const digits = value.replace(/\D/gu, "");
  return (digits.startsWith("998") ? digits.slice(3) : digits).length > 0;
}

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
