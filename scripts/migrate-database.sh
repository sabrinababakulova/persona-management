#!/usr/bin/env bash
set -euo pipefail

# Migrate an existing database container (without named volume) to the new setup
# with a named volume so data survives container removal.
#
# What this does:
#   1. Backs up the existing database
#   2. Removes the old container (data in anonymous volume would be lost)
#   3. Recreates the container with a named volume
#   4. Restores the backup
#
# Safe to run: your data is backed up before anything is deleted.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

set -a
source .env

DB_PASSWORD=$(echo "$DATABASE_URL" | awk -F':' '{print $3}' | awk -F'@' '{print $1}')
DB_PORT=$(echo "$DATABASE_URL" | awk -F':' '{print $4}' | awk -F'/' '{print $1}')
DB_NAME=$(echo "$DATABASE_URL" | awk -F'/' '{print $4}')
DB_CONTAINER_NAME="$DB_NAME-postgres"
DB_VOLUME_NAME="$DB_NAME-postgres-data"

if [ -x "$(command -v docker)" ]; then
  DOCKER_CMD="docker"
elif [ -x "$(command -v podman)" ]; then
  DOCKER_CMD="podman"
else
  echo "Docker or Podman is not installed."
  exit 1
fi

# Check if already using a named volume
CURRENT_VOLUME=$($DOCKER_CMD inspect "$DB_CONTAINER_NAME" 2>/dev/null \
  | python3 -c "import sys,json; mounts=json.load(sys.stdin)[0]['Mounts']; [print(m.get('Name','')) for m in mounts if m['Destination']=='/var/lib/postgresql']" 2>/dev/null || true)

if [ "$CURRENT_VOLUME" = "$DB_VOLUME_NAME" ]; then
  echo "Container '$DB_CONTAINER_NAME' is already using named volume '$DB_VOLUME_NAME'."
  echo "No migration needed."
  exit 0
fi

# Check container exists
if ! $DOCKER_CMD ps -a -q -f name="^${DB_CONTAINER_NAME}$" | grep -q .; then
  echo "Container '$DB_CONTAINER_NAME' not found. Use ./setup.sh for a fresh install."
  exit 1
fi

# Check container is running
if ! $DOCKER_CMD ps -q -f name="^${DB_CONTAINER_NAME}$" | grep -q .; then
  echo "Container '$DB_CONTAINER_NAME' exists but is not running. Starting it for backup..."
  $DOCKER_CMD start "$DB_CONTAINER_NAME"
  sleep 5
fi

echo "=== 1. Backing up database ==="
BACKUP_FILE="$SCRIPT_DIR/migration-backup-$(date -u +%Y%m%dT%H%M%SZ).sql"
$DOCKER_CMD exec \
  -e PGPASSWORD="$DB_PASSWORD" \
  "$DB_CONTAINER_NAME" \
  pg_dump -U postgres "$DB_NAME" > "$BACKUP_FILE"
echo "Backup saved to $BACKUP_FILE ($(wc -l < "$BACKUP_FILE") lines)"

echo ""
echo "=== 2. Stopping Directus (depends on database) ==="
docker compose down 2>/dev/null || true

echo ""
echo "=== 3. Removing old container ==="
$DOCKER_CMD rm -f "$DB_CONTAINER_NAME"

echo ""
echo "=== 4. Creating new container with named volume ==="
./start-database.sh

echo ""
echo "=== 5. Waiting for database to be ready ==="
for i in $(seq 1 30); do
  if $DOCKER_CMD exec "$DB_CONTAINER_NAME" pg_isready -U postgres -q 2>/dev/null; then
    echo "Database is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Database did not become ready in time."
    exit 1
  fi
  sleep 1
done

echo ""
echo "=== 6. Restoring backup ==="
PGPASSWORD="$DB_PASSWORD" psql -h localhost -p "$DB_PORT" -U postgres -d "$DB_NAME" < "$BACKUP_FILE" > /dev/null 2>&1
echo "Database restored."

echo ""
echo "=== 7. Restarting Directus ==="
docker compose up -d

echo ""
echo "=== 8. Verifying ==="
TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h localhost -p "$DB_PORT" -U postgres -d "$DB_NAME" -t -A -c \
  "SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'directus_%';")
echo "Found $TABLE_COUNT app tables."

VOLUME_CHECK=$($DOCKER_CMD inspect "$DB_CONTAINER_NAME" 2>/dev/null \
  | python3 -c "import sys,json; mounts=json.load(sys.stdin)[0]['Mounts']; [print(m.get('Name','')) for m in mounts if m['Destination']=='/var/lib/postgresql']" 2>/dev/null || true)
if [ "$VOLUME_CHECK" = "$DB_VOLUME_NAME" ]; then
  echo "Named volume '$DB_VOLUME_NAME' is attached."
else
  echo "WARNING: Named volume not detected. Check container mounts."
fi

echo ""
echo "=========================================="
echo "Migration complete!"
echo "  Backup kept at: $BACKUP_FILE"
echo "  You can delete it after verifying everything works."
echo "=========================================="
