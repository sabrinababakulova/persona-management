# Persona Management Project Review

Generated: 2026-05-05 · Revised: 2026-05-26

> **2026-05-22 update.** An hh.uz **candidate sync engine** has been added — see the
> new "hh.uz Candidate Sync" section below. It resolves several items previously
> listed under Open Questions: hh.uz applicants are now persisted and deduped
> (29–31, 35), candidate stage is per-application (`vacancy_candidate.stage`),
> hh.uz status is reconciled back into the app, sync covers **all** of a company's
> connected employers (22), and external fetches run in a background queue (62).
>
> **2026-05-26 update.** Four follow-on changes worth flagging:
> 1. **Archived hh.uz vacancies are now persisted as stubs.** Discovery iterates
>    active *and* archived vacancies, writes a stub row (id, title,
>    `status="archive"`) for archived ones, and reconciles `status` on every run.
>    `vacancies.list` reads archived rows from the local DB and never asks hh.uz
>    for them. Applicants are still *not* synced for archived vacancies; existing
>    candidate links are preserved when a vacancy flips to archived. From the
>    detail page, a recruiter can unarchive via the hh.uz `/vacancies/{id}/prolongate`
>    endpoint; on success the local row is hydrated from `fetchHhVacancyDetail`.
> 2. **Cross-collection bug in `iterateHhVacancyNegotiationPages` fixed.** hh.uz
>    partitions a vacancy's negotiations into multiple collections (response /
>    discard / custom states / generated_collections). The "stop paging once
>    a page is older than the watermark" cursor used to break across collections,
>    so a candidate declined on hh.uz (moved from `response` → `discard`) never
>    got reconciled. The cursor now lives inside the generator and applies per
>    collection. Status sync is also driven from the local `vacancies` table (no
>    longer filtered to active-only) so archived backlog reconciliations work.
> 3. **Candidate ↔ vacancy match scoring** (`candidates.matchScore` / new
>    `vacancy_candidate.matchScore`) is computed by a new Mastra agent
>    (`candidateVacancyMatch`, gemini-2.5-flash, structured output via
>    `candidateVacancyMatchSchema`). The agent runs alongside AI analysis inside
>    the enrichment worker, per non-archived application. Funnel reads the
>    per-application score; candidate detail reads the denormalised max. Closes
>    open question 67 (new — see below).
> 4. **Sidebar "Настройки"** now points at `/my-profile?section=company-settings`
>    instead of a non-existent `/settings` route; the active-state matcher
>    strips the query string before comparing.

## Scope

This review was made from the current codebase plus `AGENTS.md`. `AGENTS.md` is a useful baseline, but the application has moved beyond it in several places:

- `src/env.js` now includes Google OAuth and hh.uz OAuth variables.
- The schema now includes `vacancy_publication`, `company_telegram_channel`, and `company_hh_account`.
- The app has Directus asset proxy routes, avatar upload, forgot-password flow, hh.uz OAuth connect/callback routes, hh.uz vacancy preview, and a vacancy funnel route.
- Vacancy creation/editing currently centers around hh.uz-required fields, not only the older local vacancy fields listed in `AGENTS.md`.
- The vacancy publication flow has been split across two routes (general fields in `/vacancies/create`, hh.uz fields in `/vacancies/[id]/publications/hh.uz`) and is backed by a single Zustand store with `localStorage` persistence (`src/stores/vacancy-publication-store.ts`).

## Application Shape

The app is a Russian-language ATS built with Next.js App Router, tRPC, NextAuth, Drizzle, PostgreSQL, Directus storage, Telegram, hh.uz, and Gemini/Mastra for resume analysis. Client-side state for the multi-step vacancy publication flow is held in a Zustand store (`src/stores/vacancy-publication-store.ts`) with `localStorage` persistence; server state continues to flow through tRPC + TanStack Query.

The main protected routes are:

