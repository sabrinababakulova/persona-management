/**
 * Shared primitives for the PersonHunters Vacancies API (v1).
 *
 * The API is documented at https://api.personhunters.com/v1. Every write request
 * (POST/PUT/PATCH/DELETE) — and reading hidden vacancies — is authenticated with a
 * per-user Bearer access token, which the service functions accept as an argument
 * (mirroring how the hh.uz service threads `accessToken` through every call).
 *
 * Responses are pre-resolved by the API: related entities (city, industry, schedules,
 * …) arrive as ready `{ id, name }` objects with text labels, so there is no need to
 * call any reference dictionaries. Localization happens "on the fly": pass `?lang=` on
 * GET requests and a `"lang"` field in the body on writes.
 */

import { env } from "~/env";

export const PERSON_HUNTER_API_BASE_URL = "https://api.personhunters.com/v1";

/**
 * True when a PersonHunters API key is configured. Unlike hh.uz (per-user OAuth), the
 * integration authenticates with a single shared API key from the environment — closer to
 * the Telegram bot-token model — so there is no per-user token to store.
 */
export function isPersonHunterConfigured(): boolean {
  return Boolean(env.PERSON_HUNTER_API_KEY);
}

/** Returns the configured API key, throwing if the integration is not set up. */
export function getPersonHunterApiKey(): string {
  if (!env.PERSON_HUNTER_API_KEY) {
    throw new Error("PersonHunter API key is not configured");
  }
  return env.PERSON_HUNTER_API_KEY;
}

/** Languages the API can translate vacancy content (and reference labels) into on the fly. */
export type PersonHunterLang = "ru" | "uz" | "en";

/**
 * A pre-resolved related entity. The API returns these for cities, regions, countries,
 * industries, schedules, employment types and statuses — each already carries a
 * human-readable `name` in the requested language.
 */
export type PersonHunterReference = {
  id: number;
  name: string;
};

/** The vacancy owner, as returned under `user` on every vacancy object. */
export type PersonHunterUser = {
  id: number;
  username: string;
};

/**
 * A single vacancy in our camelCase domain shape. Built from the snake_case API payload
 * by {@link toPersonHunterVacancy}. Reference objects are `null` when the API omits them.
 */
export type PersonHunterVacancy = {
  id: number;
  uniqueCode: string | null;
  payFrom: number | null;
  payTo: number | null;
  experienceFrom: number | null;
  experienceTo: number | null;
  // Unix timestamps (seconds) exactly as the API returns them.
  createdAt: number | null;
  updatedAt: number | null;
  status: PersonHunterReference | null;
  user: PersonHunterUser | null;
  industry: PersonHunterReference | null;
  country: PersonHunterReference | null;
  region: PersonHunterReference | null;
  city: PersonHunterReference | null;
  name: string;
  description: string;
  conditions: string;
  duties: string;
  requirements: string;
  schedules: PersonHunterReference[];
  employments: PersonHunterReference[];
};

/** A page of vacancies plus the pagination metadata pulled from the Yii2 response headers. */
export type PersonHunterVacancyPage = {
  items: PersonHunterVacancy[];
  page: number | null;
  perPage: number | null;
  pageCount: number | null;
  total: number | null;
};

/** Raw `{ id, name }` reference as it appears in the JSON payload. */
type PersonHunterReferenceRaw = {
  id?: number | string | null;
  name?: string | null;
};

/** Raw vacancy object straight off the wire, before camelCase normalization. */
export type PersonHunterVacancyRaw = {
  id?: number | string | null;
  unique_code?: string | null;
  pay_from?: number | null;
  pay_to?: number | null;
  experience_from?: number | null;
  experience_to?: number | null;
  created_at?: number | null;
  updated_at?: number | null;
  status_info?: PersonHunterReferenceRaw | null;
  user?: { id?: number | string | null; username?: string | null } | null;
  industry?: PersonHunterReferenceRaw | null;
  country?: PersonHunterReferenceRaw | null;
  region?: PersonHunterReferenceRaw | null;
  city?: PersonHunterReferenceRaw | null;
  vacancy_name?: string | null;
  vacancy_description?: string | null;
  vacancy_conditions?: string | null;
  vacancy_duties?: string | null;
  vacancy_requirements?: string | null;
  schedules?: PersonHunterReferenceRaw[] | null;
  employments?: PersonHunterReferenceRaw[] | null;
};

