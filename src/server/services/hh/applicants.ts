import {
  fetchHhJson,
  HH_API_BASE_URL,
  HH_API_NEGOTIATIONS_PER_PAGE,
  type HhNegotiationCollectionResponse,
  type HhNegotiationsCollectionInfo,
  type HhNegotiationsListResponse,
  type HhVacancyApplicant,
  toHhVacancyApplicant,
} from "./shared";

async function fetchHhNegotiationCollections(
  vacancyId: string,
  accessToken: string,
): Promise<HhNegotiationsCollectionInfo[]> {
  const searchParams = new URLSearchParams({
    host: "hh.uz",
    vacancy_id: vacancyId,
    with_generated_collections: "true",
  });

  const payload = await fetchHhJson<HhNegotiationsListResponse>(
    `${HH_API_BASE_URL}/negotiations?${searchParams}`,
    {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  return [
    ...(payload.collections ?? []),
    ...(payload.generated_collections ?? []),
  ].filter((collection): collection is HhNegotiationsCollectionInfo =>
    Boolean(collection?.id),
  );
}

export async function* iterateHhVacancyApplicantBatches(input: {
  accessToken: string;
  vacancyId: string;
}): AsyncGenerator<HhVacancyApplicant[]> {
  const collections = await fetchHhNegotiationCollections(
    input.vacancyId,
    input.accessToken,
  );

  for (const collection of collections) {
    if (!collection.id) {
      continue;
    }

    let page = 0;
    let totalPages = 1;

    while (page < totalPages) {
      const searchParams = new URLSearchParams({
        host: "hh.uz",
        page: String(page),
        per_page: String(HH_API_NEGOTIATIONS_PER_PAGE),
        vacancy_id: input.vacancyId,
      });

      const payload = await fetchHhJson<HhNegotiationCollectionResponse>(
        `${HH_API_BASE_URL}/negotiations/${collection.id}?${searchParams}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${input.accessToken}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      const items = (payload.items ?? [])
        .map((item) => toHhVacancyApplicant(item, collection.name ?? null))
        .filter((item): item is HhVacancyApplicant => item !== null);

      yield items;

      totalPages = Math.max(payload.pages ?? 0, 1);
      page += 1;

      if (items.length === 0) {
        break;
      }
    }
  }
}

export async function fetchHhVacancyApplicants(
  vacancyId: string,
  accessToken: string,
): Promise<HhVacancyApplicant[]> {
  const applicantsById = new Map<string, HhVacancyApplicant>();

  try {
    for await (const batch of iterateHhVacancyApplicantBatches({
      accessToken,
      vacancyId,
    })) {
      for (const item of batch) {
        if (!applicantsById.has(item.id)) {
          applicantsById.set(item.id, item);
        }
      }
    }
  } catch (error) {
    console.error("Failed to fetch HH vacancy applicants", {
      vacancyId,
      error,
    });
  }

  return [...applicantsById.values()];
}
