import { randomUUID } from "node:crypto";
import type { OlxPublicationMeta } from "~/server/api/routers/vacancies/schemas";
import { fetchOlxWithBrowser } from "./browser-transport";
import { type OlxCredentials, requestOlxApi } from "./client";
import { type OlxLocation, searchOlxLocations } from "./dictionaries";

type FetchLike = (
  input: URL | RequestInfo,
  init?: RequestInit,
) => Promise<Response>;

export type OlxAdvertInput = {
  title: string;
  descriptionHtml: string;
  salaryFrom: number | null;
  salaryTo: number | null;
  salaryCurrency: "UZS" | "USD";
  meta: OlxPublicationMeta;
};

export type OlxPublishResult =
  | { mode: "preview" }
  | { mode: "published"; advertUrl: string | null; advertId: string };

export function htmlToOlxPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/giu, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/giu, "\n")
    .replace(/<li[^>]*>/giu, "• ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/giu, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("ru");
}

async function resolveLocation(
  meta: OlxPublicationMeta,
  fetchImpl: FetchLike,
): Promise<OlxLocation> {
  if (
    meta.cityId &&
    meta.cityName &&
    meta.regionId &&
    meta.regionName &&
    Number.isFinite(meta.latitude) &&
    Number.isFinite(meta.longitude)
  ) {
    const latitude = meta.latitude;
    const longitude = meta.longitude;
    if (latitude === undefined || longitude === undefined) {
      throw new Error("OLX_LOCATION_NOT_FOUND");
    }
    return {
      cityId: meta.cityId,
      cityName: meta.cityName,
      regionId: meta.regionId,
      regionName: meta.regionName,
      latitude,
      longitude,
      label: meta.location,
      ...(meta.districtId && meta.districtName
        ? {
            districtId: meta.districtId,
            districtName: meta.districtName,
          }
        : {}),
    };
  }

  const locations = await searchOlxLocations(meta.location, fetchImpl);
  const city = normalize(meta.location.split(",")[0] ?? meta.location);
  const district = normalize(meta.districtName ?? meta.district ?? "");
  const matches = locations.filter(
    (location) => normalize(location.cityName) === city,
  );
  if (district) {
    const exact = matches.find(
      (location) => normalize(location.districtName ?? "") === district,
    );
    if (exact) return exact;
  }
  const cityOnly = matches.find((location) => !location.districtId);
  if (cityOnly) return cityOnly;
  const onlyMatch = matches[0];
  if (matches.length === 1 && onlyMatch) return onlyMatch;
  throw new Error(
    matches.length > 1
      ? "OLX_LOCATION_DISTRICT_REQUIRED"
      : "OLX_LOCATION_NOT_FOUND",
  );
}

export async function buildOlxOfferPayload(
  advert: OlxAdvertInput,
  fetchImpl: FetchLike = fetch,
): Promise<Record<string, unknown>> {
  const title = advert.title.trim();
  const description = htmlToOlxPlainText(advert.descriptionHtml);
  if (title.length < 16 || title.length > 70) {
    throw new Error("OLX_TITLE_LENGTH");
  }
  if (description.length < 80 || description.length > 9_000) {
    throw new Error("OLX_DESCRIPTION_LENGTH");
  }
  if (!advert.meta.categoryId) throw new Error("OLX_CATEGORY_REQUIRED");
  if (!advert.meta.contactName || advert.meta.contactName.trim().length < 2) {
    throw new Error("OLX_CONTACT_REQUIRED");
  }

  const location = await resolveLocation(advert.meta, fetchImpl);
  const salary: Record<string, unknown> = {
    arranged: advert.meta.salaryNegotiable ? 1 : 0,
    currency: advert.salaryCurrency === "USD" ? "UYE" : "UZS",
  };
  if (advert.salaryFrom !== null) salary.from = String(advert.salaryFrom);
  if (advert.salaryTo !== null) salary.to = String(advert.salaryTo);

  const parameters: Record<string, unknown> = {
    job_type: advert.meta.employmentType === "temp" ? "temp" : "perm",
    salary,
    job_timing: advert.meta.schedule === "part" ? "part" : "full",
  };
  if (advert.meta.remoteWork) parameters.remote_work = true;
  if (advert.meta.onlineRecruitment) parameters.remote_recruitment = true;

  return {
    title,
    category_id: advert.meta.categoryId,
    city_id: location.cityId,
    ...(location.districtId ? { district_id: location.districtId } : {}),
    latitude: location.latitude,
    longitude: location.longitude,
    parameters,
    description,
    external_url: "",
    person: advert.meta.contactName.trim(),
    phone: advert.meta.contactPhone ?? "",
    email: "",
    components_data: {
      reposting: {
        action: "ad_posted",
        data: JSON.stringify({ reposting: false }),
      },
    },
  };
}

function responseData(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  return payload.data && typeof payload.data === "object"
    ? (payload.data as Record<string, unknown>)
    : payload;
}

function valueAsString(value: unknown): string | null {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : null;
}

export async function submitOlxOffer(input: {
  credentials: OlxCredentials;
  advert: OlxAdvertInput;
  dryRun: boolean;
  fetchImpl?: FetchLike;
}): Promise<{ credentials: OlxCredentials; result: OlxPublishResult }> {
  const apiFetch = input.fetchImpl ?? fetchOlxWithBrowser;
  const body = await buildOlxOfferPayload(
    input.advert,
    input.fetchImpl ?? fetch,
  );
  const postingId = randomUUID();
  const submitted = await requestOlxApi(
    input.credentials,
    input.dryRun ? "offers-preview" : "offers",
    {
      method: "POST",
      headers: { "posting-id": postingId },
      body: JSON.stringify(body),
    },
    apiFetch,
  );

  if (input.dryRun) {
    return { credentials: submitted.credentials, result: { mode: "preview" } };
  }

  const data = responseData(submitted.payload);
  const advertId = valueAsString(data.id);
  if (!advertId) throw new Error("OLX_PUBLISH_RESPONSE_INVALID");
  let advertUrl = valueAsString(data.url);
  let credentials = submitted.credentials;

  if (!advertUrl) {
    try {
      const fetched = await requestOlxApi(
        credentials,
        `offers/${encodeURIComponent(advertId)}`,
        {},
        apiFetch,
      );
      credentials = fetched.credentials;
      advertUrl = valueAsString(responseData(fetched.payload).url);
    } catch {
      // A newly created advert can briefly await moderation. Its stable id is
      // still persisted so Persona cannot accidentally submit a duplicate.
    }
  }

  return {
    credentials,
    result: { mode: "published", advertId, advertUrl },
  };
}