- `/dashboard` - company-scoped dashboard metrics, recent vacancies, recent activity.
- `/candidates` - local candidates plus optional hh.uz applicant listing.
- `/candidates/create` - candidate creation with PDF resume upload and AI prefill.
- `/candidates/[id]` - candidate profile, including imported hh.uz candidate support for IDs prefixed with `hh_`.
- `/vacancies` - local vacancies plus optional hh.uz vacancy listing.
- `/vacancies/create` - multi-step vacancy creation and optional publication.
- `/vacancies/[id]` - vacancy edit/detail view, using the create form in edit mode plus hh.uz preview where available.
- `/my-profile` - profile, password change, company settings, Telegram channels, hh.uz account.

Public or auth-adjacent routes include login, register with email verification, forgot password, NextAuth routes, tRPC, resume download/upload, Directus asset proxy, generic upload, Mastra chat, and hh.uz OAuth connect/callback.

## Data Model

Core database tables:

- `user`, `account`, `session`, `verification_token` - NextAuth plus email verification, password reset, and rate-limit markers.
- `company` - company profile. Most users are assigned to `DEFAULT_COMPANY_ID` unless otherwise set.
- `candidate` - candidate profile, contacts, skills, languages, work experience, education, notes, activities, resume metadata, AI analysis, company scope.
- `vacancy` - local vacancy profile, local status, salary, description fields, company scope, optional `hhVacancyId`.
- `vacancy_candidate` - a candidate's **application** to a vacancy. No longer a bare join: it carries per-application state — `hhNegotiationId`, `stage` (recruiter-owned funnel stage), `hhStage` (raw hh.uz state), `applicationState`, `matchScore` (0–100, written by the candidate ↔ vacancy match agent), `appliedAt`, timestamps — with a partial unique index on `(vacancyId, hhNegotiationId)`.
- `vacancy_publication` - publication metadata and `sources` JSON array with platform/url pairs.
- `company_telegram_channel` - configured Telegram channels per company.
- `company_hh_account` - hh.uz OAuth tokens and employer metadata per user. The table name is historical; the FK is now `userId` (references `user.id`) with a unique constraint on `userId`, so each user has at most one connected hh.uz account.
- `hh_vacancy_sync_state` - per-vacancy sync cursors: `lastNegotiationAt` (discovery watermark) and `lastStatusNegotiationAt` (status-sync watermark), plus run timestamps/errors.
- `hh_enrichment_job` - the enrichment queue (one row per candidate, drained with `FOR UPDATE SKIP LOCKED`).
- Lookup tables - candidate and vacancy dropdown data.
- `recent_activity_log` - append-only activity feed used by dashboard and candidate detail.

The `candidate` table gained hh.uz sync columns (`hhResumeId`, `hhResumeUrl`, `hhResumeFetchedAt`, `hhSyncedAt`, `profileLocked`) with a partial unique index on `(companyId, hhResumeId)`; `user` gained `candidatesSeenAt` / `vacanciesSeenAt` for the sidebar "new" badges.

Important modeling observation: several product concepts are split or incomplete. A local vacancy has its own fields, hh.uz has its own required lookup IDs, and `vacancy_publication` has source URLs but does not store platform-specific message IDs, external IDs, payload versions, sync state, or errors.

## Server API

tRPC routers are registered in `src/server/api/root.ts`:

- `dashboard`
- `vacancies`
- `candidates` (incl. `syncHh`, `hhSyncStatus`)
- `lookups`
- `profile`
- `integrations`
- `storage`
- `sidebar` (`counts`, `markSeen` — new candidate/vacancy badge counts)

The protected procedure middleware requires an authenticated session. Most data access then resolves the current user's `companyId`.

### Auth and Account Flow

Credentials registration:

1. User submits name, email, password.
2. Password is bcrypt-hashed.
3. Unverified user is created in the default company.
4. A 6-digit HMAC-protected code is stored in `verification_token`.
5. Code is emailed through Yandex SMTP.
6. Verification sets `emailVerified`, clears verification records, and signs the user in.

Login:

- Rate-limited by email and IP.
- Supports existing argon2 hashes and current bcrypt hashes.
- Rejects unverified accounts.
- Ensures OAuth/default company metadata after login.

Google OAuth:

- Enabled if `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` exist.
- Dangerous email account linking is enabled.
- Google-verified e-mail addresses are marked verified.
- New Google users remain without a company until `/onboarding/company`, where
  they create a company or return through an invitation link to join one.

