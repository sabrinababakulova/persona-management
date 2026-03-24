#!/usr/bin/env bash
set -euo pipefail

# Full setup from zero: database + directus + app schema + seed data
# Run this on a fresh server or fresh local machine.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

set -a
source "$REPO_ROOT/.env"

echo "=== 1. Starting database ==="
"$SCRIPT_DIR/start-database.sh"

echo ""
echo "=== 2. Waiting for database to be ready ==="
DB_NAME=$(echo "$DATABASE_URL" | awk -F'/' '{print $4}')
DB_CONTAINER_NAME="$DB_NAME-postgres"
for i in $(seq 1 30); do
  if docker exec "$DB_CONTAINER_NAME" pg_isready -U postgres -q 2>/dev/null; then
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
echo "=== 3. Pushing schema to database ==="
bun run db:push

echo ""
echo "=== 4. Seeding lookup tables ==="
bun run db:seed

echo ""
echo "=== 5. Starting Directus ==="
docker compose up -d

echo ""
echo "=== 6. Waiting for Directus to be ready ==="
DIRECTUS_URL="${DIRECTUS_URL:-http://127.0.0.1:8055}"
for i in $(seq 1 60); do
  if curl -sf "$DIRECTUS_URL/server/health" >/dev/null 2>&1; then
    echo "Directus is ready."
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Directus did not become ready in time. Check: docker logs directus"
    exit 1
  fi
  sleep 2
done

echo ""
echo "=== 7. Registering tables in Directus admin panel ==="
"$SCRIPT_DIR/register-directus-collections.sh"

echo ""
echo "=========================================="
echo "Setup complete!"
echo "  Database:  localhost:$DB_PORT"
echo "  Directus:  $DIRECTUS_URL/admin"
echo "=========================================="
