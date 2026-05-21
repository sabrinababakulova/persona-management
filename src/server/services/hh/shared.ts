import { createHmac } from "node:crypto";

import { env } from "~/env";

export type HhVacancySearchResponse = {
  found?: number;
  items?: HhVacancyItem[];
  page?: number;
  per_page?: number;
  pages?: number;
};

export type HhNegotiationCollectionResponse = {
  items?: unknown[];
  pages?: number;
};

export type HhNegotiationsCollectionInfo = {
  id?: string | null;
  name?: string | null;
  url?: string | null;
};

export type HhNegotiationsListResponse = {
  collections?: HhNegotiationsCollectionInfo[];
  generated_collections?: HhNegotiationsCollectionInfo[];
};

export type HhVacancyItem = {
  id: string;
  name?: string | null;
  alternate_url?: string | null;
  archived?: boolean | null;
  published_at?: string | null;
  counters?: {
    responses?: number | null;
    total_responses?: number | null;
  } | null;
  area?: {
    name?: string | null;
  } | null;
  experience?: {
    name?: string | null;
  } | null;
  work_format?: Array<{
    name?: string | null;
  }> | null;
  salary?: {
    from?: number | null;
    to?: number | null;
    currency?: string | null;
  } | null;
  employment?: {
    name?: string | null;
  } | null;
  schedule?: {
    name?: string | null;
  } | null;
  description?: string | null;
  employer?: {
    name?: string | null;
  } | null;
};

export type HhTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
};

export type HhConnectStatePayload = {
  userId: string;
  issuedAt: number;
};

export type HhMeResponse = Record<string, unknown>;

export type HhVacancy = {
  id: string;
  title: string;
  city: string;
  level: string;
  workType: string;
  status: "active" | "archive";
  responses: number;
  publishedAt?: string;
  externalUrl?: string;
};

export type HhConnectedAccount = {
  email: string | null;
  employerId: string;
};

export type HhVacancyApplicant = {
  id: string;
  fullName: string;
  status: string | null;
};

export type HhResumeContact = {
  type?: { id?: string | null; name?: string | null } | null;
  value?: string | { formatted?: string | null } | null;
};

export type HhResumeExperience = {
  company?: string | null;
  position?: string | null;
  start?: string | null;
  end?: string | null;
  description?: string | null;
};

export type HhResumeEducationItem = {
  name?: string | null;
  organization?: string | null;
  result?: string | null;
  year?: number | null;
};

export type HhResumeLanguage = {
  name?: string | null;
  level?: { name?: string | null } | null;
};

export type HhResumeResponse = {
  id?: string | null;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  area?: { name?: string | null } | null;
  salary?: { amount?: number | null; currency?: string | null } | null;
  total_experience?: { months?: number | null } | null;
  skill_set?: string[] | null;
  experience?: HhResumeExperience[] | null;
  education?: { primary?: HhResumeEducationItem[] | null } | null;
  languages?: HhResumeLanguage[] | null;
  contact?: HhResumeContact[] | null;
  alternate_url?: string | null;
};

export type HhResumeCandidate = {
  id: string;
  fullName: string;
  city: string;
  experience: string;
  salaryExpectation: number;
  salaryCurrency: "UZS" | "USD";
  currentPosition: string;
  skills: string[];
  languages: { name: string; level: string }[];
  contacts: { phone: string; email: string; telegram: string };
  workExperience: {
    company: string;
    position: string;
    period: string;
    description: string[];
  }[];
  education: { institution: string; gpa: string; period: string }[];
  resumeUrl: string;
};

export type HhVacancyPage = {
  items: HhVacancy[];
  total: number;
};

export const HH_API_BASE_URL = "https://api.hh.ru";
export const HH_AUTH_BASE_URL = "https://hh.ru";
export const HH_API_ACTIVE_PER_PAGE = 50;
export const HH_API_ARCHIVED_PER_PAGE = 500;
export const HH_API_NEGOTIATIONS_PER_PAGE = 50;
export const HH_CONNECT_STATE_TTL_MS = 10 * 60 * 1000;