/** Coerces a raw id (which may arrive as a string) into a number, or `null` when absent. */
function toId(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Normalizes a raw `{ id, name }` reference; returns `null` unless it has a usable id. */
function toReference(
  raw: PersonHunterReferenceRaw | null | undefined,
): PersonHunterReference | null {
  const id = toId(raw?.id);
  if (id === null) {
    return null;
  }
  return { id, name: raw?.name?.trim() ?? "" };
}

/** Normalizes a list of raw references, dropping any entry without a usable id. */
function toReferenceList(
  raw: PersonHunterReferenceRaw[] | null | undefined,
): PersonHunterReference[] {
  return (raw ?? [])
    .map(toReference)
    .filter((item): item is PersonHunterReference => item !== null);
}

/** Normalizes the raw `user` object; returns `null` unless it has a usable id. */
function toUser(
  raw:
    | { id?: number | string | null; username?: string | null }
    | null
    | undefined,
): PersonHunterUser | null {
  const id = toId(raw?.id);
  if (id === null) {
    return null;
  }
  return { id, username: raw?.username?.trim() ?? "" };
}

/**
 * Maps a raw API vacancy onto our camelCase {@link PersonHunterVacancy}. Note the field
 * rename quirk in the API: writes accept `duties`/`requirements`/`conditions` but reads
 * echo them back prefixed as `vacancy_duties`/`vacancy_requirements`/`vacancy_conditions`.
 */
export function toPersonHunterVacancy(
  raw: PersonHunterVacancyRaw,
): PersonHunterVacancy {
  return {
    id: toId(raw.id) ?? 0,
    uniqueCode: raw.unique_code?.trim() || null,
    payFrom: raw.pay_from ?? null,
    payTo: raw.pay_to ?? null,
    experienceFrom: raw.experience_from ?? null,
    experienceTo: raw.experience_to ?? null,
    createdAt: raw.created_at ?? null,
    updatedAt: raw.updated_at ?? null,
    status: toReference(raw.status_info),
    user: toUser(raw.user),
    industry: toReference(raw.industry),
    country: toReference(raw.country),
    region: toReference(raw.region),
    city: toReference(raw.city),
    name: raw.vacancy_name?.trim() ?? "",
    description: raw.vacancy_description?.trim() ?? "",
    conditions: raw.vacancy_conditions?.trim() ?? "",
    duties: raw.vacancy_duties?.trim() ?? "",
    requirements: raw.vacancy_requirements?.trim() ?? "",
    schedules: toReferenceList(raw.schedules),
    employments: toReferenceList(raw.employments),
  };
}

/** A single field error from a 422 validation response. */
export type PersonHunterValidationError = {
  field: string;
  message: string;
};

/**
 * Error thrown for any non-2xx PersonHunters API response. Carries the HTTP status and,
 * for `422 Unprocessable Entity`, the parsed per-field validation errors so callers can
 * surface exactly which fields the API rejected.
 *
 * Per the API's error reference:
 *  - 401 — token missing, expired or invalid
 *  - 403 — attempting to edit/delete a vacancy owned by someone else
 *  - 404 — vacancy not found (or the URL is wrong — note the plural `/vacancies`)
 *  - 422 — validation failed; `validationErrors` lists the offending fields
 */
export class PersonHunterApiError extends Error {
  readonly status: number;
  readonly body: string;
  readonly validationErrors: PersonHunterValidationError[];

  constructor(status: number, body: string) {
    super(`PersonHunter API error ${status}: ${body}`);
    this.name = "PersonHunterApiError";
    this.status = status;
    this.body = body;
    this.validationErrors = parsePersonHunterValidationErrors(body);
  }
}

/**
 * Extracts `{ field, message }` pairs from a 422 body. The API returns a JSON array of
 * invalid fields; Yii2 typically shapes each entry as `{ field, message }`, but we also
 * tolerate a `{ errors: [...] }` wrapper just in case.
 */
function parsePersonHunterValidationErrors(
  body: string,
): PersonHunterValidationError[] {
  try {
    const parsed = JSON.parse(body) as unknown;
    const entries = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { errors?: unknown })?.errors)
        ? (parsed as { errors: unknown[] }).errors
        : [];

    return entries
      .map((entry): PersonHunterValidationError | null => {
        if (typeof entry !== "object" || entry === null) {
          return null;
        }
        const record = entry as Record<string, unknown>;
        const field =
          typeof record.field === "string" ? record.field : "unknown";
        const message =
          typeof record.message === "string" ? record.message : "";
        return { field, message };
      })
      .filter((item): item is PersonHunterValidationError => item !== null);
  } catch {
    return [];
  }
}

/**
 * True when an error means the connected account is not allowed to touch the resource:
 * `403 Forbidden` (someone else's vacancy) or `404 Not Found` (missing/hidden vacancy).
 */
export function isPersonHunterAccessError(error: unknown): boolean {
  return (
    error instanceof PersonHunterApiError &&
    (error.status === 403 || error.status === 404)
  );
}

/** Builds the auth/content headers shared by every request; omits auth when no token. */
export function buildPersonHunterHeaders(accessToken?: string): HeadersInit {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

/**
 * Performs a PersonHunters request and parses the JSON body, throwing a
 * {@link PersonHunterApiError} on any non-2xx response. A `204 No Content` (e.g. from
 * DELETE) resolves to `null` rather than attempting to parse an empty body.
 */
export async function fetchPersonHunterJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T | null> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new PersonHunterApiError(response.status, body);
  }

  if (response.status === 204) {
    return null;
  }

  return (await response.json()) as T;
}
