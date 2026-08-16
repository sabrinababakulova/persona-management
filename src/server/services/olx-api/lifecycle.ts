import {
  ensureFreshOlxCredentials,
  OlxApiError,
  type OlxCredentials,
} from "./client";

const OLX_GRAPHQL_URL =
  "https://production-graphql.eu-sharedservices.olxcdn.com/graphql";
const REQUEST_TIMEOUT_MS = 20_000;

const UPDATE_AD_MUTATION = `
  mutation UpdateAd($adId: Int, $action: MyAdsAction) {
    myAds {
      updateAd(adId: $adId, action: $action) {
        adId
        status
        message
        activateResult {
          status
          code
        }
      }
    }
  }
`;

type FetchLike = (
  input: URL | RequestInfo,
  init?: RequestInit,
) => Promise<Response>;

type OlxGraphqlError = {
  message?: unknown;
  extensions?: { code?: unknown };
};

type OlxGraphqlPayload = {
  data?: {
    myAds?: {
      updateAd?: {
        activateResult?: { code?: unknown; status?: unknown } | null;
        adId?: unknown;
        message?: unknown;
        status?: unknown;
      } | null;
    } | null;
  } | null;
  errors?: OlxGraphqlError[];
};

export type OlxAdvertLifecycleAction = "activate" | "deactivate";
type OlxGraphqlLifecycleAction = "ACTIVATE" | "DEACTIVATE" | "REMOVE";

function stringValue(value: unknown, maxLength = 300) {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const result = String(value).trim();
  return result ? result.slice(0, maxLength) : undefined;
}

function parseAdvertId(value: string) {
  if (!/^\d{1,10}$/.test(value)) {
    throw new OlxApiError(
      "validation_failed",
      "OLX advert id must be numeric",
      undefined,
      ["Некорректный идентификатор объявления olx.uz."],
    );
  }

  const result = Number(value);
  if (!Number.isSafeInteger(result) || result > 2_147_483_647) {
    throw new OlxApiError(
      "validation_failed",
      "OLX advert id is outside the GraphQL Int range",
      undefined,
      ["Некорректный идентификатор объявления olx.uz."],
    );
  }
  return result;
}

function graphqlErrors(payload: OlxGraphqlPayload) {
  return Array.isArray(payload.errors) ? payload.errors : [];
}

function graphqlErrorCode(error: OlxGraphqlError) {
  return stringValue(error.extensions?.code, 80)?.toUpperCase();
}

function hasGraphqlCode(payload: OlxGraphqlPayload, ...codes: string[]) {
  const expected = new Set(codes);
  return graphqlErrors(payload).some((error) => {
    const code = graphqlErrorCode(error);
    return code ? expected.has(code) : false;
  });
}

function graphqlMessages(payload: OlxGraphqlPayload) {
  return graphqlErrors(payload)
    .flatMap((error) => {
      const message = stringValue(error.message);
      return message ? [message] : [];
    })
    .slice(0, 8);
}

async function parseGraphqlPayload(response: Response) {
  try {
    const value = (await response.json()) as unknown;
    return value && typeof value === "object"
      ? (value as OlxGraphqlPayload)
      : {};
  } catch {
    return {};
  }
}

function graphqlHeaders(credentials: OlxCredentials): HeadersInit {
  return {
    Accept: "application/json",
    "Accept-Language": "ru-UZ,ru;q=0.9",
    Authorization: `Bearer ${credentials.accessToken}`,
    "Content-Type": "application/json",
    Site: "olxuz",
    "User-Agent": credentials.userAgent,
    "X-Client": "DESKTOP",
  };
}

