/**
 * CRUD operations against the PersonHunters Vacancies API (v1):
 *  - list           → GET    /vacancies
 *  - getById        → GET    /vacancies/{id}
 *  - create         → POST   /vacancies
 *  - update/localize→ PUT    /vacancies/{id}
 *  - delete         → DELETE /vacancies/{id}
 *
 * See README.md (PersonHunters) for the full contract. All mutating calls require the owner's
 * Bearer access token; reads accept an optional token (needed only for hidden vacancies).
 */

import {
  buildPersonHunterHeaders,
  fetchPersonHunterJson,
  PERSON_HUNTER_API_BASE_URL,
  PersonHunterApiError,
  type PersonHunterLang,
  type PersonHunterVacancy,
  type PersonHunterVacancyPage,
  type PersonHunterVacancyRaw,
  toPersonHunterVacancy,
} from "./shared";

/** Default request timeout. Matches the 10s budget the hh.uz service uses for reads/writes. */
const PERSON_HUNTER_TIMEOUT_MS = 10_000;

/**
 * Body for creating a vacancy (POST /vacancies). System references are passed as numeric
 * ids; multi-value fields (employment, schedule) as arrays of ids. `lang` tags which
 * language the supplied text fields are written in.
 *
 * Mind the API's field naming: the title goes in as `vacancy_name` and the company blurb
 * as `vacancy_description`, but the three rich-text sections are sent WITHOUT the
 * `vacancy_` prefix (`duties`, `requirements`, `conditions`) even though reads echo them
 * back prefixed. {@link buildVacancyBody} handles that rename.
 */
export type CreatePersonHunterVacancyInput = {
  name: string;
  uniqueCode?: string;
  payFrom?: number | null;
  payTo?: number | null;
  currencyId?: number;
  industryId?: number;
  status?: number;
  countryId?: number;
  cityId?: number;
  regionId?: number;
  experienceFrom?: number | null;
  experienceTo?: number | null;
  employmentIds?: number[];
  scheduleIds?: number[];
  lang?: PersonHunterLang;
  description?: string;
  duties?: string;
  requirements?: string;
  conditions?: string;
};

/**
 * Body for editing a vacancy (PUT /vacancies/{id}). Every field is optional — send only
 * what changes. Two common shapes:
 *  - partial update: e.g. `{ payFrom, status }`
 *  - add a translation: `{ lang, name, duties, requirements, conditions, description }`
 *    (numeric fields like salary/city don't need to be repeated for a translation).
 */
export type UpdatePersonHunterVacancyInput =
  Partial<CreatePersonHunterVacancyInput>;

/**
 * Translates a camelCase input object into the snake_case JSON body the API expects.
 * Only defined keys are emitted, so partial updates touch only the fields the caller set.
 * `status` is checked for `undefined` (not falsiness) on purpose — `status: 0` is the
 * valid "unpublish" value and must not be dropped.
 */
function buildVacancyBody(
  input: UpdatePersonHunterVacancyInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};

  if (input.name !== undefined) body.vacancy_name = input.name;
  if (input.uniqueCode !== undefined) body.unique_code = input.uniqueCode;
  if (input.payFrom !== undefined) body.pay_from = input.payFrom;
  if (input.payTo !== undefined) body.pay_to = input.payTo;
  if (input.currencyId !== undefined) body.currency_id = input.currencyId;
  if (input.industryId !== undefined) body.industry_id = input.industryId;
  if (input.status !== undefined) body.status = input.status;
  if (input.countryId !== undefined) body.country_id = input.countryId;
  if (input.cityId !== undefined) body.city_id = input.cityId;
  if (input.regionId !== undefined) body.region_id = input.regionId;
  if (input.experienceFrom !== undefined) {
    body.experience_from = input.experienceFrom;
  }
  if (input.experienceTo !== undefined) {
    body.experience_to = input.experienceTo;
  }
  if (input.employmentIds !== undefined) {
    body.employment_id = input.employmentIds;
  }
  if (input.scheduleIds !== undefined) body.schedule_id = input.scheduleIds;
  if (input.lang !== undefined) body.lang = input.lang;
  if (input.description !== undefined) {
    body.vacancy_description = input.description;
  }
  // The text sections drop the `vacancy_` prefix on writes (see the type docs above).
  if (input.duties !== undefined) body.duties = input.duties;
  if (input.requirements !== undefined) body.requirements = input.requirements;
  if (input.conditions !== undefined) body.conditions = input.conditions;

  return body;
}

/**
 * Lists vacancies with pagination. Pagination metadata lives in the Yii2 response headers
 * (`X-Pagination-*`), so this reads them directly rather than expecting an envelope around
 * the items. The body itself is a bare JSON array of vacancy objects (also tolerates a
 * `{ items: [...] }` / `{ data: [...] }` wrapper defensively).
 */