export function assertHhConfigured() {
  if (!env.HH_CLIENT_ID || !env.HH_CLIENT_SECRET) {
    throw new Error("HH client credentials are not configured");
  }
}

export function getHhClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  assertHhConfigured();

  return {
    clientId: env.HH_CLIENT_ID as string,
    clientSecret: env.HH_CLIENT_SECRET as string,
  };
}

export function toWorkType(item: HhVacancyItem): string {
  const names =
    item.work_format
      ?.map((option) => option.name?.trim())
      .filter((name): name is string => Boolean(name)) ?? [];

  if (names.length > 0) {
    return names.join(", ");
  }

  const fallbackNames = [
    item.schedule?.name?.trim(),
    item.employment?.name?.trim(),
  ].filter((name): name is string => Boolean(name));

  return fallbackNames.join(", ");
}

export function stripHtml(value?: string | null): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<li>/gi, "• ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function toHhVacancyStatus(item: HhVacancyItem): HhVacancy["status"] {
  return item.archived ? "archive" : "active";
}

export function toHhSalaryExpectation(item: HhVacancyItem): number | undefined {
  return item.salary?.from ?? item.salary?.to ?? undefined;
}

export function toHhSalaryCurrency(
  item: HhVacancyItem,
): "UZS" | "USD" | undefined {
  switch (item.salary?.currency) {
    case "USD":
      return "USD";
    case "UZS":
      return "UZS";
    default:
      return undefined;
  }
}

export function toHhVacancy(item: HhVacancyItem): HhVacancy {
  return {
    id: item.id,
    title: item.name?.trim() || "Вакансия с hh.uz",
    city: item.area?.name?.trim() || "",
    level: item.experience?.name?.trim() || "",
    workType: toWorkType(item),
    status: toHhVacancyStatus(item),
    responses: item.counters?.total_responses ?? item.counters?.responses ?? 0,
    publishedAt: item.published_at?.trim() || undefined,
    externalUrl: item.alternate_url?.trim() || undefined,
  };
}

export function getTotalFromSearchPayload(payload: HhVacancySearchResponse) {
  if (typeof payload.found === "number" && payload.found >= 0) {
    return payload.found;
  }

  const perPage = payload.per_page ?? HH_API_ACTIVE_PER_PAGE;
  const pages = payload.pages ?? 0;

  if (pages > 0) {
    return pages * perPage;
  }

  return payload.items?.length ?? 0;
}

export function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

export function getNestedString(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const segment of path) {
    const record = toRecord(current);
    if (!record) {
      return undefined;
    }
    current = record[segment];
  }

  return typeof current === "string" && current.trim()
    ? current.trim()
    : undefined;
}

export function getNestedRecord(value: unknown, path: string[]) {
  let current: unknown = value;

  for (const segment of path) {
    const record = toRecord(current);
    if (!record) {
      return null;
    }
    current = record[segment];
  }

  return toRecord(current);
}

export function toHhApplicantFullName(item: unknown) {
  const resume =
    getNestedRecord(item, ["resume"]) ?? getNestedRecord(item, ["applicant"]);

  if (!resume) {
    return "Неизвестный кандидат";
  }

  const nameParts = [
    typeof resume.last_name === "string" ? resume.last_name.trim() : "",
    typeof resume.first_name === "string" ? resume.first_name.trim() : "",
    typeof resume.middle_name === "string" ? resume.middle_name.trim() : "",
  ].filter(Boolean);

  if (nameParts.length > 0) {
    return nameParts.join(" ");
  }

  if (typeof resume.title === "string" && resume.title.trim()) {
    return resume.title.trim();
  }

  return "Неизвестный кандидат";
}

