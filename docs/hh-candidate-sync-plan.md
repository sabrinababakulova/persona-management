# Plan: Persisting hh.uz Candidates to the Database

Status: **Proposed** · Owner: _TBD_ · Last updated: 2026-05-21

## 1. Goal

Move hh.uz candidates from **ephemeral, fetched-on-every-request** data into
**first-class persisted records**, so the product can:

- change a candidate's pipeline status per vacancy,
- attach AI analysis, notes, tags, and a match score that survive across sessions,
- show candidates instantly without a fan-out of hh.uz API calls,
- filter, search, and paginate candidates in SQL.

hh.uz remains the **source of truth for raw profile data**. The database becomes the
source of truth for **everything the recruiter does with that data**.

## 2. Current state (as of this plan)

| Concern | Today |
|---|---|
| Candidate storage | `candidates` table — already rich (status, `aiAnalysis`, `matchScore`, profile JSON). |
| hh.uz applicants | **Not persisted.** `listHhCandidatesProcedure` fan-out-fetches them live on every request. |
| Candidate ↔ vacancy link | `candidateVacancies` — bare join (`id`, `candidateId`, `vacancyId`). No status, no metadata. |
| De-facto persistence | `getCandidateProcedure` (`candidates/detail.ts`) upserts an hh candidate **on first open**, PK = `hh_<resumeId>`. |
| Funnel | `vacancies/detail.ts` merges stored `hh_*` rows with a **live applicant feed**, deduped by stripping the `hh_` prefix. |
| Identity | `toHhVacancyApplicant` keys each applicant on `resumeId ?? applicantId ?? negotiationId`. |
| Pipeline status | hh.uz `employer_state` / `funnel_stage` is parsed-then-discarded — **hardcoded to `"new"`** (`hh/shared.ts:357-372`). |

**Problems with the current model**

1. The PK is overloaded with semantics (`hh_<resumeId>`). Recreating a resume changes the id.
2. Status lives on `candidates.status` — but status in recruiting is **per vacancy**, not per person.
3. The funnel still needs live API calls; stored rows are a partial cache, not a system of record.
4. `candidateVacancies` is not populated for hh candidates, so there is no durable link.

## 3. Target architecture

Two layers, deliberately separate — *finding* new candidates and *processing* them
are different problems, and only the second is a queue.

```
            ┌─ Layer 1: Discovery (cheap, frequent) ──────────────┐
cron/poll ─►│ cursor poll per vacancy (newest-first, watermark)   │
            │   upsert stub  ──onConflictDoNothing──► DB          │
            │   if newly inserted ──► enqueue enrichment job      │
            │   advance watermark                                 │
            └─────────────────────────────────────────────────────┘
            ┌─ Layer 2: Enrichment (expensive, rate-limited) ─────┐
  worker ──►│ drain job table (FOR UPDATE SKIP LOCKED)            │
            │   fetch resume + AI analysis ──► fill profile       │
            └─────────────────────────────────────────────────────┘
                                  │
                              tRPC reads ──► UI
```

The crucial idea: **never fetch the full list and diff it against the DB.** A
per-vacancy watermark bounds *how much* is fetched, and a unique-index upsert handles
dedup *without an explicit DB check*. See §5.

Four principles:

- **One person = one `candidates` row**, keyed by a stable external id, not the PK.
- **One application = one `candidateVacancies` row**, carrying per-vacancy status.
- **Sync never clobbers recruiter-owned fields.** Ownership of every column is explicit.
- **Discovery is incremental.** Steady state = one page fetched per vacancy, then stop.

## 4. Schema changes

New migration (next number, e.g. `0028_hh_candidate_sync.sql`) generated via
`bun run db:generate`. Schema edits go in `src/server/db/schema.ts`.

### 4.1 `candidates` — add external identity + sync bookkeeping

```ts
// new columns
hhResumeId:        d.varchar({ length: 100 }),               // stable per-resume key
hhResumeUrl:       d.varchar({ length: 500 }),               // link to the resume on hh.uz
hhResumeFetchedAt: d.timestamp({ withTimezone: true }),      // null = stub, not enriched
hhSyncedAt:        d.timestamp({ withTimezone: true }),      // last successful sync touch
profileLocked:     d.boolean().notNull().default(false),     // recruiter edited profile → stop profile sync
```

