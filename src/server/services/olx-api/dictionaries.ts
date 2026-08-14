import { z } from "zod";
import { fetchOlxWithBrowser } from "./browser-transport";

const OLX_HOME_URL = "https://www.olx.uz/";
const OLX_LOCATION_URL =
  "https://www.olx.uz/api/v1/geo-encoder/location-autocomplete";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;
const OLX_PUBLIC_USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";

type FetchLike = (
  input: URL | RequestInfo,
  init?: RequestInit,
) => Promise<Response>;

const categorySchema = z.object({
  id: z.number().int().positive(),
  parentId: z.number().int().nonnegative(),
  name: z.string().min(1),
  type: z.string(),
  isAdding: z.boolean(),
  children: z.array(z.number().int().positive()),
});

const prerenderedStateSchema = z.object({
  categories: z.object({ list: z.record(categorySchema) }),
});

const locationResponseSchema = z.object({
  data: z.array(
    z.object({
      city: z.object({
        id: z.number().int().positive(),
        name: z.string().min(1),
        lat: z.number(),
        lon: z.number(),
      }),
      district: z
        .object({
          id: z.number().int().positive(),
          name: z.string().min(1),
          lat: z.number(),
          lon: z.number(),
        })
        .optional(),
      region: z.object({
        id: z.number().int().positive(),
        name: z.string().min(1),
      }),
    }),
  ),
});

export type OlxJobCategory = {
  id: number;
  label: string;
  path: string[];
};

export type OlxLocation = {
  cityId: number;
  cityName: string;
  districtId?: number;
  districtName?: string;
  regionId: number;
  regionName: string;
  latitude: number;
  longitude: number;
  label: string;
};

let categoryCache:
  | { expiresAt: number; value: Promise<OlxJobCategory[]> }
  | undefined;

function readJavaScriptString(source: string, start: number): string {
  if (source[start] !== '"') throw new Error("OLX state is not a string");
  let escaped = false;
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      continue;
    }
    if (character === '"') return source.slice(start, index + 1);
  }
  throw new Error("OLX state string is incomplete");
}

export function parseOlxJobCategories(html: string): OlxJobCategory[] {
  const match = /window\.__PRERENDERED_STATE__\s*=\s*/u.exec(html);
  if (!match) throw new Error("OLX category state was not found");

  const literalStart = match.index + match[0].length;
  const serializedState = JSON.parse(
    readJavaScriptString(html, literalStart),
  ) as string;
  const state = prerenderedStateSchema.parse(JSON.parse(serializedState));
  const categories = state.categories.list;

  const pathFor = (category: z.infer<typeof categorySchema>) => {
    const path: string[] = [];
    const visited = new Set<number>();
    let current: z.infer<typeof categorySchema> | undefined = category;
    while (current && !visited.has(current.id)) {
      visited.add(current.id);
      path.unshift(current.name);
      current = categories[String(current.parentId)];
    }
    return path;
  };

  return Object.values(categories)
    .filter(
      (category) =>
        category.type === "job" &&
        category.isAdding &&
        category.children.length === 0,
    )
    .map((category) => {
      const path = pathFor(category);
      return {
        id: category.id,
        path,
        label: path.slice(1).join(" › ") || category.name,
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label, "ru"));
}

async function loadOlxJobCategories(
  fetchImpl: FetchLike,
): Promise<OlxJobCategory[]> {
  const response = await fetchImpl(OLX_HOME_URL, {
    headers: {
      Accept: "text/html",
      "Accept-Language": "ru-UZ",
      "User-Agent": OLX_PUBLIC_USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`OLX categories request failed (${response.status})`);
  }
  return parseOlxJobCategories(await response.text());
}

export async function getOlxJobCategories(
  fetchImpl?: FetchLike,
): Promise<OlxJobCategory[]> {
  if (fetchImpl) return loadOlxJobCategories(fetchImpl);
  if (categoryCache && categoryCache.expiresAt > Date.now()) {
    return categoryCache.value;
  }

  const value = loadOlxJobCategories(fetchOlxWithBrowser).catch((error) => {
    categoryCache = undefined;
    throw error;
  });
  categoryCache = { expiresAt: Date.now() + CACHE_TTL_MS, value };
  return value;
}

export async function searchOlxLocations(
  query: string,
  fetchImpl: FetchLike = fetchOlxWithBrowser,
): Promise<OlxLocation[]> {
  const normalizedQuery = query.trim().slice(0, 100);
  if (normalizedQuery.length < 2) return [];

  const url = new URL(OLX_LOCATION_URL);
  url.searchParams.set("query", normalizedQuery);
  url.searchParams.set("scope", "posting");
  const response = await fetchImpl(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "ru-UZ",
      "olx-locale": "ru-UZ",
      "User-Agent": OLX_PUBLIC_USER_AGENT,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`OLX location request failed (${response.status})`);
  }

  const parsed = locationResponseSchema.parse(await response.json());
  const unique = new Map<string, OlxLocation>();
  for (const item of parsed.data) {
    const coordinates = item.district ?? item.city;
    const location: OlxLocation = {
      cityId: item.city.id,
      cityName: item.city.name,
      regionId: item.region.id,
      regionName: item.region.name.trim(),
      latitude: coordinates.lat,
      longitude: coordinates.lon,
      label: item.district
        ? `${item.city.name}, ${item.district.name}`
        : `${item.city.name}, ${item.region.name.trim()}`,
      ...(item.district
        ? {
            districtId: item.district.id,
            districtName: item.district.name,
          }
        : {}),
    };
    unique.set(`${location.cityId}:${location.districtId ?? 0}`, location);
  }
  return [...unique.values()].slice(0, 30);
}