export function toHhVacancyApplicant(
  item: unknown,
  _fallbackStatus?: string | null,
): HhVacancyApplicant | null {
  const record = toRecord(item);
  if (!record) {
    return null;
  }

  const negotiationId =
    typeof record.id === "string" || typeof record.id === "number"
      ? String(record.id)
      : null;
  const resumeId = getNestedString(record, ["resume", "id"]);
  const applicantId = getNestedString(record, ["applicant", "id"]);
  // const status =
  //   getNestedString(record, ["employer_state", "name"]) ??
  //   getNestedString(record, ["employer_state", "id"]) ??
  //   getNestedString(record, ["funnel_stage", "state", "name"]) ??
  //   getNestedString(record, ["funnel_stage", "state", "id"]) ??
  //   getNestedString(record, ["state", "name"]) ??
  //   getNestedString(record, ["state", "id"]) ??
  //   fallbackStatus ??
  //   null;
  // console.log(status);
  // TODO: fix it, it should show actual status
  return {
    id: resumeId ?? applicantId ?? negotiationId ?? "unknown",
    fullName: toHhApplicantFullName(record),
    status: "new",
  };
}

export function signState(encodedPayload: string) {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(encodedPayload)
    .digest("hex");
}

export function decodeState(state: string): HhConnectStatePayload | null {
  const [encodedPayload, signature] = state.split(".");
  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = signState(encodedPayload);
  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8"),
    ) as HhConnectStatePayload;

    if (
      typeof payload.userId !== "string" ||
      typeof payload.issuedAt !== "number"
    ) {
      return null;
    }

    if (Date.now() - payload.issuedAt > HH_CONNECT_STATE_TTL_MS) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Error thrown for any non-2xx hh.uz API response. Carries the HTTP status and the
 * `errors[].type` values from the JSON body (e.g. `"not_found"`, `"forbidden"`) so callers
 * can tell a permission failure apart from a transient outage.
 */
export class HhApiError extends Error {
  readonly status: number;
  readonly errorTypes: string[];

  constructor(status: number, body: string) {
    super(`HH API error ${status}: ${body}`);
    this.name = "HhApiError";
    this.status = status;
    this.errorTypes = parseHhErrorTypes(body);
  }
}

function parseHhErrorTypes(body: string): string[] {
  try {
    const parsed = JSON.parse(body) as { errors?: { type?: unknown }[] };
    return (parsed.errors ?? [])
      .map((entry) => entry.type)
      .filter((type): type is string => typeof type === "string");
  } catch {
    return [];
  }
}

/**
 * True when an hh.uz error means the connected account is not allowed to see the resource.
 * hh.uz returns `403 forbidden` for explicit permission denials and masks others as
 * `404 not_found` — e.g. requesting negotiations of a vacancy the account does not manage.
 */
export function isHhAccessError(error: unknown): boolean {
  if (!(error instanceof HhApiError)) {
    return false;
  }
  if (error.status === 403) {
    return true;
  }
  return error.status === 404 && error.errorTypes.includes("not_found");
}

export async function fetchHhJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new HhApiError(response.status, body);
  }

  return (await response.json()) as T;
}

export function formatExperienceMonths(months: number | null | undefined) {
  if (!months) return "";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  if (years > 0 && remainingMonths > 0)
    return `${years} лет ${remainingMonths} мес.`;
  if (years > 0) return `${years} лет`;
  return `${remainingMonths} мес.`;
}

export function formatWorkPeriod(
  start: string | null | undefined,
  end: string | null | undefined,
) {
  if (!start) return "";
  const fmt = (dateValue: string) => {
    const parts = dateValue.split("-");
    return parts.length >= 2 ? `${parts[1]}.${parts[0]}` : (parts[0] ?? "");
  };
  return `${fmt(start)} — ${end ? fmt(end) : "н.в."}`;
}

export function toHhDescriptionHtml(text: string) {
  if (!text.trim()) return "<p></p>";
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}