Password reset:

- Public tRPC request/reset procedures.
- Uses the same `verification_token` table for flow IDs, codes, cooldowns, and rate limits.

Session invalidation:

- JWT callback checks `passwordChangedAt`; if the password changed after token issue, the session user is cleared.

### Candidate Flow

Candidate list:

- Local candidates are fetched from Postgres, company-scoped, filtered by period/search/status/city/source, and paginated.
- hh.uz candidates are fetched separately through hh.uz applicant APIs, scoped to the current user's connected hh.uz account (per-user, no longer gated on `DEFAULT_COMPANY_ID`).
- Imported hh.uz candidates are excluded from the external list by ID.

Candidate creation:

- Client form validates via `candidateFormSchema`.
- Server validates lookups, inserts the candidate, and writes recent activity.
- Resume upload can happen before final create using a client-generated UUID as candidate ID.

Resume upload:

- tRPC upload accepts base64 PDF and runs AI prefill + AI analysis.
- API route upload accepts multipart PDF.
- Both validate extension, MIME, PDF header, EOF marker, and 10MB max size.
- Files are stored in Directus; only metadata is stored in Postgres.

hh.uz candidate detail:

- IDs prefixed with `hh_` are fetched from hh.uz resume API.
- The fetched resume is upserted into local `candidate`.
- AI analysis is generated if no stored analysis exists.

Candidate detail:

- Shows summary, background, notes, activities, communication placeholder.
- Notes can be added.
- Edit/delete buttons for notes are visible but not wired to mutations.

### Vacancy Flow

Vacancy list:

- Local vacancies are fetched from Postgres and response counts are derived from `vacancy_candidate`.
- hh.uz vacancies are fetched through hh.uz employer vacancy APIs, scoped to the current user's connected hh.uz account.
- Local rows with `hhVacancyId` are used to dedupe hh.uz list results.

Vacancy create:

1. User fills general vacancy fields in `/vacancies/create`: title, salary range, currency, contact phone. (hh.uz-specific fields — area, professional role, employment, schedule, experience, billing type, HTML description — moved to the per-channel editor below.)
2. Drafts persist via the Zustand publication store. `general`, `hh`, `selectedChannels`, and `savedVacancyId` are written through `partialize` to `localStorage` under the key `vacancy-publication-store`; `pendingChannelLaunch` is in-memory only because it is an in-flight nav flag.
3. Publications step shows a "Создать публикацию" dropdown (LinkedIn / hh.uz / Telegram). Selecting a channel writes to `store.selectedChannels`, sets `store.pendingChannelLaunch`, fires `vacancies.create` to persist a draft vacancy, then routes to `/vacancies/<id>/publications/<channel>`. If the vacancy already has saved `vacancy_publication` rows, the same step renders a "Версии публикаций" table instead.
4. hh.uz field collection now lives on `/vacancies/[id]/publications/hh.uz` (`HhPublicationForm`). It hydrates the store's `hh` slice from `vacancies.get` and saves via `vacancies.update`.
5. Preview step creates only a local draft vacancy with the title.
6. If selected and configured, the legacy publish modal on the preview step still allows sending to Telegram and/or publishing to hh.uz.

Important implementation detail: local `vacancy` creation only stores `title` and `status: "draft"` from the create flow. hh.uz-specific values are persisted via the per-channel editor's `vacancies.update` call (and via the legacy `publishHh` path); they are no longer held only in transient client state.

Vacancy edit:

- `/vacancies/[id]` reuses `CreateVacancyForm` in edit mode.
- Initial data maps `title -> name`, `salaryExpectation -> salaryFrom`, `salaryCurrency`, and `tasks -> descriptionHtml`.
- Edit mode validates only name, because local vacancies do not store hh.uz area/role/employment/schedule/experience/billing IDs.
- Save sends only title, salary, currency, and tasks to `vacancies.update`.

Local vacancy update:

- Updates local fields and writes activity.

External hh.uz vacancy update:

- Only runs when the submitted vacancy ID starts with `hh_`.
- Can update hh.uz name, description, salary-from/currency, and archive/prolong status.
- Does not run for a local vacancy that has `hhVacancyId` set.

