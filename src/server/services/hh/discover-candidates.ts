import { and, eq, isNotNull, or, sql } from "drizzle-orm";

import { writeRecentActivityLog } from "~/server/activity/recent-activity";
import {
  candidates,
  candidateVacancies,
  hhEnrichmentJobs,
  hhVacancySyncState,
  vacancies,
} from "~/server/db/schema";
import {
  type HhNegotiation,
  iterateHhVacancyNegotiationPages,
} from "./negotiations";
import { type HhVacancy, isHhAccessError } from "./shared";
import { fetchCompanyHhVacancies } from "./vacancies";

type DatabaseClient = typeof import("~/server/db").db;

/**
 * Overlap window subtracted from the stored watermark when deciding which
 * negotiations are "new". Re-processing a few recently-seen negotiations is
 * free (every write is an idempotent upsert) and absorbs clock skew, late
 * arrivals, and pagination races.
 */
const WATERMARK_OVERLAP_MS = 60 * 60 * 1000;

export type DiscoverHhCandidatesResult = {
  ranSync: boolean;
  vacanciesProcessed: number;
  vacanciesFailed: number;
  newCandidates: number;
  newApplications: number;
  jobsEnqueued: number;
};

/** Stable 64-bit key for the per-company advisory lock. */
function advisoryLockKey(companyId: string) {
  return sql`hashtext(${`hh-sync:${companyId}`})::bigint`;
}

function parseHhDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Discovers new hh.uz candidates for a company (Layer 1).
 *
 * Fetches every hh.uz vacancy the employer has ever had (active + archived)
 * and ensures each has a local vacancy row. Active vacancies poll negotiations
 * newest-first, stop once a page falls entirely below the watermark, upsert a
 * candidate stub plus an application row, and enqueue an enrichment job for
 * each genuinely new candidate. Archived vacancies are stored as stubs (id,
 * title, status="archive") so the list view can show them locally — their
 * applicants are intentionally NOT synced. Resume PDFs and full profiles are
 * NOT fetched here — that is the enrichment worker's job.
 *
 * Concurrency-safe: a per-company advisory lock prevents overlapping runs.
 */
export async function discoverHhCandidates(input: {
  db: DatabaseClient;
  companyId: string;
  employers: Array<{ accessToken: string; employerId: string }>;
}): Promise<DiscoverHhCandidatesResult> {
  const { db, companyId, employers } = input;

  const empty: DiscoverHhCandidatesResult = {
    ranSync: false,
    vacanciesProcessed: 0,
    vacanciesFailed: 0,
    newCandidates: 0,
    newApplications: 0,
    jobsEnqueued: 0,
  };

  if (employers.length === 0) {
    return empty;
  }

  const lockRows = (await db.execute(
    sql`SELECT pg_try_advisory_lock(${advisoryLockKey(companyId)}) AS locked`,
  )) as unknown as Array<{ locked: boolean }>;

  if (!lockRows[0]?.locked) {
    // Another discovery run for this company is already in progress.
    return empty;
  }

  try {
    const result: DiscoverHhCandidatesResult = { ...empty, ranSync: true };

    // Every hh.uz employer connected within the company is synced. Vacancies
    // and candidates are deduped by the (companyId, hhVacancyId) and
    // (companyId, hhResumeId) unique indexes, so a candidate who applied to
    // several employers is stored once and enriched once.
    for (const employer of employers) {
      // Every hh.uz vacancy the employer has ever had is mirrored locally so
      // the vacancies list can render archived rows without a live API call.
      // Only ACTIVE vacancies trigger applicant sync — archived vacancies are
      // stored as stubs and their applicants are intentionally skipped.
      let hhVacancies: HhVacancy[];
      try {
        hhVacancies = await fetchCompanyHhVacancies(
          employer.employerId,
          employer.accessToken,
        );
      } catch (error) {
        console.error("hh discovery failed to list employer vacancies", {
          companyId,
          employerId: employer.employerId,
          error,
        });
        continue;
      }

      for (const hhVacancy of hhVacancies) {
        let localVacancyId: string;
        try {
          localVacancyId = await resolveLocalVacancy({
            db,
            companyId,
            hhVacancy,
          });
        } catch (error) {
          result.vacanciesFailed += 1;
          console.error("hh discovery failed to resolve local vacancy", {
            companyId,
            hhVacancyId: hhVacancy.id,
            error,
          });
          continue;
        }

        if (hhVacancy.status !== "active") {
          // Stub-only: no applicants are stored for archived vacancies.
          result.vacanciesProcessed += 1;
          continue;
        }

        try {
          const counts = await discoverVacancy({
            db,
            companyId,
            accessToken: employer.accessToken,
            localVacancyId,
            hhVacancyId: hhVacancy.id,
          });
          result.vacanciesProcessed += 1;
          result.newCandidates += counts.newCandidates;
          result.newApplications += counts.newApplications;
          result.jobsEnqueued += counts.jobsEnqueued;
        } catch (error) {
          result.vacanciesFailed += 1;
          const message =
            error instanceof Error ? error.message : "Unknown sync error";
          if (!isHhAccessError(error)) {
            console.error("hh discovery failed for vacancy", {
              companyId,
              hhVacancyId: hhVacancy.id,
              error,
            });
          }
          await db
            .insert(hhVacancySyncState)
            .values({
              vacancyId: localVacancyId,
              lastSyncStartedAt: new Date(),
              lastSyncFinishedAt: new Date(),
              lastSyncError: message,
            })
            .onConflictDoUpdate({
              target: hhVacancySyncState.vacancyId,
              set: { lastSyncFinishedAt: new Date(), lastSyncError: message },
            });
        }
      }
    }

    return result;
  } finally {
    await db.execute(
      sql`SELECT pg_advisory_unlock(${advisoryLockKey(companyId)})`,
    );
  }
}

