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
  /** ISO timestamp the response was created; the discovery watermark cursor. */
  createdAt: string | null;
  /** ISO timestamp of the last change; the status-sync watermark cursor. */
  updatedAt: string | null;
  /** hh.uz employer_state / funnel_stage display name — stored for reference. */
  hhStage: string | null;
  /** Machine-readable state id (e.g. `discard`), used to map to a platform status. */
  hhStageId: string | null;
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

  const hhStageId =
    getNestedString(record, ["employer_state", "id"]) ??
    getNestedString(record, ["funnel_stage", "state", "id"]) ??
    getNestedString(record, ["state", "id"]) ??
    null;

  const hhStage =
    getNestedString(record, ["employer_state", "name"]) ??
    getNestedString(record, ["funnel_stage", "state", "name"]) ??
    getNestedString(record, ["state", "name"]) ??
    hhStageId;

  return {
    negotiationId,
    resumeId: getNestedString(record, ["resume", "id"]) ?? null,
    fullName: toHhApplicantFullName(record),
    createdAt: getNestedString(record, ["created_at"]) ?? null,
    updatedAt: getNestedString(record, ["updated_at"]) ?? null,
    hhStage,
    hhStageId,
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
 * Yields negotiation pages for a vacancy, sorted newest-first by `orderBy`.
 *
 * hh.uz sorts negotiations by `created_at` or `updated_at` (`order=desc`), so a
 * watermark cursor can stop paging early. Every item also carries both
 * timestamps, so the caller can filter defensively regardless of ordering.
 */
export async function* iterateHhVacancyNegotiationPages(input: {
  accessToken: string;
  vacancyId: string;
  orderBy?: "created_at" | "updated_at";
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
        order: "desc",
        order_by: input.orderBy ?? "created_at",
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
