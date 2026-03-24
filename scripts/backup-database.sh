#!/usr/bin/env bash
set -euo pipefail

# Create a timestamped PostgreSQL dump from the local development container.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

set -a
source "$REPO_ROOT/.env"

DB_PASSWORD=$(echo "$DATABASE_URL" | awk -F':' '{print $3}' | awk -F'@' '{print $1}')
DB_PORT=$(echo "$DATABASE_URL" | awk -F':' '{print $4}' | awk -F'/' '{print $1}')
DB_NAME=$(echo "$DATABASE_URL" | awk -F'/' '{print $4}')
DB_CONTAINER_NAME="$DB_NAME-postgres"
BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
BACKUP_PATH="$BACKUP_DIR/${DB_NAME}-${TIMESTAMP}.sql.gz"

if ! [ -x "$(command -v docker)" ] && ! [ -x "$(command -v podman)" ]; then
  echo "Docker or Podman is not installed."
  exit 1
fi

if [ -x "$(command -v docker)" ]; then
  DOCKER_CMD="docker"
else
  DOCKER_CMD="podman"
fi

if ! $DOCKER_CMD ps -q -f name="^${DB_CONTAINER_NAME}$" >/dev/null; then
  echo "Unable to query containers."
  exit 1
fi

CONTAINER_ID=$($DOCKER_CMD ps -q -f name="^${DB_CONTAINER_NAME}$")
if [ -z "$CONTAINER_ID" ]; then
  echo "Database container '$DB_CONTAINER_NAME' is not running."
  exit 1
fi

mkdir -p "$BACKUP_DIR"

$DOCKER_CMD exec \
  -e PGPASSWORD="$DB_PASSWORD" \
  "$DB_CONTAINER_NAME" \
  pg_dump -U postgres "$DB_NAME" | gzip > "$BACKUP_PATH"

echo "Backup created at $BACKUP_PATH"