- Keep `id` a plain UUID **always**. Stop minting `hh_<id>` primary keys.
- Add a **partial unique index**: `UNIQUE (companyId, hhResumeId) WHERE hhResumeId IS NOT NULL`.
  This is the conflict target for the upsert and the per-company dedup guarantee.
- **No PDF is downloaded or stored for hh.uz candidates.** The existing
  `resumeFileId` / `resumeFileName` / `resumeFileSize` columns belong to the
  manual resume-upload flow and stay **null** for hh-sourced rows. hh.uz candidates
  link out via `hhResumeUrl` instead (the hh.uz `alternate_url`).

### 4.2 `candidateVacancies` → promote to an "application" table

Rename conceptually to *applications* (table name `vacancy_candidate` can stay to
avoid churn). Add:

```ts
hhNegotiationId: d.varchar({ length: 100 }),                 // one per vacancy×person
stage:           d.varchar({ length: 50 }).notNull().default("new"), // recruiter-owned funnel stage
hhStage:         d.varchar({ length: 50 }),                  // hh.uz employer_state, sync-owned
applicationState: d.varchar({ length: 20 }).notNull().default("active"), // active | withdrawn | archived
appliedAt:       d.timestamp({ withTimezone: true }),
createdAt:       d.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
updatedAt:       d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
```

- Add **partial unique index**: `UNIQUE (vacancyId, hhNegotiationId) WHERE hhNegotiationId IS NOT NULL`.
- `stage` is what the funnel board renders and what recruiters drag. `hhStage` is reference-only.
- `candidates.status` is kept only for **manually added** candidates / aggregate views; for
  hh candidates, the funnel reads `stage` from this table.

### 4.3 Field ownership matrix

| Field | Owner | Sync behavior |
|---|---|---|
| `candidates` raw profile (city, skills, experience, workExperience, education, contacts, salary) | hh.uz | Overwrite on enrichment **unless `profileLocked`**. |
| `candidates.fullName`, `hhResumeUrl` | hh.uz | Refresh on every sync. |
| `candidates.resumeFileId` / `resumeFileName` / `resumeFileSize` | manual upload only | **Untouched** by hh sync — stay null for hh candidates. |
| `candidates.aiAnalysis`, `matchScore`, `tags`, `notes`, `status` | recruiter | **Never** written by sync. |
| `candidateVacancies.stage` | recruiter | **Never** written by sync. |
| `candidateVacancies.hhStage`, `applicationState` | hh.uz | Refresh on every sync. |

### 4.4 `hhVacancySyncState` — per-vacancy discovery watermark

The cursor that makes discovery incremental. One row per hh.uz-linked vacancy.

```ts
export const hhVacancySyncState = createTable("hh_vacancy_sync_state", (d) => ({
  vacancyId: d.varchar({ length: 255 }).notNull().primaryKey()
    .references(() => vacancies.id, { onDelete: "cascade" }),
  // Watermark: created_at of the newest negotiation processed so far.
  lastNegotiationAt: d.timestamp({ withTimezone: true }),
  lastSyncStartedAt: d.timestamp({ withTimezone: true }),
  lastSyncFinishedAt: d.timestamp({ withTimezone: true }),
  lastSyncError: d.text(),
}));
```

### 4.5 `hhEnrichmentJobs` — the enrichment queue

A Postgres-backed job table drained with `FOR UPDATE SKIP LOCKED`. This stack has no
Redis/BullMQ, and a DB-backed queue needs no extra infrastructure, is crash-safe, and
supports multiple workers natively.

```ts
export const hhEnrichmentJobs = createTable("hh_enrichment_job", (d) => ({
  id: d.varchar({ length: 255 }).notNull().primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  candidateId: d.varchar({ length: 255 }).notNull()
    .references(() => candidates.id, { onDelete: "cascade" }).unique(),
  status: d.varchar({ length: 20 }).notNull().default("pending"), // pending | processing | done | failed
  attempts: d.integer().notNull().default(0),
  runAfter: d.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  lockedAt: d.timestamp({ withTimezone: true }),
  lastError: d.text(),
  createdAt: d.timestamp({ withTimezone: true }).$defaultFn(() => new Date()).notNull(),
  updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
}), (t) => [index("hh_enrichment_job_claim_idx").on(t.status, t.runAfter)]);
```

