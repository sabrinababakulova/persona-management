/**
 * Reference dictionaries for the PersonHunters Vacancies API.
 *
 * Creating a vacancy requires numeric reference IDs (industry, country, region, city, currency,
 * employment, schedule, status). PersonHunters serves all of them — already localized to the
 * requested language — from a single `GET /dictionaries` endpoint, so the publish form's
 * dropdowns are populated live rather than from a hand-maintained list.
 *
 * Note the wire quirks this module normalizes: most ids arrive as **strings** (e.g. `"3"`) while
 * `statuses` ids are numbers, and the currency `USD` has id `0`. We coerce every id to a number.
 */

import {
  buildPersonHunterHeaders,
  fetchPersonHunterJson,
  PERSON_HUNTER_API_BASE_URL,
  type PersonHunterLang,
} from "./shared";

/** A selectable reference option: numeric `id` sent to the API, `name` shown to the user. */
export type PersonHunterReferenceOption = {
  id: number;
  name: string;
};

/** The full set of reference dictionaries handed to the publish form's dropdowns. */
export type PersonHunterReferences = {
  statuses: PersonHunterReferenceOption[];
  currencies: PersonHunterReferenceOption[];
  industries: PersonHunterReferenceOption[];
  employments: PersonHunterReferenceOption[];
  schedules: PersonHunterReferenceOption[];
  countries: PersonHunterReferenceOption[];
  regions: PersonHunterReferenceOption[];
  cities: PersonHunterReferenceOption[];
  /** Languages a vacancy's text can be submitted in (`lang`). Not part of the API payload. */
  languages: ReadonlyArray<{ id: string; name: string }>;
};

/** Languages the vacancy text can be written/translated in. */
const SUPPORTED_LANGUAGES = [
  { id: "ru", name: "Русский" },
  { id: "uz", name: "O‘zbekcha" },
  { id: "en", name: "English" },
] as const;

/** Raw dictionary option as it appears on the wire (id may be a string or a number). */
type RawReferenceOption = { id?: number | string | null; name?: string | null };

type RawDictionaries = {
  statuses?: RawReferenceOption[] | null;
  currencies?: RawReferenceOption[] | null;
  industries?: RawReferenceOption[] | null;
  employments?: RawReferenceOption[] | null;
  schedules?: RawReferenceOption[] | null;
  countries?: RawReferenceOption[] | null;
  regions?: RawReferenceOption[] | null;
  cities?: RawReferenceOption[] | null;
};

/** Normalizes a raw dictionary list to numeric-id options, dropping entries without a usable id. */
function toOptions(
  raw: RawReferenceOption[] | null | undefined,
): PersonHunterReferenceOption[] {
  return (raw ?? [])
    .map((item): PersonHunterReferenceOption | null => {
      const id = typeof item.id === "number" ? item.id : Number(item.id);
      if (!Number.isFinite(id)) {
        return null;
      }
      return { id, name: item.name?.trim() ?? "" };
    })
    .filter((option): option is PersonHunterReferenceOption => option !== null);
}

/**
 * Fetches every reference dictionary from `GET /dictionaries`, localized to `lang`. Requires the
 * API key (the endpoint 401s without it). The supported `languages` list is appended locally
 * since the API doesn't return it.
 */
export async function fetchPersonHunterDictionaries(
  accessToken: string,
  lang: PersonHunterLang = "ru",
): Promise<PersonHunterReferences> {
  const searchParams = new URLSearchParams({ lang });

  const raw = await fetchPersonHunterJson<RawDictionaries>(
    `${PERSON_HUNTER_API_BASE_URL}/dictionaries?${searchParams}`,
    {
      headers: buildPersonHunterHeaders(accessToken),
      signal: AbortSignal.timeout(10_000),
    },
  );

  return {
    statuses: toOptions(raw?.statuses),
    currencies: toOptions(raw?.currencies),
    industries: toOptions(raw?.industries),
    employments: toOptions(raw?.employments),
    schedules: toOptions(raw?.schedules),
    countries: toOptions(raw?.countries),
    regions: toOptions(raw?.regions),
    cities: toOptions(raw?.cities),
    languages: SUPPORTED_LANGUAGES,
  };
}