async function sendUpdateAd(
  credentials: OlxCredentials,
  advertId: number,
  action: OlxGraphqlLifecycleAction,
  fetchImpl: FetchLike,
) {
  const response = await fetchImpl(OLX_GRAPHQL_URL, {
    method: "POST",
    headers: graphqlHeaders(credentials),
    body: JSON.stringify({
      operationName: "UpdateAd",
      variables: { adId: advertId, action },
      query: UPDATE_AD_MUTATION,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  return { response, payload: await parseGraphqlPayload(response) };
}

function isAuthenticationFailure(
  response: Response,
  payload: OlxGraphqlPayload,
) {
  return (
    response.status === 401 ||
    response.status === 403 ||
    hasGraphqlCode(payload, "UNAUTHENTICATED")
  );
}

function isNotFoundFailure(response: Response, payload: OlxGraphqlPayload) {
  const messages = graphqlMessages(payload);
  return (
    response.status === 404 ||
    hasGraphqlCode(payload, "NOT_FOUND") ||
    messages.some((message) =>
      /not found|does not exist|не найден/i.test(message),
    )
  );
}

function throwGraphqlFailure(response: Response, payload: OlxGraphqlPayload) {
  const errors = graphqlErrors(payload);
  const messages = graphqlMessages(payload);
  const combinedMessage = messages.join("; ");

  if (isAuthenticationFailure(response, payload)) {
    throw new OlxApiError(
      "reauth_required",
      combinedMessage || "OLX rejected the saved credentials",
      response.status,
    );
  }
  if (
    response.status === 429 ||
    hasGraphqlCode(payload, "RATE_LIMITED", "TOO_MANY_REQUESTS")
  ) {
    throw new OlxApiError(
      "rate_limited",
      combinedMessage || "OLX rate limited the request",
      response.status,
    );
  }
  if (isNotFoundFailure(response, payload)) {
    throw new OlxApiError(
      "not_found",
      combinedMessage || "OLX advert was not found",
      response.status,
    );
  }
  if (
    response.status === 400 ||
    response.status === 422 ||
    hasGraphqlCode(
      payload,
      "BAD_USER_INPUT",
      "FORBIDDEN",
      "GRAPHQL_VALIDATION_FAILED",
    )
  ) {
    throw new OlxApiError(
      "validation_failed",
      combinedMessage || "OLX rejected the advert action",
      response.status,
      messages,
    );
  }
  if (!response.ok || errors.length > 0) {
    throw new OlxApiError(
      "unavailable",
      combinedMessage || "OLX lifecycle request failed",
      response.status,
    );
  }

  const result = payload.data?.myAds?.updateAd;
  if (!result || stringValue(result.adId) == null) {
    throw new OlxApiError(
      "unexpected_response",
      "OLX lifecycle response did not contain an advert result",
      response.status,
    );
  }

  const status = stringValue(result.status, 80)?.toUpperCase();
  if (
    status &&
    [
      "ERROR_VALIDATION",
      "FAILED",
      "FAILED_CLIENT_ERROR",
      "LIMIT_ERROR",
      "UNKNOWN",
    ].includes(status)
  ) {
    const message = stringValue(result.message);
    throw new OlxApiError(
      status === "LIMIT_ERROR" ? "rate_limited" : "validation_failed",
      message || "OLX rejected the advert action",
      response.status,
      message ? [message] : [],
    );
  }
}

async function updateOlxAdvert(input: {
  acceptNotFound?: boolean;
  action: OlxGraphqlLifecycleAction;
  advertId: string;
  credentials: OlxCredentials;
  fetchImpl?: FetchLike;
}) {
  const advertId = parseAdvertId(input.advertId);
  const fetchImpl = input.fetchImpl ?? fetch;
  let credentials = await ensureFreshOlxCredentials(input.credentials, {
    fetchImpl,
  });

  try {
    let result = await sendUpdateAd(
      credentials,
      advertId,
      input.action,
      fetchImpl,
    );
    if (isAuthenticationFailure(result.response, result.payload)) {
      credentials = await ensureFreshOlxCredentials(credentials, {
        force: true,
        fetchImpl,
      });
      result = await sendUpdateAd(
        credentials,
        advertId,
        input.action,
        fetchImpl,
      );
    }

    if (
      input.acceptNotFound &&
      isNotFoundFailure(result.response, result.payload)
    ) {
      return { credentials, alreadyDeleted: true };
    }

    throwGraphqlFailure(result.response, result.payload);
    return { credentials, alreadyDeleted: false };
  } catch (error) {
    if (error instanceof OlxApiError) throw error;
    throw new OlxApiError(
      "unavailable",
      error instanceof Error ? error.message : "OLX lifecycle API unavailable",
    );
  }
}

/**
 * Uses the same UpdateAd mutation and action enum as the current olx.uz
 * My ads frontend. One user confirmation produces one GraphQL mutation.
 */
export async function setOlxAdvertActive(input: {
  credentials: OlxCredentials;
  advertId: string;
  isActive: boolean;
  fetchImpl?: FetchLike;
}): Promise<{
  credentials: OlxCredentials;
  action: OlxAdvertLifecycleAction;
}> {
  const action: OlxAdvertLifecycleAction = input.isActive
    ? "activate"
    : "deactivate";
  const result = await updateOlxAdvert({
    credentials: input.credentials,
    advertId: input.advertId,
    action: input.isActive ? "ACTIVATE" : "DEACTIVATE",
    fetchImpl: input.fetchImpl,
  });

  return { credentials: result.credentials, action };
}

/** Permanently removes an already-inactive advert through OLX's My ads API. */
export async function deleteOlxAdvert(input: {
  credentials: OlxCredentials;
  advertId: string;
  /** Only safe when Persona knows which OLX account created the advert. */
  acceptAlreadyDeleted?: boolean;
  fetchImpl?: FetchLike;
}): Promise<{ credentials: OlxCredentials; alreadyDeleted: boolean }> {
  const result = await updateOlxAdvert({
    acceptNotFound: input.acceptAlreadyDeleted,
    credentials: input.credentials,
    advertId: input.advertId,
    action: "REMOVE",
    fetchImpl: input.fetchImpl,
  });
  return {
    credentials: result.credentials,
    alreadyDeleted: result.alreadyDeleted,
  };
}