- `candidateId` is `unique` so a candidate is never queued twice.
- `runAfter` doubles as the retry-backoff timestamp and the claim ordering key.

## 5. Sync service

Two new files under `src/server/services/hh/` — `discover-candidates.ts` (Layer 1)
and `enrich-worker.ts` (Layer 2). Both are pure services — no tRPC context — taking
`db`, `companyId`, `accessToken`, and their target scope.

hh.uz exposes a **cheap list** (negotiations: id + name + state) and an **expensive
per-resume detail** call (separate request each, 10s timeout, rate-limited). The two
layers below map directly onto that split.

> **Why not "fetch all + diff"?** Re-fetching every negotiation on each sync grows
> linearly with the company's history and burns API quota for data that didn't change.
> Instead, Layer 1 *bounds the fetch* with a watermark, and the *database* — not
> application code — does the dedup via a unique-index upsert.

### 5.1 Layer 1 — Discovery (incremental cursor poll)

New file: `src/server/services/hh/discover-candidates.ts`.

A **new candidate = a new negotiation.** Discovery finds only those, cheaply:

1. **Read the watermark** for the vacancy from `hhVacancySyncState.lastNegotiationAt`.
2. **Fetch newest-first.** hh.uz returns the response collection in
   reverse-chronological order, and each negotiation carries a `created_at`. Page
   through `0, 1, 2, …` and **stop as soon as an entire page is older than the
   watermark.** In steady state that is *one page, then stop* — never the whole list.
   - First sync of a vacancy has no watermark → it pages through everything **once**
     as a backfill. This happens exactly once per vacancy.
3. For each negotiation **newer than the watermark**, in a per-vacancy transaction:
   - Upsert the `candidates` stub on `(companyId, hhResumeId)`:
     ```ts
     insert(candidates).values({ companyId, hhResumeId, fullName, source: "hh.uz", status: "new" })
       .onConflictDoNothing({ target: [companyId, hhResumeId] })
       .returning({ id, inserted: sql`xmax = 0` })
     ```
     `onConflictDoNothing` **is** the dedup — no `SELECT`, no diff. A re-seen resume
     is a free no-op at the DB level.
   - Upsert the application on `(vacancyId, hhNegotiationId)` with `onConflictDoUpdate`
     (refresh `hhStage` / `applicationState`, **never** `stage`).
   - If the candidate row was newly **inserted** (`xmax = 0`):
     - write a `recentActivityLogs` entry ("Новый отклик с hh.uz"), and
     - **enqueue an enrichment job**: `insert(hhEnrichmentJobs).values({ candidateId })
       .onConflictDoNothing()` (the `candidateId` unique constraint prevents duplicates).
4. **Advance the watermark** to `newest_created_at − overlap`, where `overlap` is a
   small window (e.g. 1 hour). The overlap absorbs clock skew, late-arriving
   negotiations, and pagination races; re-processing a few items is harmless because
   every write is an idempotent upsert.

Layer 1 makes **zero resume calls** and is fully idempotent and resumable.

> **Targeting the right collection.** `iterateHhVacancyApplicantBatches` currently
> walks *all* collections. For discovery, poll only the new-responses collection
> (hh.uz exposes a `response` collection) so the watermark walk is shortest. Verify
> the collection id against the live API before relying on it; the watermark +
> early-terminate logic is correct regardless of which collections are walked.

### 5.2 Layer 2 — Enrichment (queue worker)

New file: `src/server/services/hh/enrich-worker.ts`. Discovery enqueues a job per new
candidate; the worker drains the queue independently, at whatever rate hh.uz tolerates.

**Claiming jobs** — many workers, no double-processing:

```sql
UPDATE hh_enrichment_job
SET status = 'processing', locked_at = now()
WHERE id IN (
  SELECT id FROM hh_enrichment_job
  WHERE status = 'pending' AND run_after <= now()
  ORDER BY run_after
  FOR UPDATE SKIP LOCKED
  LIMIT 5            -- batch size = the rate-limit knob
)
RETURNING *;
```

