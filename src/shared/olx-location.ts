export const OLX_DEFAULT_LOCATION = "Ташкент";

export const OLX_LOCATION_INPUT_REGEX =
  /^[\p{Script=Latin}\p{Script=Cyrillic}\s'’‘ʻʼ-]*$/u;

const UNSUPPORTED_LOCATION_CHARACTERS =
  /[^\p{Script=Latin}\p{Script=Cyrillic}\s'’‘ʻʼ-]/gu;

const ENGLISH_CITY_ALIASES = [
  ["almalyk", "Olmaliq"],
  ["andijan", "Andijon"],
  ["bekabad", "Bekobod"],
  ["bukhara", "Buxoro"],
  ["chirchik", "Chirchiq"],
  ["denau", "Denov"],
  ["fergana", "Farg‘ona"],
  ["gulistan", "Guliston"],
  ["jizzakh", "Jizzax"],
  ["kagan", "Kogon"],
  ["karshi", "Qarshi"],
  ["kattakurgan", "Kattaqo‘rg‘on"],
  ["khiva", "Xiva"],
  ["kokand", "Qo‘qon"],
  ["margilan", "Marg‘ilon"],
  ["samarkand", "Samarqand"],
  ["shakhrisabz", "Shahrisabz"],
  ["tashkent", "Toshkent"],
  ["termez", "Termiz"],
  ["urgench", "Urganch"],
  ["zarafshan", "Zarafshon"],
] as const;

/** Allows OLX's supported Latin/Cyrillic city names and rejects other input. */
export function sanitizeOlxLocationInput(value: string): string {
  return value
    .normalize("NFC")
    .replace(UNSUPPORTED_LOCATION_CHARACTERS, "")
    .replace(/\s{2,}/gu, " ")
    .slice(0, 100);
}

/**
 * OLX's Uzbekistan endpoint understands Russian and Uzbek spellings, but not
 * several common English spellings. Resolve those aliases before searching.
 */
export function resolveOlxLocationSearchQuery(value: string): string {
  const sanitized = sanitizeOlxLocationInput(value).trim();
  const normalized = sanitized.toLocaleLowerCase("en-US");
  if (normalized.length < 3 || /\p{Script=Cyrillic}/u.test(normalized)) {
    return sanitized;
  }

  const matches = ENGLISH_CITY_ALIASES.filter(([english]) =>
    english.startsWith(normalized),
  );
  return matches.length === 1 ? (matches[0]?.[1] ?? sanitized) : sanitized;
}
