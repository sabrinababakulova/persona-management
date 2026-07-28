#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${PERSONA_PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${PERSONA_DATABASE_ENV_FILE:-$REPO_ROOT/.env}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Database restore verification must run as root." >&2
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "Database environment file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${DB_NAME:?DB_NAME must be set}"
: "${DB_USER:?DB_USER must be set}"
: "${DB_PASSWORD:?DB_PASSWORD must be set}"

if command -v docker >/dev/null 2>&1; then
  CONTAINER_CMD="docker"
elif command -v podman >/dev/null 2>&1; then
  CONTAINER_CMD="podman"
else
  echo "Docker or Podman is required for restore verification." >&2
  exit 1
fi

BACKUP_ROOT="${DATABASE_BACKUP_DIR:-$REPO_ROOT/backups/database}"
DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-$DB_NAME-postgres}"
LOCK_DIR="${PERSONA_CRON_LOCK_DIR:-/var/lock/persona-management}"
VERIFY_DB_NAME="backup_verify_$(date -u +%Y%m%d_%H%M%S)_$$"

if [ "$#" -gt 1 ]; then
  echo "Usage: $0 [backup.dump]" >&2
  exit 2
fi

if [ "$#" -eq 1 ]; then
  BACKUP_PATH="$1"
else
  shopt -s nullglob
  BACKUPS=("$BACKUP_ROOT/daily/${DB_NAME}-"*.dump)
  shopt -u nullglob
  if [ "${#BACKUPS[@]}" -eq 0 ]; then
    echo "No daily database backups found under $BACKUP_ROOT/daily." >&2
    exit 1
  fi
  BACKUP_PATH="${BACKUPS[${#BACKUPS[@]} - 1]}"
fi

if [ ! -f "$BACKUP_PATH" ] || [ ! -s "$BACKUP_PATH" ]; then
  echo "Backup does not exist or is empty: $BACKUP_PATH" >&2
  exit 1
fi

mkdir -p "$LOCK_DIR"
exec 9>"$LOCK_DIR/database-restore-test.lock"
if ! flock -n 9; then
  printf '%s database-restore-test skipped: another test is running\n' \
    "$(date -Is)"
  exit 0
fi

cleanup() {
  "$CONTAINER_CMD" exec \
    -e PGPASSWORD="$DB_PASSWORD" \
    "$DB_CONTAINER_NAME" \
    dropdb \
    --username="$DB_USER" \
    --if-exists \
    --force \
    "$VERIFY_DB_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

printf '%s database-restore-test starting: %s\n' "$(date -Is)" "$BACKUP_PATH"

"$CONTAINER_CMD" exec \
  -e PGPASSWORD="$DB_PASSWORD" \
  "$DB_CONTAINER_NAME" \
  createdb \
  --username="$DB_USER" \
  "$VERIFY_DB_NAME"

"$CONTAINER_CMD" exec \
  -i \
  -e PGPASSWORD="$DB_PASSWORD" \
  "$DB_CONTAINER_NAME" \
  pg_restore \
  --username="$DB_USER" \
  --dbname="$VERIFY_DB_NAME" \
  --exit-on-error \
  --no-owner \
  --no-privileges <"$BACKUP_PATH"

TABLE_COUNT="$(
  "$CONTAINER_CMD" exec \
    -e PGPASSWORD="$DB_PASSWORD" \
    "$DB_CONTAINER_NAME" \
    psql \
    --username="$DB_USER" \
    --dbname="$VERIFY_DB_NAME" \
    --tuples-only \
    --no-align \
    --command="SELECT count(*) FROM pg_tables WHERE schemaname = 'public';"
)"

if ! [[ "$TABLE_COUNT" =~ ^[1-9][0-9]*$ ]]; then
  echo "Restore verification found no public tables." >&2
  exit 1
fi

printf '%s database-restore-test completed: restored %s public tables\n' \
  "$(date -Is)" \
  "$TABLE_COUNT"