`FOR UPDATE SKIP LOCKED` lets concurrent workers claim disjoint batches without
blocking each other.

**Processing each job** — `enrichHhCandidate(db, companyId, candidateId)`:

1. `fetchHhResumeById(hhResumeId, accessToken)` — this returns the **structured JSON
   resume** hh.uz exposes (name, city, skills, languages, work experience, education,
   contacts, salary, `alternate_url`). **No PDF is downloaded.** There is no
   file-storage step and no `uploadCandidateResumeToStorage` call in this flow.
2. If `profileLocked` is false, write the structured profile fields and `hhResumeUrl`
   (from `alternate_url`); set `hhResumeFetchedAt`.
3. If `aiAnalysis` is empty, run `generateCandidateAiAnalysis` **once** on the
   structured text (`formatHhCandidateForAiAnalysis`, the `resumeText` path — not the
   `fileBuffer` path), and store it.
4. On success → `status = 'done'`. On failure → `attempts++`,
   `run_after = now() + backoff(attempts)`, `status = 'pending'`; after N attempts →
   `status = 'failed'` with `lastError`.

**Re-enrichment** (refreshing an already-enriched candidate) is *not* this queue's
job — it is a separate, lower-frequency concern gated by an `hhResumeFetchedAt` TTL,
triggered lazily on candidate open. The queue exists purely to turn **new stubs** into
full profiles.

### 5.3 Scope, scheduling, concurrency

- **Scope:** all hh.uz-linked vacancies for the company (`vacancies.hhVacancyId IS NOT NULL`).
  Optionally a single vacancy for an on-demand sync.
- **Triggers:**
  - *Discovery* — a manual "Sync" button (tRPC mutation) for v1; a per-company cron
    every few minutes later. Cheap, so it can run often.
  - *Enrichment worker* — a cron-invoked route (e.g. every minute) that drains a bounded
    batch, or a long-running loop. Decoupled from discovery cadence.
- **Concurrency guard:** a Postgres advisory lock keyed on `companyId`
  (`pg_try_advisory_lock`) so two discovery runs for the same company cannot
  interleave. If the lock is held, return early ("sync already running"). The worker
  needs no such lock — `SKIP LOCKED` already isolates job claims.
- **Token refresh:** reuse `resolveUserHhAuth`; refresh expired tokens before the run.

## 6. tRPC surface

| Procedure / endpoint | Type | Purpose |
|---|---|---|
| `candidates.syncHh` | mutation | Run Layer 1 discovery for the company; returns counts (new / withdrawn / jobs enqueued). |
| `hhEnrichmentWorker` route | cron route | Drain a bounded batch of enrichment jobs (Layer 2). Protected by a shared secret. |
| `candidates.listHh` | query | **Rewrite** to read from DB (was live fan-out). Fast, filterable, paginated. |
| `candidates.get` | query | Return the stored row. If still a stub, surface "enriching…" and ensure a job is queued. |
| `vacancies.funnel` | query | **Drop the live applicant feed.** Read applications + candidates from DB. |

The live-fetch code paths (`listHhCandidatesProcedure` fan-out, the funnel's
`fetchHhVacancyApplicants` merge in `vacancies/detail.ts`) are removed once sync lands.

## 7. Migration of existing data

Existing hh candidates have PK `hh_<resumeId>` and no `candidateVacancies` rows.

1. **Backfill `hhResumeId`** for legacy rows:
   `UPDATE candidate SET hh_resume_id = substring(id from 4) WHERE id LIKE 'hh\_%'`.
2. **Do not rewrite primary keys** — too risky and they may be referenced. Legacy rows
   keep their `hh_` PK; only *new* rows get UUID PKs. The unique index on
   `(companyId, hhResumeId)` makes both coexist; a legacy row is found and updated by
   the upsert instead of duplicated.
3. **Code touch points** that branch on `id.startsWith("hh_")` must be updated to branch
   on `source === "hh.uz"` / `hhResumeId IS NOT NULL` instead:
   `candidates/detail.ts`, `candidates/list.ts`, `vacancies/detail.ts`,
   `vacancies/shared.ts`, `app/vacancies/[id]/funnel/page.tsx`.
   (Note: `hh_` is *also* used for hh vacancy ids — keep those distinct.)
