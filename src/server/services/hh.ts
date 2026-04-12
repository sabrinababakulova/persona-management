import { createHmac } from "node:crypto";

import { env } from "~/env";

type HhVacancySearchResponse = {
  found?: number;
  items?: HhVacancyItem[];
  page?: number;
  per_page?: number;
  pages?: number;
};

type HhNegotiationCollectionResponse = {
  items?: unknown[];
  pages?: number;
};

type HhVacancyItem = {
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

type HhTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
};

type HhConnectStatePayload = {
  companyId: string;
  userId: string;
  issuedAt: number;
};

type HhMeResponse = Record<string, unknown>;

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

type HhVacancyPage = {
  items: HhVacancy[];
  total: number;
};

const HH_API_BASE_URL = "https://api.hh.ru";
const HH_AUTH_BASE_URL = "https://hh.ru";
const HH_API_ACTIVE_PER_PAGE = 50;
const HH_API_ARCHIVED_PER_PAGE = 500;
const HH_API_NEGOTIATIONS_PER_PAGE = 100;
const HH_CONNECT_STATE_TTL_MS = 10 * 60 * 1000;

function assertHhConfigured() {
  if (!env.HH_CLIENT_ID || !env.HH_CLIENT_SECRET) {
    throw new Error("HH client credentials are not configured");
  }
}

function getHhClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  assertHhConfigured();

  return {
    clientId: env.HH_CLIENT_ID as string,
    clientSecret: env.HH_CLIENT_SECRET as string,
  };
}

