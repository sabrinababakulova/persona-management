#!/usr/bin/env bash
set -euo pipefail

# Full setup from zero: database + directus + app schema + seed data
# Run this on a fresh server or fresh local machine.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

set -a
source .env

echo "=== 1. Starting database ==="
./start-database.sh

echo ""
echo "=== 2. Waiting for database to be ready ==="
DB_PORT=$(echo "$DATABASE_URL" | awk -F':' '{print $4}' | awk -F'/' '{print $1}')
for i in $(seq 1 30); do
  if pg_isready -h localhost -p "$DB_PORT" -q 2>/dev/null; then
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
./register-directus-collections.sh

echo ""
echo "=========================================="
echo "Setup complete!"
echo "  Database:  localhost:$DB_PORT"
echo "  Directus:  $DIRECTUS_URL/admin"
echo "=========================================="