4. First sync after deploy backfills `candidateVacancies` application rows for all
   previously-imported candidates.

## 8. Edge cases

### Identity & deduplication
- **Same resume, multiple vacancies** → one `candidates` row, one application row per
  vacancy. Handled by the two separate unique indexes.
- **Anonymous / hidden resume** → `toHhVacancyApplicant` falls back to `applicantId` or
  `negotiationId`, which are **not** resume ids. Detect this: only set `hhResumeId` when
  the id is genuinely a resume id. If unknown, leave `hhResumeId` null, key the candidate
  per negotiation, and skip Phase 2 (no resume to fetch).
- **Resume recreated** → resume id changes → looks like a new candidate (duplicate).
  Accept for v1. Mitigation later: secondary match on normalized email/phone after
  enrichment, surfaced as a recruiter-confirmed "possible duplicate" merge — never auto-merge.
- **Collision with a manually-added candidate** (same human, added by hand) → do **not**
  auto-merge. Keep separate, keyed by `hhResumeId`. Optional later: duplicate hint by contact.
- **Two hh.uz accounts in one company** indexing overlapping vacancies → the same resume
  resolves to the same `(companyId, hhResumeId)` → one row. Safe.

### Incremental discovery & the queue
- **First sync of a vacancy** → no watermark → one-time full backfill page-through.
  Every later run is bounded by the watermark.
- **Discovery only catches *new* negotiations**, not status changes or withdrawals on
  existing ones. That is the intended scope. `hhStage` changes and withdrawals are
  handled by a separate, lower-frequency reconciliation pass (or refreshed lazily when
  a candidate is opened) — never by the watermark poll.
- **Withdrawn negotiation** → invisible to a newest-first poll. Detect it only in the
  periodic full reconciliation pass → set `applicationState = withdrawn`. Never delete.
- **Pagination race** (a negotiation inserted mid-page-walk) → absorbed by the overlap
  window; the idempotent upsert makes re-processing free.
- **Clock skew on `created_at`** → the overlap window covers it; never set the
  watermark to the exact max seen.
- **Crash mid-discovery** → the watermark is advanced only after a vacancy completes,
  so a re-run safely re-scans from the last committed watermark.
- **Job enqueued but candidate deleted** → `onDelete: cascade` removes the job too.
- **Worker crash mid-job** → job stays `processing` with a stale `lockedAt`; a reaper
  resets `processing` rows older than a timeout back to `pending`.
- **Duplicate enqueue** → impossible; `hhEnrichmentJobs.candidateId` is `unique` and
  the insert uses `onConflictDoNothing`.

### Sync concurrency & failure
- **Concurrent discovery runs (same company)** → advisory lock prevents interleave.
- **Concurrent enrichment workers** → `FOR UPDATE SKIP LOCKED` gives each a disjoint
  batch; no lock needed.
- **Discovery racing a lazy enrich / manual import** → all writes upsert on the same
  unique indexes, so worst case is a harmless double-update.
- **Partial failure mid-run** → per-vacancy transactions; vacancies already processed are
  committed and their watermarks advanced. Discovery is idempotent — just re-run.
- **A vacancy's fetch throws** → catch per vacancy, log, continue with the rest. Do not
  fail the whole sync.

### hh.uz API
- **Expired / revoked token** → refresh; if refresh fails, abort sync with a clear error,
  do not partially write.
- **403 / 404 (`isHhAccessError`)** → the account cannot read that vacancy's negotiations.
  Skip that vacancy, surface a per-vacancy warning, keep existing data.
- **429 / rate limit** → exponential backoff; if exhausted, stop early and report partial
  success (rows already written stay).
- **10s request timeout** → treated as a per-vacancy failure; continue.
- **Pagination drift** (applicant added/removed mid-pagination) → harmless; the next sync
  reconciles. The disappearance pass only withdraws, never deletes.
- **Archived vacancy** → still has negotiations. Decide policy: sync archived vacancies but
  mark their applications low-priority. Default: include them.