function toWorkType(item: HhVacancyItem): string {
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

function stripHtml(value?: string | null): string {
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

function toHhVacancyStatus(item: HhVacancyItem): HhVacancy["status"] {
  return item.archived ? "archive" : "active";
}

function toHhResponses(item: HhVacancyItem): number {
  return item.counters?.responses ?? item.counters?.total_responses ?? 0;
}

function toHhSalaryExpectation(item: HhVacancyItem): number | undefined {
  return item.salary?.from ?? item.salary?.to ?? undefined;
}

function toHhSalaryCurrency(item: HhVacancyItem): "UZS" | "USD" | undefined {
  switch (item.salary?.currency) {
    case "USD":
      return "USD";
    case "UZS":
      return "UZS";
    default:
      return undefined;
  }
}

function toHhCity(item: HhVacancyItem): string {
  return item.area?.name?.trim() || "";
}

function toHhVacancy(item: HhVacancyItem): HhVacancy {
  return {
    id: item.id,
    title: item.name?.trim() || "Вакансия с hh.uz",
    city: toHhCity(item),
    level: item.experience?.name?.trim() || "",
    workType: toWorkType(item),
    status: toHhVacancyStatus(item),
    responses: toHhResponses(item),
    publishedAt: item.published_at?.trim() || undefined,
    externalUrl: item.alternate_url?.trim() || undefined,
  };
}

function toHhVacancyLogEntry(item: HhVacancyItem) {
  return {
    id: item.id,
    title: item.name?.trim() || "Вакансия с hh.uz",
    status: toHhVacancyStatus(item),
    responses: toHhResponses(item),
    publishedAt: item.published_at?.trim() || undefined,
    city: toHhCity(item),
    level: item.experience?.name?.trim() || "",
    workType: toWorkType(item),
    externalUrl: item.alternate_url?.trim() || undefined,
  };
}

function getTotalFromSearchPayload(payload: HhVacancySearchResponse): number {
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

export async function fetchHhVacancyById(
  vacancyId: string,
  accessToken?: string,
): Promise<{
  id: string;
  title: string;
  level: string;
  status: "active" | "archive";
  city: string;
  responses: number;
  workType: string;
  salaryExpectation?: number;
  salaryCurrency?: "UZS" | "USD";
  workScheduleStart?: string;
  workScheduleEnd?: string;
  comments?: string;
  tasks?: string;
  team?: string;
  companyDescription?: string;
  publishedAt?: string;
  externalUrl?: string;
}> {
  const searchParams = new URLSearchParams({
    host: "hh.uz",
  });

  const vacancy = await fetchHhJson<HhVacancyItem>(
    `${HH_API_BASE_URL}/vacancies/${vacancyId}?${searchParams}`,
    {
      headers: {
        Accept: "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  return {
    ...toHhVacancy(vacancy),
    salaryExpectation: toHhSalaryExpectation(vacancy),
    salaryCurrency: toHhSalaryCurrency(vacancy),
    workScheduleStart: undefined,
    workScheduleEnd: undefined,
    comments: "",
    tasks: stripHtml(vacancy.description),
    team: "",
    companyDescription: "",
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function getNestedString(value: unknown, path: string[]): string | undefined {
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

function getNestedRecord(
  value: unknown,
  path: string[],
): Record<string, unknown> | null {
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

function toHhApplicantFullName(item: unknown): string {
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

function toHhVacancyApplicant(item: unknown): HhVacancyApplicant | null {
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
  const status =
    getNestedString(record, ["state", "name"]) ??
    getNestedString(record, ["state", "id"]) ??
    null;

  return {
    id: resumeId ?? applicantId ?? negotiationId ?? "unknown",
    fullName: toHhApplicantFullName(record),
    status,
  };
}

function signState(encodedPayload: string) {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(encodedPayload)
    .digest("hex");
}

function decodeState(state: string): HhConnectStatePayload | null {
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
      typeof payload.companyId !== "string" ||
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

async function fetchHhJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HH API error ${response.status}: ${body}`);
  }

  return (await response.json()) as T;
}

export function isHhConfigured(): boolean {
  return !!(env.HH_CLIENT_ID && env.HH_CLIENT_SECRET);
}

export function buildHhConnectState(input: {
  companyId: string;
  userId: string;
}): string {
  const payload: HhConnectStatePayload = {
    companyId: input.companyId,
    userId: input.userId,
    issuedAt: Date.now(),
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    "base64url",
  );

  return `${encodedPayload}.${signState(encodedPayload)}`;
}

export function parseHhConnectState(
  state: string,
): HhConnectStatePayload | null {
  return decodeState(state);
}

export function buildHhAuthorizeUrl(input: {
  requestUrl?: string;
  state: string;
}): string {
  const { clientId } = getHhClientCredentials();
  const redirectUri = env.HH_REDIRECT_URI ?? "";

  const searchParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state: input.state,
  });

  return `${HH_AUTH_BASE_URL}/oauth/authorize?${searchParams}`;
}

export async function exchangeHhAuthorizationCode(input: {
  code: string;
  requestUrl?: string;
}): Promise<{ accessToken: string; refreshToken: string | null }> {
  const { clientId, clientSecret } = getHhClientCredentials();
  const redirectUri = env.HH_REDIRECT_URI ?? "";

  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: input.code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });

  const response = await fetch(`${HH_AUTH_BASE_URL}/oauth/token`, {
    body: payload,
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HH token exchange failed ${response.status}: ${body}`);
  }

  const tokens = (await response.json()) as HhTokenResponse;
  if (!tokens.access_token) {
    throw new Error("HH token exchange did not return access_token");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
  };
}

export async function refreshHhAccessToken(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string | null }> {
  const { clientId, clientSecret } = getHhClientCredentials();

  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const response = await fetch(`${HH_AUTH_BASE_URL}/oauth/token`, {
    body: payload,
    cache: "no-store",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HH token refresh failed ${response.status}: ${body}`);
  }

  const tokens = (await response.json()) as HhTokenResponse;
  if (!tokens.access_token) {
    throw new Error("HH token refresh did not return access_token");
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? refreshToken,
  };
}

export async function resolveHhEmployerFromAccessToken(
  accessToken: string,
): Promise<HhConnectedAccount> {
  let me: HhMeResponse | null = null;

  for (const url of [
    `${HH_API_BASE_URL}/me?host=hh.uz`,
    `${HH_API_BASE_URL}/me`,
  ]) {
    try {
      me = await fetchHhJson<HhMeResponse>(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      break;
    } catch {}
  }

  if (!me) {
    throw new Error("Failed to load HH account profile");
  }

  const employerId =
    getNestedString(me, ["employer", "id"]) ??
    getNestedString(me, ["manager", "employer", "id"]);

  if (!employerId) {
    throw new Error("Failed to resolve HH employer ID from authorized account");
  }

  const email =
    getNestedString(me, ["email"]) ??
    getNestedString(me, ["manager", "email"]) ??
    null;

  return {
    email,
    employerId,
  };
}

export async function fetchCompanyHhVacancies(
  employerId: string,
  accessToken?: string,
): Promise<HhVacancy[]> {
  const vacancies = new Map<string, HhVacancy>();

  const fetchActiveVacancies = async () => {
    if (!accessToken) {
      return;
    }

    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
      const searchParams = new URLSearchParams({
        host: "hh.uz",
        page: String(page),
        per_page: String(HH_API_ACTIVE_PER_PAGE),
        all_accessible: "true",
      });

      const payload = await fetchHhJson<HhVacancySearchResponse>(
        `${HH_API_BASE_URL}/employers/${employerId}/vacancies/active?${searchParams}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      const items = payload.items ?? [];

      console.info("[hh.uz] active vacancies page fetched", {
        employerId,
        page,
        totalPages: Math.max(payload.pages ?? 0, 1),
        received: items.length,
        vacancies: items.map(toHhVacancyLogEntry),
      });

      for (const item of items) {
        const vacancy = toHhVacancy(item);
        vacancies.set(vacancy.id, vacancy);
      }

      totalPages = Math.max(payload.pages ?? 0, 1);
      page += 1;

      if (items.length === 0) {
        break;
      }
    }
  };

  const fetchArchivedVacancies = async () => {
    if (!accessToken) {
      return;
    }

    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
      const searchParams = new URLSearchParams({
        host: "hh.uz",
        page: String(page),
        per_page: String(HH_API_ARCHIVED_PER_PAGE),
      });

      const payload = await fetchHhJson<HhVacancySearchResponse>(
        `${HH_API_BASE_URL}/employers/${employerId}/vacancies/archived?${searchParams}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      const items = payload.items ?? [];

      console.info("[hh.uz] archived vacancies page fetched", {
        employerId,
        page,
        totalPages: Math.max(payload.pages ?? 0, 1),
        received: items.length,
        vacancies: items.map(toHhVacancyLogEntry),
      });

      for (const item of items) {
        const vacancy = toHhVacancy(item);
        vacancies.set(vacancy.id, vacancy);
      }

      totalPages = Math.max(payload.pages ?? 0, 1);
      page += 1;

      if (items.length === 0) {
        break;
      }
    }
  };

  try {
    await fetchActiveVacancies();
  } catch (error) {
    console.error("Failed to fetch active hh.uz vacancies", {
      employerId,
      error,
      hasAccessToken: Boolean(accessToken),
    });
  }

  try {
    await fetchArchivedVacancies();
  } catch (error) {
    console.error("Failed to fetch archived hh.uz vacancies", {
      employerId,
      error,
      hasAccessToken: Boolean(accessToken),
    });
  }

  const items = [...vacancies.values()];

  console.info("[hh.uz] vacancies mapped for UI", {
    employerId,
    total: items.length,
    vacancies: items,
  });

  return items;
}

async function fetchHhVacanciesBatch(input: {
  accessToken?: string;
  employerId: string;
  kind: "active" | "archived";
  limit: number;
  offset: number;
}): Promise<HhVacancyPage> {
  if (input.limit <= 0) {
    return { items: [], total: 0 };
  }

  if (!input.accessToken) {
    return { items: [], total: 0 };
  }

  const perPage =
    input.kind === "active"
      ? HH_API_ACTIVE_PER_PAGE
      : HH_API_ARCHIVED_PER_PAGE;

  const items: HhVacancy[] = [];
  const pageOffset = Math.max(input.offset, 0);
  let page = Math.floor(pageOffset / perPage);
  let skip = pageOffset % perPage;
  let totalPages = page + 1;
  let total = 0;

  while (items.length < input.limit && page < totalPages) {
    const searchParams = new URLSearchParams({
      host: "hh.uz",
      page: String(page),
      per_page: String(perPage),
      ...(input.kind === "active" ? { all_accessible: "true" } : {}),
    });

    const payload = await fetchHhJson<HhVacancySearchResponse>(
      `${HH_API_BASE_URL}/employers/${input.employerId}/vacancies/${input.kind}?${searchParams}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${input.accessToken}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    const pageItems = payload.items ?? [];
    totalPages = Math.max(payload.pages ?? 0, page + 1);
    total = getTotalFromSearchPayload(payload);

    console.info(`[hh.uz] ${input.kind} vacancies batch fetched`, {
      employerId: input.employerId,
      kind: input.kind,
      limit: input.limit,
      offset: input.offset,
      page,
      received: pageItems.length,
      total,
      totalPages,
      vacancies: pageItems.map(toHhVacancyLogEntry),
    });

    const slicedItems = pageItems.slice(skip);
    skip = 0;

    for (const item of slicedItems) {
      items.push(toHhVacancy(item));

      if (items.length >= input.limit) {
        break;
      }
    }

    page += 1;

    if (pageItems.length === 0) {
      break;
    }
  }

  return {
    items,
    total,
  };
}

export async function fetchCompanyHhVacanciesPage(input: {
  accessToken?: string;
  employerId: string;
  includeActive?: boolean;
  includeArchived?: boolean;
  limit: number;
  offset: number;
}): Promise<HhVacancyPage> {
  const includeActive = input.includeActive ?? true;
  const includeArchived = input.includeArchived ?? true;

  let activeItems: HhVacancy[] = [];
  let activeTotal = 0;

  if (includeActive) {
    const activeBatch = await fetchHhVacanciesBatch({
      accessToken: input.accessToken,
      employerId: input.employerId,
      kind: "active",
      limit: input.limit,
      offset: input.offset,
    });

    activeItems = activeBatch.items;
    activeTotal = activeBatch.total;
  }

  let archivedItems: HhVacancy[] = [];
  let archivedTotal = 0;

  if (includeArchived) {
    const archivedOffset = Math.max(0, input.offset - activeTotal);
    const archivedLimit = Math.max(0, input.limit - activeItems.length);

    const archivedBatch = await fetchHhVacanciesBatch({
      accessToken: input.accessToken,
      employerId: input.employerId,
      kind: "archived",
      limit: archivedLimit,
      offset: archivedOffset,
    });

    archivedItems = archivedBatch.items;
    archivedTotal = archivedBatch.total;
  }

  return {
    items: [...activeItems, ...archivedItems],
    total: activeTotal + archivedTotal,
  };
}

export async function fetchHhVacancyApplicants(
  vacancyId: string,
  accessToken: string,
): Promise<HhVacancyApplicant[]> {
  const applicants: HhVacancyApplicant[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const searchParams = new URLSearchParams({
      host: "hh.uz",
      page: String(page),
      per_page: String(HH_API_NEGOTIATIONS_PER_PAGE),
      vacancy_id: vacancyId,
    });

    const payload = await fetchHhJson<HhNegotiationCollectionResponse>(
      `${HH_API_BASE_URL}/negotiations/response?${searchParams}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    const items = payload.items ?? [];
    applicants.push(
      ...items
        .map((item) => toHhVacancyApplicant(item))
        .filter((item): item is HhVacancyApplicant => item !== null),
    );

    totalPages = Math.max(payload.pages ?? 0, 1);
    page += 1;

    if (items.length === 0) {
      break;
    }
  }

  console.info("[hh.uz] vacancy applicants fetched", {
    vacancyId,
    total: applicants.length,
    applicants,
  });

  return applicants;
}
