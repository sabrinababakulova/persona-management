import { and, eq, isNotNull, sql } from "drizzle-orm";

import {
  candidateStatusOptions,
  candidates,
  candidateVacancies,
  hhVacancySyncState,
  vacancies,
} from "~/server/db/schema";

import {
  type HhNegotiation,
  iterateHhVacancyNegotiationPages,
} from "./negotiations";
import { isHhAccessError } from "./shared";

type DatabaseClient = typeof import("~/server/db").db;

/**
 * Overlap window subtracted from the status watermark. Re-checking a few
 * recently-changed negotiations is cheap (the writes are idempotent) and
 * absorbs clock skew and pagination races.
 */
const WATERMARK_OVERLAP_MS = 60 * 60 * 1000;

export type SyncHhStatusesResult = {
  ranSync: boolean;
  vacanciesProcessed: number;
  applicationsUpdated: number;
  statusesApplied: number;
};

/**
 * Maps an hh.uz negotiation state to a platform candidate status.
 *
 * hh.uz exposes both a machine id (`discard`, `interview`, …) and a localised
 * display name, and employers can add custom funnel stages — so the match is
 * keyword-based over both, English and Russian. Returns `null` for states that
 * do not map cleanly; the caller then leaves the funnel status untouched.
 */
function mapHhStateToStatus(
  stageId: string | null,
  stageName: string | null,
): string | null {
  const text = `${stageId ?? ""} ${stageName ?? ""}`.toLowerCase();
  if (!text.trim()) {
    return null;
  }
  if (/discard|declin|reject|refus|отказ/.test(text)) {
    return "rejected";
  }
  if (/hired|нанят|принят на работу/.test(text)) {
    return "hired";
  }
  if (/offer|оффер|предложени/.test(text)) {
    return "offer";
  }
  if (/interview|assessment|интервью|собеседов/.test(text)) {
    return "interview";
  }
  if (/phone|consider|screen|review|звонок|рассмотр/.test(text)) {
    return "screening";
  }
  if (/response|new|отклик|нов/.test(text)) {
    return "new";
  }
  return null;
}

function advisoryLockKey(companyId: string) {
  return sql`hashtext(${`hh-status:${companyId}`})::bigint`;
}

function parseHhDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Reconciles platform candidate statuses with hh.uz (sync Layer 3).
 *
 * Discovery (Layer 1) only finds *new* negotiations, so a candidate rejected
 * later on hh.uz never gets updated. This rewrites the application stage and
 * candidate status from hh.uz — hh.uz is the source of truth for status.
 *
 * Iteration is driven by the local `vacancies` table (every row with an
 * `hhVacancyId` for the company, active OR archived). Status changes can
 * happen on archived vacancies too — e.g. a recruiter declining a backlog
 * candidate after the vacancy was closed — so filtering to active would silently
 * drop those updates. Vacancies we have never synced are absent from the local
 * table and therefore have no application rows to reconcile.
 *
 * It is incremental: hh.uz sorts employer negotiations by
 * `last_change_time_except_employer_inbox desc`; the response items still
 * expose `updated_at`, so the per-vacancy watermark is stored from that field.
 * It never creates candidates or vacancies; missing rows are left for
 * discovery.
 * Concurrency-safe via a per-company advisory lock.
 */
export async function syncHhCandidateStatuses(input: {
  db: DatabaseClient;
  companyId: string;
  employers: Array<{ accessToken: string; employerId: string }>;
}): Promise<SyncHhStatusesResult> {
  const { db, companyId, employers } = input;

  const empty: SyncHhStatusesResult = {
    ranSync: false,
    vacanciesProcessed: 0,
    applicationsUpdated: 0,
    statusesApplied: 0,
  };

  if (employers.length === 0) {
    return empty;
  }

  const lockRows = (await db.execute(
    sql`SELECT pg_try_advisory_lock(${advisoryLockKey(companyId)}) AS locked`,
  )) as unknown as Array<{ locked: boolean }>;

  if (!lockRows[0]?.locked) {
    return empty;
  }

  try {
    const statusRows = await db
      .select({ value: candidateStatusOptions.value })
      .from(candidateStatusOptions)
      .where(eq(candidateStatusOptions.isActive, true));
    const validStatuses = new Set(statusRows.map((row) => row.value));

    // Pull hh.uz-linked vacancies that have local hh applications. Status sync
    // only reconciles existing application rows, so vacancies without a local
    // negotiation cannot produce any writes and should not spend hh.uz calls.
    const localRows = await db
      .select({
        id: vacancies.id,
        hhVacancyId: vacancies.hhVacancyId,
      })
      .from(vacancies)
      .innerJoin(
        candidateVacancies,
        and(
          eq(candidateVacancies.vacancyId, vacancies.id),
          isNotNull(candidateVacancies.hhNegotiationId),
        ),
      )
      .where(
        and(
          eq(vacancies.companyId, companyId),
          isNotNull(vacancies.hhVacancyId),
        ),
      )
      .groupBy(vacancies.id);

    const result: SyncHhStatusesResult = { ...empty, ranSync: true };

    for (const row of localRows) {
      const hhVacancyId = row.hhVacancyId;
      if (!hhVacancyId) {
        continue;
      }

      let syncedThisRow = false;

      for (const employer of employers) {
        try {
          const counts = await syncVacancyStatuses({
            db,
            companyId,
            accessToken: employer.accessToken,
            localVacancyId: row.id,
            hhVacancyId,
            validStatuses,
          });
          result.vacanciesProcessed += 1;
          result.applicationsUpdated += counts.applicationsUpdated;
          result.statusesApplied += counts.statusesApplied;
          syncedThisRow = true;
          break;
        } catch (error) {
          // Try the next employer when this token has no access to the
          // vacancy (vacancies may belong to a different manager / employer
          // among the company's connected accounts).
          if (isHhAccessError(error)) {
            continue;
          }
          console.error("hh status sync failed for vacancy", {
            companyId,
            employerId: employer.employerId,
            hhVacancyId,
            error,
          });
          syncedThisRow = true;
          break;
        }
      }

      if (!syncedThisRow) {
        console.warn("hh status sync: no employer token had access", {
          companyId,
          hhVacancyId,
        });
      }
    }

    return result;
  } finally {
    await db.execute(
      sql`SELECT pg_advisory_unlock(${advisoryLockKey(companyId)})`,
    );
  }
}