/**
 * Returns the local vacancy row id for an hh.uz vacancy, creating a base
 * vacancy row when none exists yet so candidates can be tied to it. When a row
 * already exists, its `status` is reconciled with hh.uz so a vacancy that flips
 * to archived on hh.uz is reflected locally. Existing candidate links are
 * preserved on archive — historical applications stay attached.
 */
async function resolveLocalVacancy(input: {
  db: DatabaseClient;
  companyId: string;
  hhVacancy: HhVacancy;
}): Promise<string> {
  const { db, companyId, hhVacancy } = input;

  const existing = await db
    .select({
      id: vacancies.id,
      status: vacancies.status,
    })
    .from(vacancies)
    .where(
      and(
        eq(vacancies.companyId, companyId),
        eq(vacancies.hhVacancyId, hhVacancy.id),
      ),
    )
    .limit(1);

  const existingRow = existing[0];
  if (existingRow) {
    if (existingRow.status !== hhVacancy.status) {
      await db
        .update(vacancies)
        .set({ status: hhVacancy.status })
        .where(eq(vacancies.id, existingRow.id));
    }
    return existingRow.id;
  }

  // A base vacancy self-references via parentId.
  const id = crypto.randomUUID();
  await db.insert(vacancies).values({
    id,
    parentId: id,
    title: hhVacancy.title,
    status: hhVacancy.status,
    companyId,
    hhVacancyId: hhVacancy.id,
  });
  return id;
}

async function discoverVacancy(input: {
  db: DatabaseClient;
  companyId: string;
  accessToken: string;
  localVacancyId: string;
  hhVacancyId: string;
}) {
  const { db, companyId, accessToken, localVacancyId, hhVacancyId } = input;

  const stateRows = await db
    .select({ lastNegotiationAt: hhVacancySyncState.lastNegotiationAt })
    .from(hhVacancySyncState)
    .where(eq(hhVacancySyncState.vacancyId, localVacancyId))
    .limit(1);

  const watermark = stateRows[0]?.lastNegotiationAt ?? null;
  // Effective cutoff: re-scan an overlap window below the stored watermark.
  const cutoff = watermark
    ? new Date(watermark.getTime() - WATERMARK_OVERLAP_MS)
    : null;

  await db
    .insert(hhVacancySyncState)
    .values({ vacancyId: localVacancyId, lastSyncStartedAt: new Date() })
    .onConflictDoUpdate({
      target: hhVacancySyncState.vacancyId,
      set: { lastSyncStartedAt: new Date() },
    });

  const seenNegotiationIds = new Set<string>();
  let newestSeen: Date | null = watermark;
  let newCandidates = 0;
  let newApplications = 0;
  let jobsEnqueued = 0;

  for await (const page of iterateHhVacancyNegotiationPages({
    accessToken,
    vacancyId: hhVacancyId,
  })) {
    let pageHasNewItem = false;

    for (const negotiation of page) {
      if (seenNegotiationIds.has(negotiation.negotiationId)) {
        continue;
      }
      seenNegotiationIds.add(negotiation.negotiationId);

      const createdAt = parseHhDate(negotiation.createdAt);
      if (createdAt && (!newestSeen || createdAt > newestSeen)) {
        newestSeen = createdAt;
      }

      // A negotiation is "new" when there is no watermark yet (first backfill),
      // when it is newer than the cutoff, or when its date is unknown.
      const isNew = !cutoff || !createdAt || createdAt > cutoff;
      if (!isNew) {
        continue;
      }
      pageHasNewItem = true;

      const outcome = await upsertNegotiation({
        db,
        companyId,
        localVacancyId,
        negotiation,
      });
      if (outcome.candidateInserted) {
        newCandidates += 1;
      }
      if (outcome.applicationInserted) {
        newApplications += 1;
      }
      if (outcome.jobEnqueued) {
        jobsEnqueued += 1;
      }
    }

    // Early termination: once a full page sits entirely below the cutoff there
    // are no newer negotiations left to find.
    if (cutoff && page.length > 0 && !pageHasNewItem) {
      break;
    }
  }

  await db
    .update(hhVacancySyncState)
    .set({
      lastNegotiationAt: newestSeen,
      lastSyncFinishedAt: new Date(),
      lastSyncError: null,
    })
    .where(eq(hhVacancySyncState.vacancyId, localVacancyId));

  return { newCandidates, newApplications, jobsEnqueued };
}

