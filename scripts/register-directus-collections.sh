#!/usr/bin/env bash
# Register all app tables in Directus admin panel so they're visible in the Content module.
# Excludes directus_* internal tables.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

set -a
source "$REPO_ROOT/.env"

# Authenticate and get access token
TOKEN=$(curl -s -X POST "$DIRECTUS_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$DIRECTUS_ADMIN_EMAIL\", \"password\": \"$DIRECTUS_ADMIN_PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

if [ -z "$TOKEN" ]; then
  echo "Failed to authenticate with Directus"
  exit 1
fi

echo "Authenticated with Directus successfully."

# Get all non-directus collections
TABLES=$(PGPASSWORD=$(echo "$DATABASE_URL" | awk -F':' '{print $3}' | awk -F'@' '{print $1}') \
  psql -h localhost \
  -p "$(echo "$DATABASE_URL" | awk -F':' '{print $4}' | awk -F'/' '{print $1}')" \
  -U postgres \
  -d "$(echo "$DATABASE_URL" | awk -F'/' '{print $4}')" \
  -t -A -c "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'directus_%' ORDER BY tablename;")

for TABLE in $TABLES; do
  echo -n "Registering '$TABLE'... "
  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "$DIRECTUS_URL/collections/$TABLE" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"meta\": {\"hidden\": false, \"singleton\": false}}")

  if [ "$RESPONSE" = "200" ]; then
    echo "OK"
  else
    echo "HTTP $RESPONSE"
  fi
done

echo ""
echo "Done! All tables should now be visible at $DIRECTUS_URL/admin/content"
