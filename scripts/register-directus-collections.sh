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

patch_collection() {
  local collection="$1"
  local payload="$2"
  local label="$3"

  echo -n "Configuring '$label' collection... "
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    "$DIRECTUS_URL/collections/$collection" \
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

patch_collection "company_hh_account" '{
    "meta": {
      "hidden": false,
      "singleton": false,
      "icon": "person",
      "note": "hh.uz OAuth аккаунты, привязанные к конкретным пользователям. Название таблицы legacy: company_hh_account.",
      "display_template": "{{email}} — {{employerId}}"
    }
  }' "user hh.uz accounts"

patch_collection "company_telegram_channel" '{
    "meta": {
      "hidden": false,
      "singleton": false,
      "icon": "send",
      "note": "Telegram каналы, привязанные к конкретным пользователям. Название таблицы legacy: company_telegram_channel.",
      "display_template": "{{channelId}}"
    }
  }' "user Telegram channels"

patch_collection "vacancy_telegram_post" '{
    "meta": {
      "hidden": false,
      "singleton": false,
      "icon": "mark_chat_read",
      "note": "Отправленные Telegram публикации. channel_id ссылается на Telegram канал пользователя и может быть пустым, если канал удалён.",
      "display_template": "{{message_url}}"
    }
  }' "vacancy Telegram posts"

configure_hash_field "user" "password" "user.password as hash field"

patch_field "company_hh_account" "userId" '{
    "type": "string",
    "meta": {
      "special": ["m2o"],
      "interface": "select-dropdown-m2o",
      "display": "related-values",
      "display_options": {
        "template": "{{email}}"
      },
      "sort": 1,
      "width": "half",
      "note": "Владелец hh.uz аккаунта. Интеграция принадлежит пользователю, не компании."
    }
  }' "company_hh_account.userId"

upsert_relation "company_hh_account" "userId" '{
    "collection": "company_hh_account",
    "field": "userId",
    "related_collection": "user",
    "schema": {
      "table": "company_hh_account",
      "column": "userId",
      "foreign_key_table": "user",
      "foreign_key_column": "id",
      "constraint_name": "company_hh_account_userId_user_id_fk"
    },
    "meta": {
      "many_collection": "company_hh_account",
      "many_field": "userId",
      "one_collection": "user",
      "one_field": null
    }
  }' "company_hh_account.userId"

patch_field "company_hh_account" "clientId" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "sort": 2,
      "width": "half",
      "note": "Legacy поле. Сейчас OAuth client ID берётся из серверных переменных окружения."
    }
  }' "company_hh_account.clientId"

patch_field "company_hh_account" "clientSecret" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "options": {
        "masked": true
      },
      "sort": 3,
      "width": "half",
      "note": "Legacy поле. Сейчас OAuth client secret берётся из серверных переменных окружения."
    }
  }' "company_hh_account.clientSecret"

patch_field "company_hh_account" "email" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "sort": 4,
      "width": "half",
      "note": "Email подключенного hh.uz пользователя."
    }
  }' "company_hh_account.email"

patch_field "company_hh_account" "employerId" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "sort": 5,
      "width": "half",
      "note": "Employer ID, полученный от hh.uz для этого пользователя."
    }
  }' "company_hh_account.employerId"

patch_field "company_hh_account" "accessToken" '{
    "type": "text",
    "meta": {
      "interface": "input-multiline",
      "options": {
        "masked": true
      },
      "sort": 6,
      "width": "full",
      "note": "Access token пользователя для hh.uz."
    }
  }' "company_hh_account.accessToken"

patch_field "company_hh_account" "refreshToken" '{
    "type": "text",
    "meta": {
      "interface": "input-multiline",
      "options": {
        "masked": true
      },
      "sort": 7,
      "width": "full",
      "note": "Refresh token пользователя для hh.uz."
    }
  }' "company_hh_account.refreshToken"

