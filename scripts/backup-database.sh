#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${PERSONA_PROJECT_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
ENV_FILE="${PERSONA_DATABASE_ENV_FILE:-$REPO_ROOT/.env}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Database backups must run as root to access the database container." >&2
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
  echo "Docker or Podman is required for a database backup." >&2
  exit 1
fi

for command in flock find mktemp; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command is not installed: $command" >&2
    exit 1
  fi
done

BACKUP_ROOT="${DATABASE_BACKUP_DIR:-$REPO_ROOT/backups/database}"
DAILY_RETENTION_DAYS="${DATABASE_BACKUP_DAILY_RETENTION_DAYS:-14}"
WEEKLY_RETENTION_DAYS="${DATABASE_BACKUP_WEEKLY_RETENTION_DAYS:-56}"
MONTHLY_RETENTION_DAYS="${DATABASE_BACKUP_MONTHLY_RETENTION_DAYS:-366}"
DB_CONTAINER_NAME="${DB_CONTAINER_NAME:-$DB_NAME-postgres}"
LOCK_DIR="${PERSONA_CRON_LOCK_DIR:-/var/lock/persona-management}"

for value_name in \
  DAILY_RETENTION_DAYS \
  WEEKLY_RETENTION_DAYS \
  MONTHLY_RETENTION_DAYS; do
  value="${!value_name}"
  if ! [[ "$value" =~ ^[1-9][0-9]*$ ]]; then
    echo "$value_name must be a positive integer, got: $value" >&2
    exit 2
  fi
done

DAILY_DIR="$BACKUP_ROOT/daily"
WEEKLY_DIR="$BACKUP_ROOT/weekly"
MONTHLY_DIR="$BACKUP_ROOT/monthly"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_NAME="${DB_NAME}-${TIMESTAMP}.dump"
FINAL_PATH="$DAILY_DIR/$BACKUP_NAME"
TEMP_PATH=""

umask 077
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR" "$MONTHLY_DIR" "$LOCK_DIR"

exec 9>"$LOCK_DIR/database-backup.lock"
if ! flock -n 9; then
  printf '%s database-backup skipped: another backup is still running\n' \
    "$(date -Is)"
  exit 0
fi

cleanup() {
  if [ -n "$TEMP_PATH" ] && [ -f "$TEMP_PATH" ]; then
    rm -f -- "$TEMP_PATH"
  fi
}
trap cleanup EXIT

if ! "$CONTAINER_CMD" inspect "$DB_CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Database container not found: $DB_CONTAINER_NAME" >&2
  exit 1
fi

if [ "$("$CONTAINER_CMD" inspect -f '{{.State.Running}}' "$DB_CONTAINER_NAME")" != "true" ]; then
  echo "Database container is not running: $DB_CONTAINER_NAME" >&2
  exit 1
fi

TEMP_PATH="$(mktemp "$DAILY_DIR/.${BACKUP_NAME}.tmp.XXXXXX")"

printf '%s database-backup starting: %s\n' "$(date -Is)" "$FINAL_PATH"
"$CONTAINER_CMD" exec \
  -e PGPASSWORD="$DB_PASSWORD" \
  "$DB_CONTAINER_NAME" \
  pg_dump \
  --username="$DB_USER" \
  --dbname="$DB_NAME" \
  --format=custom \
  --compress=6 \
  --no-owner \
  --no-privileges >"$TEMP_PATH"

if [ ! -s "$TEMP_PATH" ]; then
  echo "Database backup is empty; refusing to publish it." >&2
  exit 1
fi

# Validate the archive with the pg_restore version bundled with the same
# PostgreSQL container that created it.
"$CONTAINER_CMD" exec -i "$DB_CONTAINER_NAME" pg_restore --list \
  <"$TEMP_PATH" >/dev/null

mv -- "$TEMP_PATH" "$FINAL_PATH"
TEMP_PATH=""
chmod 600 "$FINAL_PATH"

# Promote the same successful snapshot into longer-lived retention tiers.
if [ "$(date -u +%u)" = "7" ]; then
  cp --preserve=mode,timestamps "$FINAL_PATH" "$WEEKLY_DIR/$BACKUP_NAME"
fi
if [ "$(date -u +%d)" = "01" ]; then
  cp --preserve=mode,timestamps "$FINAL_PATH" "$MONTHLY_DIR/$BACKUP_NAME"
fi

find "$DAILY_DIR" \
  -type f -name "${DB_NAME}-*.dump" -mtime "+$DAILY_RETENTION_DAYS" -delete
find "$WEEKLY_DIR" \
  -type f -name "${DB_NAME}-*.dump" -mtime "+$WEEKLY_RETENTION_DAYS" -delete
find "$MONTHLY_DIR" \
  -type f -name "${DB_NAME}-*.dump" -mtime "+$MONTHLY_RETENTION_DAYS" -delete

printf '%s database-backup completed: %s (%s bytes)\n' \
  "$(date -Is)" \
  "$FINAL_PATH" \
  "$(stat -c %s "$FINAL_PATH")"