async function syncVacancyStatuses(input: {
  db: DatabaseClient;
  companyId: string;
  accessToken: string;
  localVacancyId: string;
  hhVacancyId: string;
  validStatuses: Set<string>;
}) {
  const {
    db,
    companyId,
    accessToken,
    localVacancyId,
    hhVacancyId,
    validStatuses,
  } = input;

  const stateRows = await db
    .select({
      lastStatusNegotiationAt: hhVacancySyncState.lastStatusNegotiationAt,
    })
    .from(hhVacancySyncState)
    .where(eq(hhVacancySyncState.vacancyId, localVacancyId))
    .limit(1);

  const watermark = stateRows[0]?.lastStatusNegotiationAt ?? null;
  const cutoff = watermark
    ? new Date(watermark.getTime() - WATERMARK_OVERLAP_MS)
    : null;

  const seenNegotiationIds = new Set<string>();
  let newestSeen: Date | null = watermark;
  let applicationsUpdated = 0;
  let statusesApplied = 0;

  // `since: cutoff` is the per-collection cursor. The generator stops paging
  // within a collection once it falls entirely below the cutoff, but moves on
  // to the next collection — a candidate moved to `discard` lives in a
  // different collection than where it was previously, and we still need to
  // see its bumped `updated_at`.
  for await (const page of iterateHhVacancyNegotiationPages({
    accessToken,
    vacancyId: hhVacancyId,
    orderBy: "last_change_time_except_employer_inbox",
    since: cutoff,
  })) {
    for (const negotiation of page) {
      if (seenNegotiationIds.has(negotiation.negotiationId)) {
        continue;
      }
      seenNegotiationIds.add(negotiation.negotiationId);

      const updatedAt = parseHhDate(negotiation.updatedAt);
      if (updatedAt && (!newestSeen || updatedAt > newestSeen)) {
        newestSeen = updatedAt;
      }

      const isChanged = !cutoff || !updatedAt || updatedAt > cutoff;
      if (!isChanged) {
        continue;
      }

      const outcome = await reconcileNegotiation({
        db,
        companyId,
        localVacancyId,
        negotiation,
        validStatuses,
      });
      if (outcome.applicationUpdated) {
        applicationsUpdated += 1;
      }
      if (outcome.statusApplied) {
        statusesApplied += 1;
      }
    }
  }

  await db
    .insert(hhVacancySyncState)
    .values({ vacancyId: localVacancyId, lastStatusNegotiationAt: newestSeen })
    .onConflictDoUpdate({
      target: hhVacancySyncState.vacancyId,
      set: { lastStatusNegotiationAt: newestSeen },
    });

  return { applicationsUpdated, statusesApplied };
}

async function reconcileNegotiation(input: {
  db: DatabaseClient;
  companyId: string;
  localVacancyId: string;
  negotiation: HhNegotiation;
  validStatuses: Set<string>;
}) {
  const { db, companyId, localVacancyId, negotiation, validStatuses } = input;

  const mapped = mapHhStateToStatus(negotiation.hhStageId, negotiation.hhStage);
  const applyStatus = mapped && validStatuses.has(mapped) ? mapped : null;

  const appUpdate: {
    hhStage: string | null;
    applicationState: string;
    updatedAt: Date;
    stage?: string;
  } = {
    hhStage: negotiation.hhStage,
    applicationState: "active",
    updatedAt: new Date(),
  };
  if (applyStatus) {
    appUpdate.stage = applyStatus;
  }

  const updated = await db
    .update(candidateVacancies)
    .set(appUpdate)
    .where(
      and(
        eq(candidateVacancies.vacancyId, localVacancyId),
        eq(candidateVacancies.hhNegotiationId, negotiation.negotiationId),
      ),
    )
    .returning({ candidateId: candidateVacancies.candidateId });

  const application = updated[0];
  if (!application) {
    // No application row yet — discovery has not picked this negotiation up.
    return { applicationUpdated: false, statusApplied: false };
  }

  if (applyStatus) {
    await db
      .update(candidates)
      .set({ status: applyStatus, hhSyncedAt: new Date() })
      .where(
        and(
          eq(candidates.id, application.candidateId),
          eq(candidates.companyId, companyId),
        ),
      );
  }

  return { applicationUpdated: true, statusApplied: Boolean(applyStatus) };
}