export async function fetchPersonHunterVacancies(input: {
  accessToken?: string;
  lang?: PersonHunterLang;
  page?: number;
  perPage?: number;
}): Promise<PersonHunterVacancyPage> {
  const searchParams = new URLSearchParams();
  if (input.lang) searchParams.set("lang", input.lang);
  if (input.page !== undefined) searchParams.set("page", String(input.page));
  if (input.perPage !== undefined) {
    searchParams.set("per-page", String(input.perPage));
  }

  const query = searchParams.toString();
  const response = await fetch(
    `${PERSON_HUNTER_API_BASE_URL}/vacancies${query ? `?${query}` : ""}`,
    {
      cache: "no-store",
      headers: buildPersonHunterHeaders(input.accessToken),
      signal: AbortSignal.timeout(PERSON_HUNTER_TIMEOUT_MS),
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new PersonHunterApiError(response.status, body);
  }

  const payload = (await response.json()) as
    | PersonHunterVacancyRaw[]
    | { items?: PersonHunterVacancyRaw[]; data?: PersonHunterVacancyRaw[] };

  const rawItems = Array.isArray(payload)
    ? payload
    : (payload.items ?? payload.data ?? []);

  return {
    items: rawItems.map(toPersonHunterVacancy),
    page: parseHeaderInt(response, "X-Pagination-Current-Page"),
    perPage: parseHeaderInt(response, "X-Pagination-Per-Page"),
    pageCount: parseHeaderInt(response, "X-Pagination-Page-Count"),
    total: parseHeaderInt(response, "X-Pagination-Total-Count"),
  };
}

/** Reads an integer pagination header, returning `null` when it's missing or unparsable. */
function parseHeaderInt(response: Response, header: string): number | null {
  const value = response.headers.get(header);
  if (value === null) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Fetches one vacancy by id (GET /vacancies/{id}). Pass `lang` to receive the vacancy —
 * and all its reference labels — translated on the fly; pass `accessToken` to read a
 * hidden vacancy.
 */
export async function fetchPersonHunterVacancyById(
  id: number | string,
  options?: { accessToken?: string; lang?: PersonHunterLang },
): Promise<PersonHunterVacancy> {
  const searchParams = new URLSearchParams();
  if (options?.lang) searchParams.set("lang", options.lang);
  const query = searchParams.toString();

  const raw = await fetchPersonHunterJson<PersonHunterVacancyRaw>(
    `${PERSON_HUNTER_API_BASE_URL}/vacancies/${encodeURIComponent(String(id))}${
      query ? `?${query}` : ""
    }`,
    {
      headers: buildPersonHunterHeaders(options?.accessToken),
      signal: AbortSignal.timeout(PERSON_HUNTER_TIMEOUT_MS),
    },
  );

  if (!raw) {
    throw new PersonHunterApiError(404, "Vacancy not found");
  }

  return toPersonHunterVacancy(raw);
}

/**
 * Creates a vacancy (POST /vacancies). The vacancy's owner becomes the user whose Bearer
 * token is supplied. Returns the created vacancy as echoed back by the API.
 */
export async function createPersonHunterVacancy(
  input: CreatePersonHunterVacancyInput,
  accessToken: string,
): Promise<PersonHunterVacancy> {
  const raw = await fetchPersonHunterJson<PersonHunterVacancyRaw>(
    `${PERSON_HUNTER_API_BASE_URL}/vacancies`,
    {
      method: "POST",
      headers: buildPersonHunterHeaders(accessToken),
      body: JSON.stringify(buildVacancyBody(input)),
      signal: AbortSignal.timeout(PERSON_HUNTER_TIMEOUT_MS),
    },
  );

  if (!raw) {
    throw new PersonHunterApiError(500, "Empty response when creating vacancy");
  }

  return toPersonHunterVacancy(raw);
}

/**
 * Edits a vacancy or adds a translation (PUT /vacancies/{id}). Send only the fields that
 * change — for a partial data update or for a new localization (just `lang` + text fields).
 * Returns the updated vacancy.
 */
export async function updatePersonHunterVacancy(
  id: number | string,
  input: UpdatePersonHunterVacancyInput,
  accessToken: string,
): Promise<PersonHunterVacancy> {
  const raw = await fetchPersonHunterJson<PersonHunterVacancyRaw>(
    `${PERSON_HUNTER_API_BASE_URL}/vacancies/${encodeURIComponent(String(id))}`,
    {
      method: "PUT",
      headers: buildPersonHunterHeaders(accessToken),
      body: JSON.stringify(buildVacancyBody(input)),
      signal: AbortSignal.timeout(PERSON_HUNTER_TIMEOUT_MS),
    },
  );

  if (!raw) {
    throw new PersonHunterApiError(500, "Empty response when updating vacancy");
  }

  return toPersonHunterVacancy(raw);
}

/**
 * Deletes a vacancy and all its translations (DELETE /vacancies/{id}). Applications tied
 * to it are kept in the system but flagged as deleted. You can only delete your own
 * vacancies unless you have admin rights. The API replies `204 No Content`.
 */
export async function deletePersonHunterVacancy(
  id: number | string,
  accessToken: string,
): Promise<void> {
  await fetchPersonHunterJson(
    `${PERSON_HUNTER_API_BASE_URL}/vacancies/${encodeURIComponent(String(id))}`,
    {
      method: "DELETE",
      headers: buildPersonHunterHeaders(accessToken),
      signal: AbortSignal.timeout(PERSON_HUNTER_TIMEOUT_MS),
    },
  );
}
