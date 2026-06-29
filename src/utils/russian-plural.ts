/**
 * Russian noun declension helpers.
 *
 * Russian picks one of three forms depending on the count:
 *  - `one`   — for numbers ending in 1, except 11        (1 год, 21 год)
 *  - `few`   — for numbers ending in 2–4, except 12–14   (2 года, 23 года)
 *  - `many`  — everything else, incl. 0 and 11–14        (5 лет, 11 лет)
 */

type PluralForms = {
  one: string;
  few: string;
  many: string;
};

/** Returns the noun form that agrees with `count` (the count itself is not prepended). */
export function pluralizeRussian(count: number, forms: PluralForms): string {
  const abs = Math.abs(count) % 100;
  const lastDigit = abs % 10;

  if (abs > 10 && abs < 20) {
    return forms.many;
  }
  if (lastDigit > 1 && lastDigit < 5) {
    return forms.few;
  }
  if (lastDigit === 1) {
    return forms.one;
  }
  return forms.many;
}

/** "1 год", "2 года", "5 лет" — correctly declined. */
export function formatRussianYears(years: number): string {
  return `${years} ${pluralizeRussian(years, {
    one: "год",
    few: "года",
    many: "лет",
  })}`;
}

/** "1 месяц", "2 месяца", "5 месяцев" — correctly declined. */
export function formatRussianMonths(months: number): string {
  return `${months} ${pluralizeRussian(months, {
    one: "месяц",
    few: "месяца",
    many: "месяцев",
  })}`;
}

/**
 * Formats a total experience duration (stored as an integer number of months) into a
 * correctly-declined Russian string, e.g. 25 → "2 года 1 мес.", 60 → "5 лет", 3 → "3 мес.".
 * Returns "" for null/zero. Months keep the grammar-invariant "мес." abbreviation.
 */
export function formatExperienceMonths(
  months: number | null | undefined,
): string {
  if (!months) return "";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years > 0 && remainingMonths > 0)
    return `${formatRussianYears(years)} ${remainingMonths} мес.`;
  if (years > 0) return formatRussianYears(years);
  return `${remainingMonths} мес.`;
}