### Data quality
- **Missing name** → `fetchHhResumeById` already falls back to title / "Неизвестный кандидат".
- **Resume deleted between discovery and enrichment** → `fetchHhResumeById` 404s → the
  job exhausts its retries and lands in `failed`; the stub is kept, not blanked or crashed.
- **Unsupported salary currency** → coerced to `UZS` (existing behavior); document it.
- **HTML in descriptions** → run through `sanitize-html.ts` before storing.
- **Oversized fields** → profile free-text into `text` columns / truncate `varchar(255)`
  fields defensively.

### Recruiter edits vs. sync
- **Recruiter changed `stage`** → sync writes only `hhStage`, never `stage`. Safe.
- **Recruiter edited a profile field** on an hh candidate → set `profileLocked = true`;
  subsequent syncs stop overwriting profile fields for that candidate.
- **AI analysis already present** → never regenerated (cost). Re-enrichment only refreshes
  raw profile, gated by the `hhResumeFetchedAt` TTL.

### Application lifecycle
- **New negotiation for an existing candidate** → candidate untouched, new application row.
- **Negotiation withdrawn / deleted on hh.uz** → application `applicationState = withdrawn`;
  candidate, AI analysis, notes, and history all retained.
- **Candidate hired in vacancy A, still applying to B** → independent `stage` per
  application; no cross-talk.
- **Vacancy deleted locally** → `onDelete: cascade` removes its applications; candidates remain.
- **Candidate deleted locally** → cascade removes their applications.
- **Company disconnects hh.uz** → stored data is kept; syncs stop. On reconnect (even a
  different hh account), resume ids are global on hh.uz, so dedup still holds.

## 9. Testing

- **Unit:** `toHhVacancyApplicant` id-resolution (resume vs negotiation vs anonymous);
  hh `employer_state` → internal stage mapping; ownership matrix (sync must not touch
  recruiter fields).
- **Discovery:** watermark early-termination (stops once a page is fully below the
  watermark); first-sync backfill with no watermark; overlap-window re-processing is a
  no-op; watermark advances only after a vacancy completes.
- **Queue:** new stub enqueues exactly one job; `onConflictDoNothing` blocks duplicates;
  `SKIP LOCKED` gives concurrent workers disjoint batches; failure → backoff → retry →
  `failed` after N attempts; stale-lock reaper requeues abandoned `processing` jobs.
- **Integration (mocked hh.uz):** new candidate inserts + activity log; existing candidate
  no-ops; new negotiation for existing candidate; partial vacancy failure; idempotency
  (run discovery twice → identical state, identical watermark).
- **Migration:** backfill query on a snapshot of legacy `hh_<id>` rows.
- Extend the existing `format-linkedin-vacancy.test.ts`-style colocated test pattern.

## 10. Implementation phases

1. **Schema + migration** — `candidates`/`candidateVacancies` columns, `hhVacancySyncState`,
   `hhEnrichmentJobs`, indexes, `bun run db:generate`, backfill SQL.
2. **Layer 1 discovery** — `discover-candidates.ts`: watermark cursor poll,
   early-terminate, stub upsert, job enqueue, advisory lock.
3. **`candidates.syncHh` mutation + manual Sync button.**
4. **Layer 2 enrichment** — `enrich-worker.ts`: `SKIP LOCKED` claim, resume + AI,
   backoff/retry; cron route + stale-lock reaper.
5. **Rewrite reads** — `listHh` and `vacancies.funnel` read from DB; remove live fan-out.
6. **Cleanup** — replace `id.startsWith("hh_")` branches with `source`-based checks.
7. **(Later)** per-company discovery cron; periodic full reconciliation pass (withdrawals
   + `hhStage` refresh); duplicate-by-contact detection.

## 11. Out of scope

- **Downloading or storing hh.uz resume PDFs.** Only the structured resume data the
  hh.uz API exposes is persisted; recruiters open the original via `hhResumeUrl`. The
  `resumeFileId` file-storage flow remains exclusive to manually uploaded resumes.
- LinkedIn / Telegram candidate ingestion (same pattern can be applied later).
- Cross-resume person merging beyond a manual recruiter action.
- Real-time webhooks from hh.uz (polling sync only for now).