patch_field "company_telegram_channel" "userId" '{
    "type": "string",
    "meta": {
      "special": ["m2o"],
      "interface": "select-dropdown-m2o",
      "display": "related-values",
      "display_options": {
        "template": "{{email}}"
      },
      "sort": 1,
      "width": "half",
      "note": "Владелец Telegram канала. Канал принадлежит пользователю, не компании."
    }
  }' "company_telegram_channel.userId"

upsert_relation "company_telegram_channel" "userId" '{
    "collection": "company_telegram_channel",
    "field": "userId",
    "related_collection": "user",
    "schema": {
      "table": "company_telegram_channel",
      "column": "userId",
      "foreign_key_table": "user",
      "foreign_key_column": "id",
      "constraint_name": "company_telegram_channel_userId_user_id_fk"
    },
    "meta": {
      "many_collection": "company_telegram_channel",
      "many_field": "userId",
      "one_collection": "user",
      "one_field": null
    }
  }' "company_telegram_channel.userId"

patch_field "company_telegram_channel" "channelId" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "options": {
        "placeholder": "@channelname или -1001234567890"
      },
      "sort": 2,
      "width": "half",
      "note": "Telegram chat/channel ID для публикации вакансий от имени пользователя."
    }
  }' "company_telegram_channel.channelId"

patch_field "company_telegram_channel" "label" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "sort": 3,
      "width": "half",
      "note": "Понятное название канала в интерфейсе."
    }
  }' "company_telegram_channel.label"

patch_field "vacancy_telegram_post" "channel_id" '{
    "type": "string",
    "meta": {
      "special": ["m2o"],
      "interface": "select-dropdown-m2o",
      "display": "related-values",
      "display_options": {
        "template": "{{channelId}}"
      },
      "sort": 2,
      "width": "half",
      "note": "Telegram канал пользователя, куда было отправлено сообщение. Может быть пустым после удаления канала."
    }
  }' "vacancy_telegram_post.channel_id"

upsert_relation "vacancy_telegram_post" "channel_id" '{
    "collection": "vacancy_telegram_post",
    "field": "channel_id",
    "related_collection": "company_telegram_channel",
    "schema": {
      "table": "vacancy_telegram_post",
      "column": "channel_id",
      "foreign_key_table": "company_telegram_channel",
      "foreign_key_column": "id",
      "constraint_name": "vacancy_telegram_post_channel_id_user_telegram_channel_id_fk"
    },
    "meta": {
      "many_collection": "vacancy_telegram_post",
      "many_field": "channel_id",
      "one_collection": "company_telegram_channel",
      "one_field": null
    }
  }' "vacancy_telegram_post.channel_id"

patch_field "vacancy" "is_active" '{
    "type": "boolean",
    "meta": {
      "interface": "boolean",
      "sort": 46,
      "width": "half",
      "note": "Активна ли строка выбранного канала."
    }
  }' "vacancy.is_active"

patch_field "vacancy" "destination" '{
    "type": "string",
    "meta": {
      "interface": "select-dropdown",
      "options": {
        "choices": [
          { "text": "LinkedIn", "value": "linkedin" },
          { "text": "hh.uz", "value": "hh.uz" },
          { "text": "Telegram", "value": "telegram" }
        ],
        "allowOther": false,
        "allowNone": true
      },
      "sort": 47,
      "width": "half",
      "note": "Целевой канал. Null для базовых вакансий."
    }
  }' "vacancy.destination"

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
  "$(build_lookup_payload "$HH_LOOKUPS_DIR/billing.json" 15 "half" "Тип размещения hh.uz (billingTypeId).")" \
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
      "note": "Описание вакансии в HTML — отправляется на hh.uz без изменений (минимум 200 символов)."
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
      "note": "Контактный телефон работодателя (передаётся в payload hh.uz)."
    }
  }' "vacancy.contact_phone"

echo ""
echo "Done! All tables should now be visible at $DIRECTUS_URL/admin/content"
