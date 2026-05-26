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

function parseHhTimestamp(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Yields negotiation pages for a vacancy, sorted newest-first by `orderBy`.
 *
 * hh.uz partitions negotiations into multiple collections (e.g. `response`,
 * `discard`, and any custom employer states) plus `generated_collections`, and
 * paginates each collection independently. A status change moves a negotiation
 * between collections AND bumps its `updated_at`, so the canonical "sort desc,
 * stop once a full page is older than the watermark" cursor only makes sense
 * **within** a single collection — across collections an older response page
 * tells us nothing about whether a discard collection has fresh items.
 *
 * Passing `since` lets the generator skip the rest of the current collection
 * once a page falls entirely below the cutoff while still moving on to the
 * next collection, so a candidate that was just moved to e.g. `discard`
 * is still observed even when the `response` collection looks stale.
 */
export async function* iterateHhVacancyNegotiationPages(input: {
  accessToken: string;
  vacancyId: string;
  orderBy?: "created_at" | "last_change_time_except_employer_inbox";
  since?: Date | null;
}): AsyncGenerator<HhNegotiation[]> {
  const collections = await fetchHhNegotiationCollections(
    input.vacancyId,
    input.accessToken,
  );
  const orderBy = input.orderBy ?? "created_at";
  const cutoff = input.since ?? null;

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
        order_by: orderBy,
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

      // Per-collection cursor: once the newest item on this page is below the
      // cutoff, every later page of this collection is even older. Other
      // collections still get scanned because they have independent cursors.
      if (cutoff) {
        const newestInPage = items.reduce<Date | null>((acc, item) => {
          const ts = parseHhTimestamp(
            orderBy === "created_at" ? item.createdAt : item.updatedAt,
          );
          if (!ts) {
            return acc;
          }
          return !acc || ts > acc ? ts : acc;
        }, null);
        if (newestInPage && newestInPage <= cutoff) {
          break;
        }
      }
    }
  }
}
