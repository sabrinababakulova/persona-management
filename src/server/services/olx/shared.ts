import { env } from "~/env";

export const OLX_WEB_BASE_URL = "https://www.olx.uz";
export const OLX_API_BASE_URL = `${OLX_WEB_BASE_URL}/api/partner`;
export const OLX_TOKEN_URL = `${OLX_WEB_BASE_URL}/api/open/oauth/token`;
export const OLX_API_VERSION = "2.0";

export type OlxValidationError = {
  field: string;
  title: string;
  detail: string;
};

export class OlxApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly validationErrors: OlxValidationError[];

  constructor(input: {
    status: number;
    message: string;
    code?: string | null;
    validationErrors?: OlxValidationError[];
  }) {
    super(input.message);
    this.name = "OlxApiError";
    this.status = input.status;
    this.code = input.code ?? null;
    this.validationErrors = input.validationErrors ?? [];
  }
}

export function isOlxConfigured(): boolean {
  return Boolean(env.OLX_CLIENT_ID && env.OLX_CLIENT_SECRET);
}

export function getOlxClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  if (!env.OLX_CLIENT_ID || !env.OLX_CLIENT_SECRET) {
    throw new Error(
      "OLX.uz integration is not configured: OLX_CLIENT_ID and OLX_CLIENT_SECRET are required",
    );
  }
  return {
    clientId: env.OLX_CLIENT_ID,
    clientSecret: env.OLX_CLIENT_SECRET,
  };
}

export function unwrapOlxData<T>(body: unknown): T {
  if (
    typeof body === "object" &&
    body !== null &&
    "data" in body &&
    (body as { data?: unknown }).data !== undefined
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseValidationErrors(value: unknown): OlxValidationError[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }
    const record = item as Record<string, unknown>;
    const field = asString(record.field) ?? "unknown";
    const title = asString(record.title) ?? field;
    const detail = asString(record.detail) ?? title;
    return [{ field, title, detail }];
  });
}

export function parseOlxApiError(status: number, body: unknown): OlxApiError {
  const topLevel =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : null;
  const data =
    topLevel && typeof topLevel.data === "object" && topLevel.data !== null
      ? (topLevel.data as Record<string, unknown>)
      : null;
  const rawError = data?.error ?? topLevel?.error;

  if (typeof rawError === "string") {
    return new OlxApiError({
      status,
      code: rawError,
      message:
        asString(topLevel?.error_human_title) ??
        asString(topLevel?.error_description) ??
        rawError,
    });
  }

  if (typeof rawError === "object" && rawError !== null) {
    const error = rawError as Record<string, unknown>;
    return new OlxApiError({
      status,
      code: asString(error.code),
      message:
        asString(error.detail) ??
        asString(error.title) ??
        `OLX API request failed (${status})`,
      validationErrors: parseValidationErrors(error.validation),
    });
  }

  return new OlxApiError({
    status,
    message:
      asString(topLevel?.error_human_title) ??
      asString(topLevel?.error_description) ??
      (typeof body === "string" && body.trim()
        ? body.trim()
        : `OLX API request failed (${status})`),
  });
}

type OlxFetchInput = {
  accessToken: string;
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  language?: "ru" | "uz";
};

export async function fetchOlxJson<T>({
  accessToken,
  path,
  method = "GET",
  body,
  language = "ru",
}: OlxFetchInput): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(`${OLX_API_BASE_URL}${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Accept-Language": language,
        Authorization: `Bearer ${accessToken}`,
        Version: OLX_API_VERSION,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      signal: controller.signal,
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    const responseBody: unknown = contentType.includes("application/json")
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      throw parseOlxApiError(response.status, responseBody);
    }

    return responseBody as T;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new OlxApiError({
        status: 408,
        message: "OLX.uz не ответил за 15 секунд",
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
