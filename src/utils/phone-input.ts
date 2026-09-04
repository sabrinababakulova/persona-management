const PHONE_INPUT_MAX_LENGTH = 50;

/** Keeps only characters that can form a human-readable international phone number. */
export function sanitizePhoneInput(value: string): string {
  let sanitized = "";

  for (const character of value) {
    if (
      /\d/u.test(character) ||
      character === "(" ||
      character === ")" ||
      character === "-"
    ) {
      sanitized += character;
    } else if (character === "+" && sanitized.length === 0) {
      sanitized += character;
    } else if (
      character === " " &&
      sanitized.length > 0 &&
      !sanitized.endsWith(" ")
    ) {
      sanitized += character;
    }

    if (sanitized.length >= PHONE_INPUT_MAX_LENGTH) {
      break;
    }
  }

  return sanitized;
}

export function isPhoneContactType(value: string): boolean {
  return value.trim().toLowerCase() === "phone";
}
