#!/usr/bin/env bash
# Show all app tables and their data (excludes directus_* internal tables)

set -a
source .env

DB_HOST="localhost"
DB_PORT=$(echo "$DATABASE_URL" | awk -F':' '{print $4}' | awk -F'/' '{print $1}')
DB_NAME=$(echo "$DATABASE_URL" | awk -F'/' '{print $4}')
DB_USER="postgres"
DB_PASSWORD=$(echo "$DATABASE_URL" | awk -F':' '{print $3}' | awk -F'@' '{print $1}')

export PGPASSWORD="$DB_PASSWORD"

TABLES=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c \
  "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE 'directus_%' ORDER BY tablename;")

for TABLE in $TABLES; do
  COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT count(*) FROM \"$TABLE\";")
  echo "=============================================="
  echo "TABLE: $TABLE ($COUNT rows)"
  echo "=============================================="
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --pset="border=2" -c "SELECT * FROM \"$TABLE\";"
  echo ""
done
