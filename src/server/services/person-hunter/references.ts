/**
 * Hardcoded reference dictionaries for the PersonHunters Vacancies API.
 *
 * Creating a vacancy requires numeric reference IDs (industry, country, region, city,
 * currency, employment, schedule, …), but — unlike hh.uz — PersonHunters exposes **no**
 * dictionary endpoints to enumerate the valid values (every `/.../dictionaries`-style probe
 * returns 404). So the options below are curated by hand.
 *
 * Every ID here has been confirmed against live API data (a successful `POST /vacancies`
 * round-trip and the labels echoed back on `GET /vacancies`). When PersonHunters ships more
 * reference values, extend these arrays — the shape is intentionally simple so the lists can
 * grow without touching the publish flow. IDs that are NOT verified should not be added
 * blindly: an unknown ID makes `create` fail with a 422 validation error.
 */

/** A selectable reference option: numeric `id` sent to the API, `name` shown to the user. */
export type PersonHunterReferenceOption = {
  id: number;
  name: string;
};

/** Vacancy industries (`industry_id`). */
const INDUSTRIES: PersonHunterReferenceOption[] = [
  { id: 3, name: "Информационные технологии" },
];

/** Countries (`country_id`). */
const COUNTRIES: PersonHunterReferenceOption[] = [{ id: 1, name: "Россия" }];

/** Regions / provinces (`region_id`). */
const REGIONS: PersonHunterReferenceOption[] = [
  { id: 1, name: "Ташкентская область" },
];

/** Cities (`city_id`). */
const CITIES: PersonHunterReferenceOption[] = [{ id: 1, name: "Ташкент" }];

/** Currencies (`currency_id`). Optional on create. */
const CURRENCIES: PersonHunterReferenceOption[] = [{ id: 1, name: "UZS" }];

/** Employment types (`employment_id`, multi-select). */
const EMPLOYMENTS: PersonHunterReferenceOption[] = [
  { id: 2, name: "Полная занятость" },
  { id: 4, name: "Проектная/Временная работа" },
];

/** Work schedules (`schedule_id`, multi-select). */
const SCHEDULES: PersonHunterReferenceOption[] = [
  { id: 20, name: "Сменный график" },
  { id: 22, name: "Удаленная работа" },
];

/** Publication statuses (`status`): 1 = visible/published, 0 = hidden. */
const STATUSES: PersonHunterReferenceOption[] = [
  { id: 1, name: "Опубликована" },
  { id: 0, name: "Скрыта" },
];

/** Languages the vacancy text can be submitted in (`lang`). */
const LANGUAGES = [
  { id: "ru", name: "Русский" },
  { id: "uz", name: "O‘zbekcha" },
  { id: "en", name: "English" },
] as const;

/** The full set of reference dictionaries handed to the publish form's dropdowns. */
export type PersonHunterReferences = {
  industries: PersonHunterReferenceOption[];
  countries: PersonHunterReferenceOption[];
  regions: PersonHunterReferenceOption[];
  cities: PersonHunterReferenceOption[];
  currencies: PersonHunterReferenceOption[];
  employments: PersonHunterReferenceOption[];
  schedules: PersonHunterReferenceOption[];
  statuses: PersonHunterReferenceOption[];
  languages: ReadonlyArray<{ id: string; name: string }>;
};

/** Returns every reference dictionary the publish form needs to render its selectors. */
export function getPersonHunterReferences(): PersonHunterReferences {
  return {
    industries: INDUSTRIES,
    countries: COUNTRIES,
    regions: REGIONS,
    cities: CITIES,
    currencies: CURRENCIES,
    employments: EMPLOYMENTS,
    schedules: SCHEDULES,
    statuses: STATUSES,
    languages: LANGUAGES,
  };
}
