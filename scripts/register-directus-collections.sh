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

get_field_config() {
  local collection="$1"
  local field="$2"

  curl -s \
    "$DIRECTUS_URL/fields/$collection/$field" \
    -H "Authorization: Bearer $TOKEN"
}

configure_hash_field() {
  local collection="$1"
  local field="$2"
  local label="$3"

  echo -n "Configuring '$label'... "

  local response
  response=$(curl -s -o /tmp/directus-hash-field-response.json -w "%{http_code}" -X PATCH \
    "$DIRECTUS_URL/fields/$collection/$field" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "type": "hash",
      "meta": {
        "special": ["hash"],
        "interface": "input-hash",
        "options": {
          "masked": true
        },
        "hidden": false,
        "readonly": false,
        "note": "Хэшируется Directus при сохранении"
      }
    }')

  if [ "$response" != "200" ]; then
    echo "HTTP $response"
    return
  fi

  local field_config
  field_config=$(get_field_config "$collection" "$field")

  if printf '%s' "$field_config" | python3 -c '
import json
import sys

payload = json.load(sys.stdin)
data = payload.get("data") or {}
field_type = data.get("type")
meta = data.get("meta") or {}
special = meta.get("special") or []
if isinstance(special, str):
    special = [special]

if field_type == "hash" and "hash" in special:
    sys.exit(0)

sys.exit(1)
' >/dev/null 2>&1; then
    echo "OK"
  else
    echo "FAILED_VERIFICATION"
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
echo "Fetching hh.uz dictionaries for vacancy lookups..."

HH_LOOKUPS_DIR="/tmp/directus-hh-lookups"
mkdir -p "$HH_LOOKUPS_DIR"

# Pulls the public hh.uz dictionaries (areas, employment, schedule, experience, billing types,
# professional roles) and writes a Directus `choices` array per lookup to $HH_LOOKUPS_DIR.
# Each file is a JSON array of {"text", "value"} objects ready to be spliced into a
# select-dropdown interface payload below. Uses urllib (no extra dependencies) and skips on
# failure so the rest of the script can continue.
if python3 - "$HH_LOOKUPS_DIR" <<'PYEOF'
import json
import os
import sys
import urllib.request

OUT_DIR = sys.argv[1]
BASE = "https://api.hh.ru"
TIMEOUT = 15

def fetch(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as response:
        return json.loads(response.read())

def dedupe(choices):
    seen = set()
    out = []
    for choice in choices:
        value = choice.get("value")
        if value in seen:
            continue
        seen.add(value)
        out.append(choice)
    return out

def write(name, choices):
    path = os.path.join(OUT_DIR, f"{name}.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(dedupe(choices), handle, ensure_ascii=False)

dictionaries = fetch(f"{BASE}/dictionaries?host=hh.uz")
write("employment", [
    {"text": item.get("name") or item["id"], "value": item["id"]}
    for item in dictionaries.get("employment", [])
])
write("schedule", [
    {"text": item.get("name") or item["id"], "value": item["id"]}
    for item in dictionaries.get("schedule", [])
])
write("experience", [
    {"text": item.get("name") or item["id"], "value": item["id"]}
    for item in dictionaries.get("experience", [])
])
write("billing", [
    {"text": item.get("name") or item["id"], "value": item["id"]}
    for item in dictionaries.get("vacancy_billing_type", [])
])
write("currency", [
    {"text": item.get("name") or item["code"], "value": item["code"]}
    for item in dictionaries.get("currency", [])
])

# Areas: hh.uz exposes /areas/97 (Uzbekistan) as a tree; flatten to a single list of every
# settlement so users can pick any city without manually navigating the tree.
areas_root = fetch(f"{BASE}/areas/97")
flat_areas = []
def visit(node):
    flat_areas.append({"text": node["name"], "value": node["id"]})
    for child in node.get("areas") or []:
        visit(child)
for child in areas_root.get("areas") or []:
    visit(child)
write("areas", flat_areas)

# Professional roles: nested categories → flattened with category prefix so the dropdown
# label is self-contained (matches what the create form does on the client).
prof_roles = fetch(f"{BASE}/professional_roles")
role_choices = []
for category in prof_roles.get("categories", []):
    for role in category.get("roles", []):
        role_choices.append({
            "text": f"{category['name']} — {role['name']}",
            "value": role["id"],
        })
write("roles", role_choices)

print("OK", file=sys.stderr)
PYEOF
then
  echo "Fetched hh.uz dictionaries."
  HH_LOOKUPS_AVAILABLE=1
else
  echo "Could not fetch hh.uz dictionaries — vacancy lookup fields will fall back to free-text inputs."
  HH_LOOKUPS_AVAILABLE=0
fi

# Builds the JSON body for a vacancy lookup-id field. If the choices file exists, emits a
# select-dropdown interface backed by hh.uz options; otherwise falls back to a plain input so
# the field is at least visible/editable in the admin.
build_lookup_payload() {
  local choices_file="$1"
  local sort_index="$2"
  local width="$3"
  local note="$4"

  if [ "$HH_LOOKUPS_AVAILABLE" = "1" ] && [ -s "$choices_file" ]; then
    local choices
    choices=$(cat "$choices_file")
    cat <<EOF
{
  "type": "string",
  "meta": {
    "interface": "select-dropdown",
    "options": {
      "choices": $choices,
      "allowOther": false,
      "allowNone": true
    },
    "sort": $sort_index,
    "width": "$width",
    "note": "$note"
  }
}
EOF
  else
    cat <<EOF
{
  "type": "string",
  "meta": {
    "interface": "input",
    "sort": $sort_index,
    "width": "$width",
    "note": "$note"
  }
}
EOF
  fi
}

echo ""
echo "Configuring Directus field metadata..."

configure_hash_field "user" "password" "user.password as hash field"

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

patch_field "vacancy" "hh_vacancy_id" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "sort": 50,
      "width": "half",
      "note": "ID вакансии на hh.uz. Заполните вручную, чтобы связать существующую локальную вакансию с её копией на hh.uz и убрать дубликат из списка."
    }
  }' "vacancy.hh_vacancy_id"

# New hh.uz-shaped vacancy columns (added in migration 0014). Each lookup id renders as a
# select-dropdown populated from the live hh.uz dictionaries fetched above; numeric salary
# bounds use input-number; descriptionHtml uses the rich-text WYSIWYG so admins can paste
# formatted job descriptions; contactPhone is a plain input.

patch_field "vacancy" "area_id" \
  "$(build_lookup_payload "$HH_LOOKUPS_DIR/areas.json" 10 "half" "Город / регион hh.uz (areaId).")" \
  "vacancy.area_id"

patch_field "vacancy" "professional_role_id" \
  "$(build_lookup_payload "$HH_LOOKUPS_DIR/roles.json" 11 "half" "Профессиональная роль hh.uz (professionalRoleId).")" \
  "vacancy.professional_role_id"

patch_field "vacancy" "employment_id" \
  "$(build_lookup_payload "$HH_LOOKUPS_DIR/employment.json" 12 "half" "Тип занятости hh.uz (employmentId).")" \
  "vacancy.employment_id"

patch_field "vacancy" "schedule_id" \
  "$(build_lookup_payload "$HH_LOOKUPS_DIR/schedule.json" 13 "half" "График работы hh.uz (scheduleId).")" \
  "vacancy.schedule_id"

patch_field "vacancy" "experience_id" \
  "$(build_lookup_payload "$HH_LOOKUPS_DIR/experience.json" 14 "half" "Требуемый опыт hh.uz (experienceId).")" \
  "vacancy.experience_id"

patch_field "vacancy" "billing_type_id" \
  "$(build_lookup_payload "$HH_LOOKUPS_DIR/billing.json" 15 "half" "Тип публикации hh.uz (billingTypeId).")" \
  "vacancy.billing_type_id"

patch_field "vacancy" "salary_from" '{
    "type": "integer",
    "meta": {
      "interface": "input",
      "options": {
        "iconLeft": "payments"
      },
      "sort": 20,
      "width": "half",
      "note": "Минимальная зарплата (целое число, в выбранной валюте)."
    }
  }' "vacancy.salary_from"