Assignments:

- Search candidates for a local vacancy.
- Assign candidate to vacancy.
- Candidate status is updated globally, not per vacancy assignment.

### Publications

`vacancy_publication` supports create/update/delete/list/get and stores:

- vacancy ID
- name
- description
- active flag
- `sources`: array of `{ platform, url }`

hh.uz publish:

- Requires a connected hh.uz account.
- Sends a new POST to hh.uz with the form fields.
- Saves `hhVacancyId` on the local vacancy.
- Upserts a `vacancy_publication` source with platform `hh.uz` and URL.

Telegram publish:

- Requires global `TELEGRAM_BOT_TOKEN` and at least one company channel.
- Builds a deterministic keyword from vacancy ID + company ID.
- Sends the formatted message to all configured channels.
- Returns success count, keyword, and partial errors.
- Does not store Telegram message IDs or source rows.

### Integrations

Telegram:

- Channels are configured per company in profile/company settings.
- Bot token is global env configuration.
- Posting uses `sendMessage` only.

hh.uz:

- OAuth connect route builds a signed state with the user ID.
- Callback exchanges code, resolves employer, and upserts account tokens keyed by `userId`.
- Account metadata can also be manually saved through the integrations router.
- Token refresh is attempted mainly when access token is missing or employer resolution fails.
- hh.uz accounts are per-user: two users in the same company connect independently.

### Dashboard

The dashboard reads only local database data:

- New responses = count of candidates with status `new`.
- Active vacancies = local vacancies with status `active`.
- Active candidates = total local candidates.
- Hired = local candidates with status `hired`.
- Recent vacancies = recent local active vacancies.
- Channel stats = local candidate source counts.
- Status stats = local candidates created in the last week.
- Recent activity = rows from `recent_activity_log`.

hh.uz vacancies/applicants and Telegram publications are not directly included unless imported or represented as local records.

## Integration Lifecycles Found

### Telegram Vacancy Posting

Current lifecycle:

1. User configures one or more company Telegram channels.
2. User creates a local vacancy.
3. User clicks Telegram publish.
4. The app sends a formatted message to every configured channel.
5. The app displays sent/error state in the current modal only.

Missing from lifecycle:

- No message ID storage.
- No per-channel publication record.
- No update/edit/delete/repost workflow.
- No applicant ingestion from Telegram replies.
- No way to map Telegram conversations back into candidates except manual user work.

### hh.uz Vacancy Publishing

Current lifecycle:

1. User connects hh.uz OAuth account.
2. User creates a local vacancy.
3. User fills hh.uz-required fields in the create form.
4. User publishes to hh.uz.
5. The app saves the returned hh.uz vacancy ID and URL.
6. The app can preview hh.uz details.

Missing or partial:

- The local database does not store the hh.uz lookup IDs used for the publish.
- Re-publishing a linked vacancy may create another external vacancy instead of updating the existing one.
- Editing a local vacancy linked to hh.uz does not sync to hh.uz because update sync only runs for IDs shaped like `hh_<id>`.
- External hh.uz update only supports a subset of fields.
- Token refresh/retry on 401 is not consistently modeled.

### hh.uz Applicants

Replaced by the **hh.uz Candidate Sync** engine (see the dedicated section below).
hh.uz applicants are now persisted into `candidate` / `vacancy_candidate` rather than
fetched live; the funnel reads them from the DB. The previous gaps are addressed:
applicants are stored and deduped, profiles re-enrich on a TTL, and candidate status
is reconciled from hh.uz on a schedule.

Still partial:
- The dashboard still counts only local data and is not yet sync-aware.
- The funnel groups by the per-candidate `candidates.status`; the per-application
  `vacancy_candidate.stage` exists but the funnel UI is not yet wired to it, so a
  candidate applying to several vacancies shows one shared status.

## hh.uz Candidate Sync (added 2026-05-22)

A three-layer sync persists hh.uz applicants into the database. All layers live in
`src/server/services/hh/`; the design doc is `docs/hh-candidate-sync-plan.md`.

