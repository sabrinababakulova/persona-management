#!/usr/bin/env bash
set -euo pipefail

# Enforce required Directus system field metadata that isn't part of the app schema.
# This is idempotent and safe to rerun on every setup.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

set -a
source "$REPO_ROOT/.env"

psql "$DATABASE_URL" <<'SQL'
BEGIN;

DELETE FROM directus_fields
WHERE collection = 'directus_users'
  AND field = 'password';

INSERT INTO directus_fields (
  collection,
  field,
  special,
  interface,
  options,
  display,
  display_options,
  readonly,
  hidden,
  sort,
  width,
  translations,
  note,
  conditions,
  required,
  "group",
  validation,
  validation_message,
  searchable
)
VALUES (
  'directus_users',
  'password',
  'hash,conceal',
  'input-hash',
  '{"iconRight":"lock","masked":true}'::json,
  NULL,
  NULL,
  FALSE,
  FALSE,
  4,
  'half',
  NULL,
  NULL,
  NULL,
  FALSE,
  NULL,
  NULL,
  NULL,
  TRUE
);

COMMIT;
SQL

echo "Configured Directus system field override: directus_users.password"
