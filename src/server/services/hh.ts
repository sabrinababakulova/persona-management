import { createHmac } from "node:crypto";

import { env } from "~/env";

type HhVacancySearchResponse = {
  items?: HhVacancyItem[];
  pages?: number;
};

type HhVacancyItem = {
  id: string;
  name?: string | null;
  alternate_url?: string | null;
  archived?: boolean | null;
  area?: {
    name?: string | null;
  } | null;
  experience?: {
    name?: string | null;
  } | null;
  work_format?: Array<{
    name?: string | null;
  }> | null;
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
  status: "active";
  externalUrl?: string;
};

export type HhConnectedAccount = {
  email: string | null;
  employerId: string;
};

const HH_API_BASE_URL = "https://api.hh.ru";
const HH_AUTH_BASE_URL = "https://hh.ru";
const HH_API_PER_PAGE = 100;
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

  return names.join(", ");
}

function toHhVacancy(item: HhVacancyItem): HhVacancy {
  return {
    id: item.id,
    title: item.name?.trim() || "Вакансия с hh.uz",
    city: item.area?.name?.trim() || "",
    level: item.experience?.name?.trim() || "",
    workType: toWorkType(item),
    status: "active",
    externalUrl: item.alternate_url?.trim() || undefined,
  };
}

function toHhVacancyLogEntry(item: HhVacancyItem) {
  return {
    id: item.id,
    title: item.name?.trim() || "Вакансия с hh.uz",
    archived: Boolean(item.archived),
    city: item.area?.name?.trim() || "",
    level: item.experience?.name?.trim() || "",
    workType: toWorkType(item),
    externalUrl: item.alternate_url?.trim() || undefined,
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
): Promise<HhVacancy[]> {
  const vacancies: HhVacancy[] = [];
  let page = 0;
  let totalPages = 1;

  while (page < totalPages) {
    const searchParams = new URLSearchParams({
      employer_id: employerId,
      host: "hh.uz",
      page: String(page),
      per_page: String(HH_API_PER_PAGE),
    });

    const payload = await fetchHhJson<HhVacancySearchResponse>(
      `${HH_API_BASE_URL}/vacancies?${searchParams}`,
      {
        headers: {
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      },
    );

    const items = payload.items ?? [];

    console.info("[hh.uz] vacancies page fetched", {
      employerId,
      page,
      totalPages: Math.max(payload.pages ?? 0, 1),
      received: items.length,
      vacancies: items.map(toHhVacancyLogEntry),
    });

    vacancies.push(
      ...items
        .filter((item) => !item.archived)
        .map((item) => toHhVacancy(item)),
    );

    totalPages = Math.max(payload.pages ?? 0, 1);
    page += 1;

    if (items.length === 0) {
      break;
    }
  }

  console.info("[hh.uz] active vacancies mapped for UI", {
    employerId,
    total: vacancies.length,
    vacancies,
  });

  return vacancies;
}
