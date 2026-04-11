#!/usr/bin/env bash
set -euo pipefail

# Repair drizzle migration tracking when the schema was applied out-of-band
# (e.g. via `drizzle-kit push` or manual SQL) and `drizzle.__drizzle_migrations`
# is out of sync with the actual DB state.
#
# What this does:
#   1. Ensures the schema parts from 0006 (candidate_vacancy) exist
#   2. Ensures the schema + data parts from 0007 (tenant activity logs) exist
#   3. Marks migrations 0000-0007 as applied in drizzle.__drizzle_migrations
#      (only the ones that aren't already tracked)
#
# Safe to run: all operations are idempotent and wrapped in a transaction.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

set -a
source "$REPO_ROOT/.env"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Check your .env file."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed."
  exit 1
fi

echo "=== Repairing drizzle migration tracking ==="
echo ""

psql "$DATABASE_URL" <<'SQL'
BEGIN;

-- === Ensure 0006 schema parts exist (candidate_vacancy) ===
CREATE TABLE IF NOT EXISTS "candidate_vacancy" (
  "candidateId" varchar(255) NOT NULL,
  "vacancyId" varchar(255) NOT NULL,
  "createdAt" timestamp with time zone NOT NULL,
  CONSTRAINT "candidate_vacancy_candidateId_vacancyId_pk" PRIMARY KEY("candidateId","vacancyId")
);

DO $$ BEGIN
  ALTER TABLE "candidate_vacancy" ADD CONSTRAINT "candidate_vacancy_candidateId_candidate_id_fk"
    FOREIGN KEY ("candidateId") REFERENCES "public"."candidate"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "candidate_vacancy" ADD CONSTRAINT "candidate_vacancy_vacancyId_vacancy_id_fk"
    FOREIGN KEY ("vacancyId") REFERENCES "public"."vacancy"("id") ON DELETE cascade;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "candidate_vacancy_candidate_id_idx" ON "candidate_vacancy" ("candidateId");
CREATE INDEX IF NOT EXISTS "candidate_vacancy_vacancy_id_idx"   ON "candidate_vacancy" ("vacancyId");
CREATE INDEX IF NOT EXISTS "candidate_vacancy_created_at_idx"   ON "candidate_vacancy" ("createdAt");

-- === Ensure 0007 data + schema parts exist (tenant activity logs) ===
INSERT INTO "company" ("id", "name")
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Company')
ON CONFLICT ("id") DO NOTHING;

UPDATE "user"      SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "candidate" SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;
UPDATE "vacancy"   SET "companyId" = '00000000-0000-0000-0000-000000000001' WHERE "companyId" IS NULL;

ALTER TABLE "recent_activity_log" ADD COLUMN IF NOT EXISTS "companyId" varchar(255);

UPDATE "recent_activity_log" AS a SET "companyId" = c."companyId"
  FROM "candidate" c
  WHERE a."entityType" = 'candidate' AND a."entityId" = c."id" AND a."companyId" IS NULL;

UPDATE "recent_activity_log" AS a SET "companyId" = v."companyId"
  FROM "vacancy" v
  WHERE a."entityType" = 'vacancy' AND a."entityId" = v."id" AND a."companyId" IS NULL;

DELETE FROM "recent_activity_log" WHERE "companyId" IS NULL;

ALTER TABLE "recent_activity_log" ALTER COLUMN "companyId" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "recent_activity_log" ADD CONSTRAINT "recent_activity_log_companyId_company_id_fk"
    FOREIGN KEY ("companyId") REFERENCES "public"."company"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "recent_activity_company_id_idx" ON "recent_activity_log" ("companyId");

-- === Mark migrations 0000-0007 as applied (only those not already tracked) ===
INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
SELECT v.hash, v.created_at FROM (VALUES
  ('f2df4c0eaa5ad53cef18c4c0e96ddae6d4b5e9354497dd0dd8e4fea57057257b'::text, 1773392550191::bigint),
  ('1d4591d8dc663b3eb4654271f7573271627ae9b1008ebe5891d785bb65a35e8a', 1773815357589),
  ('96419f4d9c558efbf22412332c76fb704707b517bfb22a9180028fb73e9c52c5', 1773816834403),
  ('22298c7153c65e135bcf12d5ebf6bfd2c7a6212b0ae5e1ca2a1d36fda2bcf889', 1773817303514),
  ('de982b8d3f3cb65e4ca968a40104e2e62f695a1d300e60bbfc1a51026e4876c3', 1773829831025),
  ('d4f4af5a588be15afb9d13c9203f5ab8bd4530ff202437e8c57e793f3919876a', 1774817312769),
  ('3de0f4ced596f9db7a22357928e064d918abbe18259dbbc8f344baf64a0b3382', 1775646036121),
  ('a307093c4a69888cc4b1c8043c1ca646e40105595b83301ca8516a75ecabf492', 1775860800000)
) AS v(hash, created_at)
WHERE NOT EXISTS (
  SELECT 1 FROM drizzle.__drizzle_migrations m WHERE m.hash = v.hash
);

COMMIT;
SQL

echo ""
echo "=== Current tracked migrations ==="
psql "$DATABASE_URL" -c "SELECT id, LEFT(hash, 16) AS hash_prefix, created_at FROM drizzle.__drizzle_migrations ORDER BY id;"

echo ""
echo "=========================================="
echo "Repair complete!"
echo "You can now run 'bun run db:migrate' safely."
echo "=========================================="
