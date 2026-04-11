import type { LookupOption } from "~/types/shared/candidate-lookups";

type CountriesNowCountry = {
  country?: string;
  cities?: string[];
};

type CountriesNowResponse = {
  error?: boolean;
  msg?: string;
  data?: CountriesNowCountry[];
};

const COUNTRIES_NOW_URL = "https://countriesnow.space/api/v0.1/countries";
const TARGET_COUNTRY = "uzbekistan";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let cachedCityOptions: LookupOption[] | null = null;
let cachedAt = 0;
let inFlightRequest: Promise<LookupOption[]> | null = null;

function mapCitiesToOptions(cities: string[]): LookupOption[] {
  const collator = new Intl.Collator("ru");

  return [...new Set(cities.map((city) => city.trim()).filter(Boolean))]
    .sort((left, right) => collator.compare(left, right))
    .map((city) => ({ value: city, label: city }));
}

async function fetchUzbekistanCityOptions(): Promise<LookupOption[]> {
  const response = await fetch(COUNTRIES_NOW_URL, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`CountriesNow request failed with ${response.status}`);
  }

  const payload = (await response.json()) as CountriesNowResponse;

  if (!Array.isArray(payload.data)) {
    throw new Error("CountriesNow payload did not include country data");
  }

  const uzbekistan = payload.data.find(
    (country) => country.country?.trim().toLowerCase() === TARGET_COUNTRY,
  );

  if (!uzbekistan?.cities) {
    return [];
  }

  return mapCitiesToOptions(uzbekistan.cities);
}

export async function getVacancyCityOptions(): Promise<LookupOption[]> {
  const now = Date.now();

  if (cachedCityOptions && now - cachedAt < CACHE_TTL_MS) {
    return cachedCityOptions;
  }

  if (!inFlightRequest) {
    inFlightRequest = fetchUzbekistanCityOptions()
      .then((cities) => {
        cachedCityOptions = cities;
        cachedAt = Date.now();
        return cities;
      })
      .finally(() => {
        inFlightRequest = null;
      });
  }

  return inFlightRequest;
}
