import {
  fetchHhJson,
  getNestedString,
  HH_API_BASE_URL,
  HH_API_NEGOTIATIONS_PER_PAGE,
  type HhNegotiationCollectionResponse,
  type HhNegotiationsCollectionInfo,
  type HhNegotiationsListResponse,
  toHhApplicantFullName,
  toRecord,
} from "./shared";

/**
 * A negotiation (applicant response) as needed by the candidate sync. Unlike
 * {@link import("./shared").HhVacancyApplicant} this keeps the three hh.uz ids
 * apart — they identify different things — plus the timestamp the watermark
 * cursor relies on.
 */
export type HhNegotiation = {
  /** Negotiation id — one per (vacancy, candidate). Application-row key. */
  negotiationId: string;
  /** Resume id — the stable per-person key. Null for anonymous/hidden resumes. */
  resumeId: string | null;
  fullName: string;
  /** ISO timestamp of the response; the discovery watermark cursor. */
  createdAt: string | null;
  /** hh.uz employer_state / funnel_stage — reference-only pipeline status. */
  hhStage: string | null;
  /** Link to the resume on hh.uz, when exposed. */
  resumeUrl: string | null;
};

function toHhNegotiation(item: unknown): HhNegotiation | null {
  const record = toRecord(item);
  if (!record) {
    return null;
  }

  const negotiationId =
    typeof record.id === "string" || typeof record.id === "number"
      ? String(record.id)
      : null;
  if (!negotiationId) {
    return null;
  }

  const hhStage =
    getNestedString(record, ["employer_state", "name"]) ??
    getNestedString(record, ["employer_state", "id"]) ??
    getNestedString(record, ["funnel_stage", "state", "name"]) ??
    getNestedString(record, ["funnel_stage", "state", "id"]) ??
    getNestedString(record, ["state", "name"]) ??
    getNestedString(record, ["state", "id"]) ??
    null;

  return {
    negotiationId,
    resumeId: getNestedString(record, ["resume", "id"]) ?? null,
    fullName: toHhApplicantFullName(record),
    createdAt:
      getNestedString(record, ["created_at"]) ??
      getNestedString(record, ["updated_at"]) ??
      null,
    hhStage,
    resumeUrl: getNestedString(record, ["resume", "alternate_url"]) ?? null,
  };
}

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

/**
 * Yields negotiation pages for a vacancy, newest-first within each collection.
 *
 * `order_by=created_at` is requested so the discovery watermark can stop paging
 * early; hh.uz ignores unknown params, and every item still carries `createdAt`
 * so the caller can filter defensively regardless of server-side ordering.
 */
export async function* iterateHhVacancyNegotiationPages(input: {
  accessToken: string;
  vacancyId: string;
}): AsyncGenerator<HhNegotiation[]> {
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
        order_by: "created_at",
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
        .map(toHhNegotiation)
        .filter((item): item is HhNegotiation => item !== null);

      yield items;

      totalPages = Math.max(payload.pages ?? 0, 1);
      page += 1;

      if (items.length === 0) {
        break;
      }
    }
  }
}
