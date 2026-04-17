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

patch_field() {
  local collection="$1"
  local field="$2"
  local payload="$3"
  local label="$4"

  echo -n "Configuring '$label'... "
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "$DIRECTUS_URL/fields/$collection/$field" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if [ "$response" = "200" ]; then
    echo "OK"
  else
    echo "HTTP $response"
  fi
}

create_field_if_missing() {
  local collection="$1"
  local field="$2"
  local payload="$3"
  local label="$4"

  echo -n "Ensuring '$label' exists... "
  local status
  status=$(curl -s -o /dev/null -w "%{http_code}" \
    "$DIRECTUS_URL/fields/$collection/$field" \
    -H "Authorization: Bearer $TOKEN")

  if [ "$status" = "200" ]; then
    echo "OK"
    return
  fi

  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "$DIRECTUS_URL/fields/$collection" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if [ "$response" = "200" ] || [ "$response" = "201" ]; then
    echo "OK"
  else
    echo "HTTP $response"
  fi
}

upsert_relation() {
  local collection="$1"
  local field="$2"
  local payload="$3"
  local label="$4"

  echo -n "Configuring '$label' relation... "
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "$DIRECTUS_URL/relations/$collection/$field" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if [ "$response" = "200" ]; then
    echo "OK"
    return
  fi

  response=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    "$DIRECTUS_URL/relations" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if [ "$response" = "200" ] || [ "$response" = "201" ]; then
    echo "OK"
  else
    echo "HTTP $response"
  fi
}

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
echo -n "Configuring 'vacancy_publication' collection metadata... "
VACANCY_PUBLICATION_COLLECTION_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  "$DIRECTUS_URL/collections/vacancy_publication" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "meta": {
      "hidden": false,
      "singleton": false,
      "icon": "campaign",
      "display_template": "{{name}}",
      "note": "Версии публикаций вакансий"
    }
  }')

if [ "$VACANCY_PUBLICATION_COLLECTION_RESPONSE" = "200" ]; then
  echo "OK"
else
  echo "HTTP $VACANCY_PUBLICATION_COLLECTION_RESPONSE"
fi

echo ""
echo "Configuring Directus field metadata..."

patch_field "user" "password" '{
    "type": "hash",
    "meta": {
      "interface": "input-hash",
      "options": {
        "masked": true
      },
      "hidden": false,
      "readonly": false,
      "note": "Хэшируется Directus при сохранении"
    }
  }' "user.password as hash field"

patch_field "vacancy_publication" "name" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "required": true,
      "sort": 1,
      "width": "full",
      "note": "Название версии публикации"
    }
  }' "vacancy_publication.name"

patch_field "vacancy_publication" "description" '{
    "type": "text",
    "meta": {
      "interface": "input-multiline",
      "sort": 2,
      "width": "full",
      "note": "Текст описания вакансии для публикации"
    }
  }' "vacancy_publication.description"

patch_field "vacancy_publication" "isActive" '{
    "type": "boolean",
    "meta": {
      "interface": "boolean",
      "sort": 3,
      "width": "half",
      "note": "Активна ли публикация"
    }
  }' "vacancy_publication.isActive"

patch_field "vacancy_publication" "sources" '{
    "type": "json",
    "meta": {
      "interface": "input-code",
      "options": {
        "language": "json"
      },
      "sort": 4,
      "width": "full",
      "note": "Массив ссылок публикации: [{\"platform\":\"telegram\",\"url\":\"https://...\"}]"
    }
  }' "vacancy_publication.sources"

patch_field "vacancy_publication" "vacancy_id" '{
    "type": "string",
    "meta": {
      "interface": "select-dropdown-m2o",
      "sort": 5,
      "width": "full",
      "required": true,
      "note": "Вакансия, к которой относится публикация"
    }
  }' "vacancy_publication.vacancy_id"

create_field_if_missing "vacancy" "publications" '{
    "field": "publications",
    "type": "alias",
    "meta": {
      "interface": "list-o2m",
      "special": ["o2m"],
      "sort": 100,
      "width": "full",
      "note": "Версии публикаций вакансии"
    }
  }' "vacancy.publications"

upsert_relation "vacancy_publication" "vacancy_id" '{
    "collection": "vacancy_publication",
    "field": "vacancy_id",
    "related_collection": "vacancy",
    "meta": {
      "many_collection": "vacancy_publication",
      "many_field": "vacancy_id",
      "one_collection": "vacancy",
      "one_field": "publications",
      "one_deselect_action": "delete"
    },
    "schema": {
      "table": "vacancy_publication",
      "column": "vacancy_id",
      "foreign_key_table": "vacancy",
      "foreign_key_column": "id",
      "constraint_name": "vacancy_publication_vacancy_id_vacancy_id_fk",
      "on_update": "NO ACTION",
      "on_delete": "CASCADE"
    }
  }' "vacancy.publications"

echo ""
echo "Done! All tables should now be visible at $DIRECTUS_URL/admin/content"
