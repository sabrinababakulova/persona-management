# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> A detailed companion doc lives in `AGENTS.md` — consult it for full table schemas, the hh.uz sync internals, the Zustand store contract, and per-router procedure lists. This file is the quick orientation.

## What this is

Persona Management — a recruitment/ATS app with a **Russian-language UI**. T3 Stack: Next.js 15 (App Router) + TypeScript + tRPC v11 + NextAuth v5 + Drizzle ORM (PostgreSQL) + Tailwind v4. Package manager and runtime is **Bun**.

## Commands

```bash
bun dev                # dev server (next dev --turbo)
bun run build          # production build
bun run typecheck      # tsc --noEmit
bun run check          # Biome lint + format check
bun run check:write    # Biome auto-fix
bun test               # run tests (bun test); single test: bun test path/to/file.test.ts
bun run db:generate    # generate a migration from schema.ts
bun run db:push        # apply schema.ts directly to the DB (what production deploy uses)
bun run db:migrate     # apply migration .sql files
bun run db:seed        # seed lookup tables + default company + demo data
bun run db:studio      # Drizzle Studio GUI
bun run storybook      # Storybook on :6006
```

Path alias: `~/` → `./src/`. ESM project (`"type": "module"`).

## Architecture essentials

- **End-to-end type safety**: tRPC routers in `src/server/api/routers/` are merged in `src/server/api/root.ts`. Client calls via `api.router.procedure.useQuery()` (`src/trpc/react.tsx`); Server Components use the caller in `src/trpc/server.ts`. Most procedures are `protectedProcedure` (requires session).
- **Data fetching pattern**: Server Components fetch via the server-side tRPC caller and pass data as props to `"use client"` components. Default to Server Components; add `"use client"` only for interactivity.
- **Auth**: NextAuth v5, credentials provider, **JWT session strategy** (no DB sessions). Registration sends a 6-digit email code (Yandex SMTP, HMAC-verified) `src/middleware.ts` gates `/dashboard`, `/candidates`, `/vacancies`, `/my-profile`, `/onboarding`, and sends accounts without a company (Google sign-ups) to `/onboarding/company`. Rate limiting reuses the `verificationTokens` table.
- **Multi-tenancy**: every domain entity (`candidates`, `vacancies`) is scoped by `companyId`, auto-assigned from the creating user's company. Queries filter by the current user's company — users only see their own company's data. Registration either creates a company (the creator becomes its single `admin`) or joins one via an invite link (`member`); only the admin can edit the company profile or manage invites. See `docs/company-roles-and-signup.md` for the full role/sign-up flow.
- **DB schema** is a single file: `src/server/db/schema.ts`. UUID PKs, JSON columns for nested data (contacts/skills/experience), unprefixed table names, lookup tables for dropdown options.
- **AI/resume pipeline**: Mastra agents (`src/mastra/agents/`) on Google Gemini 2.5 Flash — resume analyzer, summary, candidate↔vacancy match (0–100), HR chatbot. Resume processing lives in `src/server/resume/`; files stored in Directus (`src/server/storage/`).
- **hh.uz candidate sync** (`src/server/services/hh/`): a 3-layer engine — discovery → enrichment queue → status reconciliation. hh.uz applicants are **persisted** into `candidates`/`vacancy_candidate`, deduped by partial unique indexes. Driven by bearer-authorized `/api/cron/hh-*` routes. See AGENTS.md for the full design before touching it.
- **Client draft state**: only the multi-step vacancy publication flow uses Zustand (`src/stores/vacancy-publication-store.ts`, persisted to localStorage). Everything else is server state via TanStack Query. Transient UI state stays in `useState`.
- **Telegram**: vacancies can be posted to a channel (`src/server/services/telegram.ts`); button hidden unless `TELEGRAM_*` env vars are set.

## Conventions

- **All user-facing text is Russian** (labels, placeholders, validation messages). Code and comments are English.
- File naming: components `kebab-case.tsx`; icons `PascalCaseIcon.tsx` (re-exported from `src/app/_components/icons/index.tsx`, props `{ className?: string }`); types `kebab-case.ts` grouped by domain in `src/types/`.
- Validation: Zod. Reusable schemas in `src/schemas/`; tRPC inputs validated inline per procedure.
- Env vars are validated in `src/env.js` (`@t3-oss/env-nextjs`). **No `NEXT_PUBLIC_*` vars exist — all env is server-only.**
- Linting/formatting is **Biome** (`biome.jsonc`), not ESLint/Prettier.

## Schema changes

Production deploy (`scripts/deploy.sh`) runs **`bun run db:migrate`**. `db:push` is deliberately not used anywhere in the deploy path: it applies `schema.ts` directly, skipping the `.sql` files, so any data backfill written in a migration would never run.

So every schema change is a generated migration: edit `schema.ts`, run `bun run db:generate`, and if the change needs existing rows rewritten (a new `NOT NULL` column, a column being replaced), hand-edit the generated `.sql` to add the backfill between the `ADD COLUMN` and the `SET NOT NULL`. Never let the deploy be the first place a backfill is attempted.

`db:generate` prompts interactively whenever a table both loses and gains a column — it cannot tell a rename from a drop-plus-add. Answer **create column** unless you genuinely want the old values carried over verbatim; a wrong "rename" silently keeps data in a column that now means something else.

If a database was ever deployed with push, its ledger is behind its schema and `db:migrate` fails on "already exists". `bun run db:migrate-custom` reconciles it once by skipping changes already present.