async function upsertNegotiation(input: {
  db: DatabaseClient;
  companyId: string;
  localVacancyId: string;
  negotiation: HhNegotiation;
}) {
  const { db, companyId, localVacancyId, negotiation } = input;

  let candidateId: string;
  let candidateInserted = false;

  if (negotiation.resumeId) {
    const resumeId = negotiation.resumeId;

    // Find any candidate already representing this resume: the canonical row
    // keyed by `hhResumeId`, and/or a legacy row stored with primary key
    // `hh_<resumeId>` from before this sync existed.
    const existingRows = await db
      .select({ id: candidates.id, hhResumeId: candidates.hhResumeId })
      .from(candidates)
      .where(
        and(
          eq(candidates.companyId, companyId),
          or(
            eq(candidates.hhResumeId, resumeId),
            eq(candidates.id, `hh_${resumeId}`),
          ),
        ),
      );

    const canonical = existingRows.find((row) => row.hhResumeId === resumeId);
    const legacy = existingRows.find(
      (row) => row.id === `hh_${resumeId}` && !row.hhResumeId,
    );

    if (canonical) {
      candidateId = canonical.id;
    } else if (legacy) {
      // Adopt the legacy row so this and future syncs dedupe onto it instead
      // of creating an empty duplicate. (The migration backfills the same
      // column, but `db:push` deployments skip migration SQL.)
      await db
        .update(candidates)
        .set({ hhResumeId: resumeId, hhSyncedAt: new Date() })
        .where(eq(candidates.id, legacy.id));
      candidateId = legacy.id;
    } else {
      const inserted = await db
        .insert(candidates)
        .values({
          companyId,
          hhResumeId: resumeId,
          hhResumeUrl: negotiation.resumeUrl,
          fullName: negotiation.fullName,
          source: "hh.uz",
          status: "new",
          hhSyncedAt: new Date(),
        })
        .onConflictDoNothing({
          target: [candidates.companyId, candidates.hhResumeId],
          where: isNotNull(candidates.hhResumeId),
        })
        .returning({ id: candidates.id });

      const insertedId = inserted[0]?.id;
      if (insertedId) {
        candidateId = insertedId;
        candidateInserted = true;
      } else {
        // Conflicted with a row created concurrently — re-read it.
        const reSelect = await db
          .select({ id: candidates.id })
          .from(candidates)
          .where(
            and(
              eq(candidates.companyId, companyId),
              eq(candidates.hhResumeId, resumeId),
            ),
          )
          .limit(1);
        const reSelectedId = reSelect[0]?.id;
        if (!reSelectedId) {
          return {
            candidateInserted: false,
            applicationInserted: false,
            jobEnqueued: false,
          };
        }
        candidateId = reSelectedId;
      }
    }
  } else {
    // Anonymous/hidden resume: no stable per-person key, so one candidate row
    // per negotiation. The application unique index still prevents duplicates.
    const inserted = await db
      .insert(candidates)
      .values({
        companyId,
        fullName: negotiation.fullName,
        source: "hh.uz",
        status: "new",
        hhSyncedAt: new Date(),
      })
      .returning({ id: candidates.id });
    const insertedId = inserted[0]?.id;
    if (!insertedId) {
      return {
        candidateInserted: false,
        applicationInserted: false,
        jobEnqueued: false,
      };
    }
    candidateId = insertedId;
    candidateInserted = true;
  }

  const applicationRows = await db
    .insert(candidateVacancies)
    .values({
      candidateId,
      vacancyId: localVacancyId,
      hhNegotiationId: negotiation.negotiationId,
      hhStage: negotiation.hhStage,
      applicationState: "active",
      appliedAt: parseHhDate(negotiation.createdAt),
    })
    .onConflictDoUpdate({
      target: [
        candidateVacancies.vacancyId,
        candidateVacancies.hhNegotiationId,
      ],
      targetWhere: isNotNull(candidateVacancies.hhNegotiationId),
      set: {
        hhStage: negotiation.hhStage,
        applicationState: "active",
        updatedAt: new Date(),
      },
    })
    .returning({ inserted: sql<boolean>`(xmax = 0)` });

  const applicationInserted = applicationRows[0]?.inserted ?? false;

  let jobEnqueued = false;
  // Only resume-backed candidates can be enriched (anonymous ones have no
  // resume to fetch). Ensure existing/adopted legacy rows also get a job; older
  // syncs created `hh_<resumeId>` candidates before the queue existed.
  if (negotiation.resumeId) {
    const job = await db
      .insert(hhEnrichmentJobs)
      .values({ candidateId })
      .onConflictDoNothing({ target: hhEnrichmentJobs.candidateId })
      .returning({ id: hhEnrichmentJobs.id });
    jobEnqueued = Boolean(job[0]);
  }

  if (candidateInserted) {
    await writeRecentActivityLog(db, {
      entityType: "candidate",
      entityId: candidateId,
      companyId,
      actorUserId: null,
      actorName: "hh.uz",
      action: "Новый отклик с hh.uz",
      targetName: negotiation.fullName,
      targetStatus: "Создан",
    });
  }

  return { candidateInserted, applicationInserted, jobEnqueued };
}