**Layer 1 — Discovery** (`discover-candidates.ts`). For each company it resolves
**every** connected hh.uz employer account (`resolveCompanyHhAccounts`), lists
**every** vacancy (active *and* archived, as of 2026-05-26), creates a local base
vacancy row for any that is missing, and reconciles the `status` column on rows
that already exist so an archive flip propagates locally. Active vacancies then
poll negotiations newest-first by `created_at`; archived vacancies stop after the
row write — applicants are intentionally *not* stored for them. A per-vacancy
watermark (`hh_vacancy_sync_state.lastNegotiationAt`) makes a no-new-applicants
run cost ~one page per vacancy. Each new candidate is upserted as a **stub** plus
an application row, and an enrichment job is enqueued. Guarded by a per-company
advisory lock.

**Layer 2 — Enrichment** (`enrich-worker.ts`). Drains `hh_enrichment_job` with
`FOR UPDATE SKIP LOCKED`. Each job fetches the structured hh.uz resume (no PDF
download), trying each connected employer's token until one can read it, fills the
candidate profile, and runs both the AI analysis agent and the candidate ↔ vacancy
match agent once (2026-05-26: see "AI Match Scoring" below). Exponential
backoff/retry; a reaper re-queues jobs abandoned by a crashed worker.

**Layer 3 — Status reconciliation** (`sync-statuses.ts`). Driven by the local
`vacancies` table (every row with `hhVacancyId`, active **or** archived — fixed
2026-05-26 so backlog reconciliations on archived vacancies still work). Tries
each connected employer's token until one has access (skipping `403` / masked
`404`), then re-walks negotiations ordered by `updated_at` — incremental via the
`lastStatusNegotiationAt` watermark — maps the hh.uz state to a platform status
(`mapHhStateToStatus`), and overwrites `vacancy_candidate.stage` and
`candidates.status`. **hh.uz is the source of truth for status**, so a rejection
on hh.uz surfaces in the platform within minutes.

**Negotiations pager** (`negotiations.ts`, fixed 2026-05-26). hh.uz partitions a
vacancy's negotiations into multiple collections (`response`, `discard`, custom
employer states, plus `generated_collections`). A status change moves a
negotiation between collections AND bumps `updated_at`. The "stop paging when a
page falls below the watermark" cursor previously lived in the consumer and
broke iteration across **all** collections — so a candidate moved from
`response` → `discard` was never observed. The cursor now lives inside
`iterateHhVacancyNegotiationPages` as a `since: Date | null` argument and stops
paging only within the current collection, then continues to the next.

**Dedup.** A candidate/vacancy is stored once and AI-analysed once, guaranteed by
the partial unique indexes (`candidate(companyId,hhResumeId)`,
`vacancy_candidate(vacancyId,hhNegotiationId)`), enqueue-on-insert-only, and the
`hh_enrichment_job.candidateId` unique constraint. Legacy `hh_<resumeId>` candidate
rows are adopted by discovery rather than duplicated.

**Triggers.** Discovery runs on hh.uz connect/reconnect (the OAuth callback adds
`?hh_connected=1`, and `company-settings-section.tsx` runs `candidates.syncHh`
behind `DataMigrationLoadingScreen`). Ongoing sync is driven by three cron routes,
each bearer-authorized with `AUTH_SECRET` and hit by `scripts/hh-*-cron.sh`:
`/api/cron/hh-enrich` (≈1 min), `/api/cron/hh-discover` (≈20 min),
`/api/cron/hh-status` (≈5 min).

**Known limitations.** Discovery's first run per vacancy is a full backfill. The
funnel still groups by `candidates.status`, so the per-application `stage` is not
fully surfaced for multi-vacancy candidates. hh.uz state → platform status mapping
is keyword-based; an unmapped custom funnel stage leaves the status untouched.

## AI Match Scoring (added 2026-05-26)

A fourth Mastra agent — `candidateVacancyMatch` (gemini-2.5-flash) — scores how
well a candidate fits a specific vacancy on a 0–100 scale. The instructions
encode the rubric used by Workable / Greenhouse / Jobvite-style ATS engines:
skills + stack (~30%), role + industry similarity (~20%), experience (~20%),
languages (~10%), location/format (~10%), education (~5%), salary alignment
(~5%). The agent returns structured JSON validated by
`candidateVacancyMatchSchema` (`{ score: 0-100, reasoning: ≤400 chars }`); the
score is clamped server-side before write so a misbehaving model can't poison
the column.

