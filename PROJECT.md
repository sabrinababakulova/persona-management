# Persona Management Project Review

Generated: 2026-05-05

## Scope

This review was made from the current codebase plus `AGENTS.md`. `AGENTS.md` is a useful baseline, but the application has moved beyond it in several places:

- `src/env.js` now includes Google OAuth and hh.uz OAuth variables.
- The schema now includes `vacancy_publication`, `company_telegram_channel`, and `company_hh_account`.
- The app has Directus asset proxy routes, avatar upload, forgot-password flow, hh.uz OAuth connect/callback routes, hh.uz vacancy preview, and a vacancy funnel route.
- Vacancy creation/editing currently centers around hh.uz-required fields, not only the older local vacancy fields listed in `AGENTS.md`.

## Application Shape

The app is a Russian-language ATS built with Next.js App Router, tRPC, NextAuth, Drizzle, PostgreSQL, Directus storage, Telegram, hh.uz, and Gemini/Mastra for resume analysis.

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
- `vacancy_candidate` - many-to-many assignment between local vacancies and candidates.
- `vacancy_publication` - publication metadata and `sources` JSON array with platform/url pairs.
- `company_telegram_channel` - configured Telegram channels per company.
- `company_hh_account` - hh.uz OAuth tokens and employer metadata per company.
- Lookup tables - candidate and vacancy dropdown data.
- `recent_activity_log` - append-only activity feed used by dashboard and candidate detail.

Important modeling observation: several product concepts are split or incomplete. A local vacancy has its own fields, hh.uz has its own required lookup IDs, and `vacancy_publication` has source URLs but does not store platform-specific message IDs, external IDs, payload versions, sync state, or errors.

## Server API

tRPC routers are registered in `src/server/api/root.ts`:

- `dashboard`
- `vacancies`
- `candidates`
- `lookups`
- `profile`
- `integrations`

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
- OAuth users are assigned to the default company and marked verified.

Password reset:

- Public tRPC request/reset procedures.
- Uses the same `verification_token` table for flow IDs, codes, cooldowns, and rate limits.

Session invalidation:

- JWT callback checks `passwordChangedAt`; if the password changed after token issue, the session user is cleared.

### Candidate Flow

Candidate list:

- Local candidates are fetched from Postgres, company-scoped, filtered by period/search/status/city/source, and paginated.
- hh.uz candidates are fetched separately through hh.uz applicant APIs, but only for `DEFAULT_COMPANY_ID` and only when hh.uz is configured.
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
- hh.uz vacancies are fetched through hh.uz employer vacancy APIs, but only for `DEFAULT_COMPANY_ID`.
- Local rows with `hhVacancyId` are used to dedupe hh.uz list results.

Vacancy create:

1. User fills hh.uz-style vacancy fields: title, area, professional role, employment, schedule, experience, billing type, salary, phone, HTML description.
2. Drafts persist in localStorage.
3. Publications step captures publication name/description and selected channels.
4. Preview step creates only a local draft vacancy with the title.
5. If selected and configured, a modal allows sending to Telegram and/or publishing to hh.uz.

Important implementation detail: local `vacancy` creation only stores `title` and `status: "draft"` from the create flow. The hh.uz-specific fields are held in client state and passed directly to `publishHh`; most are not persisted to the local vacancy table.

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

- OAuth connect route builds a signed state with user ID and company ID.
- Callback exchanges code, resolves employer, and upserts account tokens.
- Account metadata can also be manually saved through the integrations router.
- Token refresh is attempted mainly when access token is missing or employer resolution fails.

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

Current lifecycle:

1. App lists hh.uz vacancy applicants.
2. Opening a `hh_` candidate fetches the resume from hh.uz.
3. The app upserts that candidate into local Postgres.
4. Imported hh candidates no longer appear in the external list.

Missing or partial:

- No explicit import/reject workflow.
- No reconciliation if the hh.uz resume changes later.
- Candidate status from hh.uz collections is noted as TODO in code.
- Dashboard does not count unimported hh.uz applicants.

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
19. Should prolonging/reactivating an hh.uz vacancy be a separate user action with billing confirmation?
20. What should happen if hh.uz token refresh fails: disconnect account, show banner, retry later, or block publication only?
21. Why are hh.uz lists limited to `DEFAULT_COMPANY_ID` when `company_hh_account` is per company?
22. Should all companies be allowed to connect and use their own hh.uz account?
23. Should hh.uz applicants count as vacancy responses before they are imported into local candidates?

### Publication records

24. Is `vacancy_publication` intended to be a draft/publication object, a publish history, or the canonical vacancy content?
25. Should `vacancy_publication.sources` store only URLs, or also external IDs, channel IDs, message IDs, status, last error, and payload hash?
26. Should updating a `vacancy_publication` trigger external platform sync, or is it only local metadata?
27. Should deleting a `vacancy_publication` delete/disable external platform posts?
28. Should there be multiple active publications per vacancy, or exactly one current publication?

### Candidate pipeline

29. Candidate status is stored globally on `candidate`. What happens when one candidate is in different stages for two different vacancies?
30. Should `vacancy_candidate` have its own stage/status, assigned date, source, notes, and rejection reason?
31. Should `vacancy_candidate` have a database unique constraint on `(vacancyId, candidateId)` to prevent race-condition duplicates?
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
62. Should external API calls be queued/backgrounded instead of running directly inside tRPC mutations?
63. Should there be idempotency keys for publish actions to avoid duplicate Telegram/hh.uz posts from double clicks or retries?
64. How should the app observe and alert on failed Telegram/hh.uz/Directus/mail/API calls?
65. Should `bun run check` be required to pass before deploy, and who owns existing Biome failures?

## Technical Issues Observed While Reviewing

- `README.md` is still mostly the default T3 template and is less accurate than `AGENTS.md`.
- Full `bun run check` has known existing failures unrelated to this document: a raw `<img>` in `hh-vacancy-preview.tsx`, an unused parameter in `src/server/services/hh/shared.ts`, and Drizzle metadata formatting.
- `src/server/services/hh/shared.ts` contains a TODO about showing actual hh.uz applicant status.
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
