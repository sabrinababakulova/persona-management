#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

if [ -n "$(git status --porcelain -- drizzle src/server/db/schema.ts)" ]; then
  echo "Migration validation requires a clean schema and drizzle directory." >&2
  git status --short -- drizzle src/server/db/schema.ts >&2
  exit 2
fi

echo "Checking that the committed Drizzle migrations match schema.ts..."
SKIP_ENV_VALIDATION=true bun run db:generate

if [ -n "$(git status --porcelain -- drizzle)" ]; then
  echo "::error title=Database migration is missing::Drizzle generated migration changes from schema.ts. Run 'bun run db:generate', review and commit every generated drizzle file, then push again." >&2
  echo "schema.ts is not represented by the committed migration history:" >&2
  git status --short -- drizzle >&2
  git diff -- drizzle >&2
  exit 1
fi

echo "Database migration metadata matches schema.ts."