Match scoring is invoked from the hh.uz enrichment worker (`enrich-worker.ts`)
**alongside** the AI analysis — same job, same parsed hh.uz resume, same
`recordAiUsage` plumbing. After AI analysis writes `candidates.aiAnalysis`,
`computeMatchScores` joins `vacancy_candidate → vacancies` for the candidate,
filters out `status = 'archive'` (no tokens spent on retired stubs), and runs
the match agent per surviving pair. Each score is written to the new
`vacancy_candidate.matchScore` column; the maximum across active applications is
mirrored onto `candidates.matchScore` as a denormalised "best fit" so the
candidate-detail card (which has no vacancy context) has a sensible default. The
vacancy funnel (`getVacanciesRelatedCandidates`) reads the per-application
column with a coalesce fallback to the candidate global score for rows that
predate enrichment.

## Archived hh.uz Vacancy Stubs (added 2026-05-26)

Discovery now persists every hh.uz vacancy the employer has ever had. Active
rows are fully synced; archived rows are stored as **stubs** carrying only the
hh.uz id, the title, and `status = 'archive'`. The `vacancies.list` procedure
reads archived rows from the local DB and never asks hh.uz for them — both the
fast and slow paths pass `includeArchived: false` to `fetchCompanyHhVacancies` /
`fetchCompanyHhVacanciesPage`, and the linked-count math uses a separate
"active-linked" set so archived stubs don't double-count against `hhPage.total`.

The vacancy detail page (`/vacancies/[id]`) detects archived hh-linked rows via
`status === "archive" && hhVacancyId !== null` and renders the existing
read-only banner. Inside the banner is a small status selector
(Архив → Активна); selecting "Активна" calls `vacancies.update` with a
status-only payload, which the mutation routes to `prolongHhVacancy`
(`POST /vacancies/{id}/prolongate`). On 403 the mutation maps hh.uz
`errors[].value` to friendly Russian messages — `unavailable_for_archived`,
`not_enough_purchased_services`, `quota_exceeded`, `prolongation_forbidden`,
`too_early`, `not_premoderated`. `HhApiError` now exposes `errorValues` (in
addition to `errorTypes`) so any future caller can pattern-match on the
discriminator. On success the local row is hydrated from `fetchHhVacancyDetail`
(title, description, area, employment, salary, contacts, etc.) so the stub
becomes a real editable vacancy immediately.

Mutations refuse any other write to an archived hh-linked row — the only
allowed change is the status-only unarchive — so a stale form submit from an
archived row can't diverge from the upstream archive.

## Open Product and Architecture Questions

### Publication lifecycle

1. When a vacancy already published to Telegram is edited, should the Telegram post be edited, deleted and reposted, or left unchanged?
2. To support Telegram edits, where should `chat_id` and `message_id` be stored: in `vacancy_publication.sources`, a dedicated `telegram_publication` table, or another audit table?
3. If a vacancy is posted to multiple Telegram channels and one channel fails, should users be able to retry only failed channels?
4. Should Telegram posts be marked inactive/deleted when the vacancy is archived, paused, or closed?
5. Should the Telegram keyword remain deterministic forever, or should each publication version have its own keyword?
6. How should applicants who reply with the Telegram keyword become candidates: webhook, polling, manual import, or a separate Telegram bot conversation flow?
7. What should happen when a Telegram channel is removed after vacancies were posted there?
8. Should Telegram publication history be visible on the vacancy detail page?
9. Should Telegram messages include a public application link instead of asking applicants to paste a keyword?
10. Should the app store the exact message body sent to each channel for audit and future comparison?

### hh.uz publication and synchronization