patch_field "vacancy" "salary_to" '{
    "type": "integer",
    "meta": {
      "interface": "input",
      "options": {
        "iconLeft": "payments"
      },
      "sort": 21,
      "width": "half",
      "note": "Максимальная зарплата (целое число, в выбранной валюте)."
    }
  }' "vacancy.salary_to"

if [ "$HH_LOOKUPS_AVAILABLE" = "1" ] && [ -s "$HH_LOOKUPS_DIR/currency.json" ]; then
  CURRENCY_CHOICES=$(cat "$HH_LOOKUPS_DIR/currency.json")
  patch_field "vacancy" "salaryCurrency" "{
    \"type\": \"string\",
    \"meta\": {
      \"interface\": \"select-dropdown\",
      \"options\": {
        \"choices\": $CURRENCY_CHOICES,
        \"allowOther\": false,
        \"allowNone\": false
      },
      \"sort\": 22,
      \"width\": \"half\",
      \"note\": \"Валюта зарплаты (по умолчанию UZS).\"
    }
  }" "vacancy.salaryCurrency"
else
  patch_field "vacancy" "salaryCurrency" '{
    "type": "string",
    "meta": {
      "interface": "select-dropdown",
      "options": {
        "choices": [
          { "text": "UZS", "value": "UZS" },
          { "text": "USD", "value": "USD" }
        ],
        "allowOther": false,
        "allowNone": false
      },
      "sort": 22,
      "width": "half",
      "note": "Валюта зарплаты (по умолчанию UZS)."
    }
  }' "vacancy.salaryCurrency"
fi

patch_field "vacancy" "description_html" '{
    "type": "text",
    "meta": {
      "interface": "input-rich-text-html",
      "options": {
        "toolbar": [
          "bold",
          "italic",
          "underline",
          "h3",
          "h4",
          "bullist",
          "numlist",
          "link",
          "removeformat",
          "source"
        ]
      },
      "sort": 30,
      "width": "full",
      "note": "Описание вакансии в HTML — публикуется на hh.uz без изменений (минимум 200 символов)."
    }
  }' "vacancy.description_html"

patch_field "vacancy" "contact_phone" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "options": {
        "iconLeft": "phone",
        "placeholder": "+998 71 123 45 67"
      },
      "sort": 40,
      "width": "half",
      "note": "Контактный телефон работодателя (передаётся в payload публикации hh.uz)."
    }
  }' "vacancy.contact_phone"

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