11. When a local vacancy with `hhVacancyId` is edited, should `vacancies.update` update hh.uz automatically?
12. If automatic hh.uz sync is not desired, should the UI show a "Sync to hh.uz" action and a dirty-state warning?
13. What should happen when a user publishes to hh.uz twice from the same vacancy: update existing, create a new publication version, or block duplicates?
14. Where should hh.uz field IDs be stored locally: area, employment, schedule, experience, professional role, billing type, salary range, contact phone?
15. Should the local vacancy detail page display and edit all hh.uz fields, or should hh.uz data remain read-only after publication?
16. Which hh.uz fields must be synced on edit besides name/description/salary: area, role, employment, schedule, experience, billing type, contacts, key skills?
17. How should the app handle hh.uz API validation errors: raw API message, mapped Russian field errors, or both?
18. Should archiving/closing a local vacancy archive the hh.uz vacancy automatically?
19. Should prolonging/reactivating an hh.uz vacancy be a separate user action with billing confirmation? **(2026-05-26: the vacancy detail page now offers an explicit status selector on archived hh-linked rows that calls `/vacancies/{id}/prolongate`. Billing/quota errors come back as mapped Russian messages — `not_enough_purchased_services`, `quota_exceeded`, etc. — but no billing-confirmation modal is shown before the call.)**
20. What should happen if hh.uz token refresh fails: disconnect account, show banner, retry later, or block publication only?
21. hh.uz accounts are now per-user (the `company_hh_account` table is keyed on `userId`, despite its legacy name). Should the table be renamed to `user_hh_account` to match?
22. If two users in the same company both connect hh.uz, whose account should drive company-level dashboards, vacancy lists, and applicant counts? **(2026-05-22: the candidate sync now ingests every connected employer in the company; dashboards/vacancy lists are still local-only.)**
23. Should hh.uz applicants count as vacancy responses before they are imported into local candidates?

### Publication records

24. Is `vacancy_publication` intended to be a draft/publication object, a publish history, or the canonical vacancy content?
25. Should `vacancy_publication.sources` store only URLs, or also external IDs, channel IDs, message IDs, status, last error, and payload hash?
26. Should updating a `vacancy_publication` trigger external platform sync, or is it only local metadata?
27. Should deleting a `vacancy_publication` delete/disable external platform posts?
28. Should there be multiple active publications per vacancy, or exactly one current publication?

### Candidate pipeline

29. Candidate status is stored globally on `candidate`. What happens when one candidate is in different stages for two different vacancies? **(2026-05-22: `vacancy_candidate.stage` now holds per-application stage; the funnel UI still reads the global `candidates.status`, so wiring it to `stage` is the remaining step.)**
30. Should `vacancy_candidate` have its own stage/status, assigned date, source, notes, and rejection reason? **(2026-05-22: added `stage`, `hhStage`, `applicationState`, `appliedAt`, and timestamps. Notes/rejection reason still absent.)**
31. Should `vacancy_candidate` have a database unique constraint on `(vacancyId, candidateId)` to prevent race-condition duplicates? **(2026-05-22: a partial unique index on `(vacancyId, hhNegotiationId)` was added for synced applications; manual non-hh links are still unconstrained.)**
32. How does a user unassign a candidate from a vacancy?
33. How does a user move a candidate through a vacancy funnel without changing their global candidate status?
34. Should assigning a candidate write recent activity?
35. Should imported hh.uz candidates preserve the source vacancy or negotiation collection where they came from?

### Candidate profile and communication

36. Candidate detail shows edit/delete buttons for notes, but there are no edit/delete mutations. Should notes be editable and auditable?
37. Candidate detail has a communication placeholder. What channels should it support: email, Telegram, phone calls, hh.uz messages?
38. Should communication history be a first-class table instead of JSON on `candidate`?
39. Should candidate profile editing cover contacts, salary, skills, languages, work experience, education, tags, and resume metadata?
40. What is the expected lifecycle for deleting a candidate and their Directus resume file?

### Resume and AI

41. Should AI resume analysis be rerunnable manually?
42. Should the app store model name, prompt version, analysis timestamp, confidence, and failure reason?
43. What happens when AI extraction conflicts with existing manually-entered candidate data?
44. Should users be able to review and selectively apply AI-prefilled fields instead of automatic merge?
45. Should non-PDF resumes be supported later, or is PDF-only a product requirement?
46. Directus resume replacement deletes the existing file before uploading the new one. Should upload be transactional so a failed new upload does not remove the old file?
67. Match scoring runs only from the hh.uz enrichment worker — manual candidate creation and ad-hoc candidate-to-vacancy assignments do not currently invoke the match agent. Should the score also be (re)computed on manual assignment, on vacancy edit (since the requirements changed), or expose a "Rescore" button? **(2026-05-26: deferred — the `candidate_vacancy_match` operation is wired through `recordAiUsage` so the call site can be extended without touching observability.)**

### Files and security

47. `/api/directus/assets/[fileId]` proxies any path-safe Directus file ID without checking the current user or company. Is every proxied asset intended to be publicly accessible?
48. Avatar upload accepts any file type and size. What file constraints should avatars enforce?
49. Should resume downloads always go through the protected candidate resume route instead of generic Directus asset URLs?
50. Should uploaded avatars and resumes be scanned or validated beyond extension/MIME/PDF markers?

### Multi-tenancy and permissions

51. Most account flows assign users to `DEFAULT_COMPANY_ID`. How are real companies created and how are users invited into them?
52. Are there roles such as owner, admin, recruiter, hiring manager, or viewer?
53. Who is allowed to manage Telegram channels and hh.uz accounts?
54. Should one user ever belong to multiple companies?
55. Should OAuth login auto-link by email, given `allowDangerousEmailAccountLinking: true`?

### Dashboard and analytics

56. Dashboard "Новые отклики" currently counts local candidates with status `new`. Should it count actual applications/responses from vacancy channels instead?
57. Should dashboard metrics include hh.uz vacancies and unimported hh.uz applicants?
58. Should dashboard source statistics count vacancy publication channels, candidate sources, or actual application events?
59. Should the default period filter hide older vacancies/candidates unless search is used?
60. Which events should write `recent_activity_log`: publish, external sync, assignment, note edit/delete, resume upload, AI analysis, integration connect/disconnect?

### Operational questions

61. What is the expected failure handling for partial external publication: local vacancy created, hh.uz failed, Telegram succeeded?
62. Should external API calls be queued/backgrounded instead of running directly inside tRPC mutations? **(2026-05-22: hh.uz candidate enrichment now runs through the `hh_enrichment_job` queue drained by a cron worker; publish/Telegram calls still run inline.)**
63. Should there be idempotency keys for publish actions to avoid duplicate Telegram/hh.uz posts from double clicks or retries?
64. How should the app observe and alert on failed Telegram/hh.uz/Directus/mail/API calls?
65. Should `bun run check` be required to pass before deploy, and who owns existing Biome failures?

## Technical Issues Observed While Reviewing

- `README.md` is still mostly the default T3 template and is less accurate than `AGENTS.md`.
- Full `bun run check` has known existing failures unrelated to this document: a raw `<img>` in `hh-vacancy-preview.tsx`, an unused parameter in `src/server/services/hh/shared.ts`, and Drizzle metadata formatting.
- `src/server/services/hh/shared.ts` still has a TODO about hh.uz applicant status in the legacy `toHhVacancyApplicant` (live-applicant path). The candidate sync handles real status properly — `toHhNegotiation` reads `employer_state`/`funnel_stage` and `sync-statuses.ts` reconciles it.
- `vacancy_publication` procedures exist but the create flow mainly uses direct Telegram/hh publish mutations; the product boundary between "publication draft" and "external publish result" is not fully defined.
- hh.uz support is a mix of live external records (`hh_` IDs) and local records linked by `hhVacancyId`; update logic differs between those paths.

## Suggested Next Decisions

The highest-leverage decisions are:

1. Define a platform publication model that stores per-platform external IDs, message IDs, status, errors, and last-published payload.
2. Decide whether local vacancy edits automatically sync to external platforms or require explicit user action.
3. Move candidate stage/status from global candidate state into the vacancy-candidate assignment.
4. Clarify multi-company onboarding and permissions.
5. Decide how Telegram applicants enter the ATS.
6. Make hh.uz availability company-scoped instead of default-company-scoped, if multi-tenancy is real.
