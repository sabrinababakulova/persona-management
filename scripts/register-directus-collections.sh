#!/usr/bin/env bash
# Register all app tables in Directus admin panel so they're visible in the Content module.
# Excludes directus_* internal tables.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

set -a
source "$REPO_ROOT/.env"

# Authenticate and get access token
AUTH_RESPONSE=$(curl -s -X POST "$DIRECTUS_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$DIRECTUS_ADMIN_EMAIL\", \"password\": \"$DIRECTUS_ADMIN_PASSWORD\"}")

# Parse the token defensively: a failed login returns an `errors` array (no `data`), so reach
# into the payload without assuming the happy-path shape and surface the API error message.
TOKEN=$(printf '%s' "$AUTH_RESPONSE" | python3 -c "
import sys, json
try:
    payload = json.load(sys.stdin)
except (json.JSONDecodeError, ValueError):
    sys.exit(0)
token = (payload.get('data') or {}).get('access_token')
if token:
    print(token)
")

if [ -z "$TOKEN" ]; then
  echo "Failed to authenticate with Directus at $DIRECTUS_URL as $DIRECTUS_ADMIN_EMAIL."
  printf '%s' "$AUTH_RESPONSE" | python3 -c "
import sys, json
try:
    payload = json.load(sys.stdin)
except (json.JSONDecodeError, ValueError):
    print('Directus says: non-JSON response.')
    sys.exit(0)
errors = payload.get('errors') or []
if errors:
    print('Directus says: ' + '; '.join(str(e.get('message', e)) for e in errors))
else:
    print('Directus says: response did not contain an access token.')
"
  echo "Check DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD in .env."
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

database_table_exists() {
  local table="$1"
  local exists

  exists=$(psql "$DATABASE_URL" -t -A -c "SELECT to_regclass('public.$table') IS NOT NULL;" 2>/dev/null || true)
  [ "$exists" = "t" ]
}

database_column_exists() {
  local table="$1"
  local column="$2"
  local exists

  exists=$(psql "$DATABASE_URL" -t -A -c "SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '$table' AND column_name = '$column');" 2>/dev/null || true)
  [ "$exists" = "t" ]
}

delete_directus_metadata_if_present() {
  local path="$1"
  local label="$2"
  local status

  echo -n "Removing deprecated '$label' metadata... "
  status=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE \
    "$DIRECTUS_URL$path" \
    -H "Authorization: Bearer $TOKEN")

  case "$status" in
    204)
      echo "REMOVED"
      ;;
    403|404)
      # Directus returns 403 for some already-orphaned metadata paths.
      echo "NOT_PRESENT"
      ;;
    *)
      echo "HTTP $status"
      return 1
      ;;
  esac
}

cleanup_deprecated_vacancy_publication_metadata() {
  echo ""
  echo "Cleaning deprecated vacancy publication metadata..."

  # This alias used to render the removed vacancy_publication table on every
  # vacancy item page. Once the table is gone, Directus' list-o2m interface
  # crashes and turns the whole item page into a 404.
  delete_directus_metadata_if_present \
    "/fields/vacancy/publications" \
    "vacancy.publications"

  if database_table_exists "vacancy_publication"; then
    # Some servers still contain legacy publication data. Deleting a Directus
    # collection with a physical schema can drop that table, so preserve the
    # data and only hide the deprecated collection from the Content module.
    patch_collection "vacancy_publication" '{
        "meta": {
          "hidden": true,
          "note": "DEPRECATED — сохранено только для совместимости. Публикации теперь находятся в vacancy."
        }
      }' "deprecated vacancy publications"
    echo "Preserved physical vacancy_publication table."
    return
  fi

  # With no physical table, the collection row and relation are metadata-only
  # leftovers. Removing them matches Directus' clean state without touching
  # application data.
  delete_directus_metadata_if_present \
    "/collections/vacancy_publication" \
    "vacancy_publication collection"

  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
    "DELETE FROM directus_relations
     WHERE many_collection = 'vacancy_publication'
       AND many_field = 'vacancy_id';"
  echo "Removed orphaned vacancy_publication relation metadata."
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

configure_readonly_collection_permissions() {
  local collection="$1"
  local label="$2"

  echo -n "Configuring read-only permissions for '$label'... "

  if DIRECTUS_URL="$DIRECTUS_URL" DIRECTUS_TOKEN="$TOKEN" COLLECTION="$collection" python3 <<'PYEOF'
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = os.environ["DIRECTUS_URL"].rstrip("/")
TOKEN = os.environ["DIRECTUS_TOKEN"]
COLLECTION = os.environ["COLLECTION"]

READ_ACTION = "read"
WRITE_ACTIONS = {"create", "update", "delete"}

def request(method, path, payload=None):
    data = None
    headers = {"Authorization": f"Bearer {TOKEN}"}
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(
        f"{BASE_URL}{path}",
        data=data,
        headers=headers,
        method=method,
    )

    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            body = response.read()
            if not body:
                return {}
            return json.loads(body)
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"{method} {path} failed with HTTP {error.code}: {body}"
        ) from error

def data_list(payload):
    data = payload.get("data", [])
    return data if isinstance(data, list) else []

def get_all(path):
    separator = "&" if "?" in path else "?"
    return data_list(request("GET", f"{path}{separator}limit=-1"))

def try_get_all(path):
    try:
        return get_all(path)
    except Exception:
        return []

def is_public_policy(policy):
    name = str(policy.get("name", "")).lower()
    return name in {"public", "$t:public_label", "administrator"}

def is_non_admin_policy(policy):
    return bool(policy and policy.get("id") and not policy.get("admin_access") and not is_public_policy(policy))

def upsert_permission(identity_key, identity_id, existing_permissions):
    read_permission = next(
        (
            permission
            for permission in existing_permissions
            if permission.get(identity_key) == identity_id
            and permission.get("collection") == COLLECTION
            and permission.get("action") == READ_ACTION
        ),
        None,
    )
    base_payload = {
        identity_key: identity_id,
        "collection": COLLECTION,
        "action": READ_ACTION,
        "permissions": {},
        "fields": ["*"],
    }

    payload_variants = [
        {**base_payload, "validation": {}, "presets": None},
        {**base_payload, "validation": {}, "presets": {}},
        base_payload,
    ]

    path = f"/permissions/{read_permission['id']}" if read_permission else "/permissions"
    method = "PATCH" if read_permission else "POST"
    last_error = None
    for payload in payload_variants:
        try:
            request(method, path, payload)
            return
        except RuntimeError as error:
            last_error = error

    raise last_error

def delete_write_permissions(identity_key, identity_ids, existing_permissions):
    for permission in existing_permissions:
        if permission.get("collection") != COLLECTION:
            continue
        if permission.get("action") not in WRITE_ACTIONS:
            continue
        if permission.get(identity_key) not in identity_ids:
            continue
        try:
            request("DELETE", f"/permissions/{permission['id']}")
        except RuntimeError as error:
            print(error, file=sys.stderr)

policies = try_get_all("/policies")
policy_by_id = {policy["id"]: policy for policy in policies if policy.get("id")}
access_rows = try_get_all("/access")
access_by_id = {access["id"]: access for access in access_rows if access.get("id")}
permissions = get_all("/permissions")

if policies:
    roles = try_get_all("/roles")
    admin_role_ids = {
        access.get("role")
        for access in access_rows
        if access.get("role")
        and policy_by_id.get(access.get("policy"), {}).get("admin_access")
    }
    role_ids = {
        role["id"]
        for role in roles
        if role.get("id")
        and role.get("name") != "Administrator"
        and role.get("id") not in admin_role_ids
    }

    policy_ids = set()
    for access in access_rows:
        policy_id = access.get("policy")
        policy = policy_by_id.get(policy_id)
        if policy_id and is_non_admin_policy(policy) and (
            access.get("role") in role_ids or access.get("user")
        ):
            policy_ids.add(policy_id)

    for role in roles:
        if role.get("id") not in role_ids:
            continue
        for related in role.get("policies") or []:
            related_id = related.get("id") if isinstance(related, dict) else related
            access_policy_id = access_by_id.get(related_id, {}).get("policy")
            policy_id = access_policy_id or related_id
            if is_non_admin_policy(policy_by_id.get(policy_id)):
                policy_ids.add(policy_id)

    if not policy_ids:
        policy_ids = {
            policy["id"]
            for policy in policies
            if is_non_admin_policy(policy)
        }

    for policy_id in policy_ids:
        upsert_permission("policy", policy_id, permissions)
    delete_write_permissions("policy", set(policy_ids), get_all("/permissions"))
else:
    roles = [
        role
        for role in try_get_all("/roles")
        if role.get("id") and role.get("name") != "Administrator"
    ]
    role_ids = [role["id"] for role in roles]
    for role_id in role_ids:
        upsert_permission("role", role_id, permissions)
    delete_write_permissions("role", set(role_ids), get_all("/permissions"))
PYEOF
  then
    echo "OK"
  else
    echo "FAILED"
  fi
}

if [ "${1:-}" = "--cleanup-only" ]; then
  cleanup_deprecated_vacancy_publication_metadata
  exit 0
fi

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

cleanup_deprecated_vacancy_publication_metadata

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

# Company role. Normally assigned in-app by the master account (Настройки компании → Команда);
# Directus is the fallback for repairs. A company may have any number of admins — only the
# master account (isMasterAccount) is unique, and it outranks the role regardless of its value.
if database_column_exists "user" "role"; then
  patch_field "user" "role" '{
      "type": "string",
      "meta": {
        "interface": "select-dropdown",
        "options": {
          "choices": [
            { "text": "Администратор компании", "value": "admin" },
            { "text": "Сотрудник", "value": "member" }
          ],
          "allowOther": false,
          "allowNone": false
        },
        "width": "half",
        "note": "Роль в компании: администратор редактирует данные компании и приглашает коллег, сотрудник только просматривает. Обычно назначается владельцем компании в интерфейсе. Администраторов может быть несколько; владелец (isMasterAccount) всегда обладает полными правами."
      }
    }' "user.role"
else
  echo "Skipping 'user.role' Directus metadata: column is missing. Run 'bun run db:migrate-custom' first."
fi

# Master account: set once by registration for whoever created the company. Read-only on
# purpose — unlike `role` it records a fact about the past, so it must not be handed over.
if database_column_exists "user" "isMasterAccount"; then
  patch_field "user" "isMasterAccount" '{
      "type": "boolean",
      "meta": {
        "interface": "boolean",
        "options": {
          "label": "Создатель компании"
        },
        "display": "boolean",
        "readonly": true,
        "width": "half",
        "note": "Мастер-аккаунт: этот пользователь создал компанию при регистрации. Поле только для чтения — роль можно передать, признак создателя нет."
      }
    }' "user.isMasterAccount"
else
  echo "Skipping 'user.isMasterAccount' Directus metadata: column is missing. Run 'bun run db:migrate-custom' first."
fi

# Deactivation timestamp. The master account sets it by removing someone from the company;
# a deactivated user keeps their row but cannot sign in anywhere. Editable here so support can
# restore access by clearing the value.
if database_column_exists "user" "deactivatedAt"; then
  patch_field "user" "deactivatedAt" '{
      "type": "timestamp",
      "meta": {
        "interface": "datetime",
        "display": "datetime",
        "width": "half",
        "note": "Дата отключения доступа. Пусто — пользователь активен. Заполняется, когда владелец компании удаляет участника: аккаунт сохраняется, но вход в систему блокируется. Очистите поле, чтобы вернуть доступ."
      }
    }' "user.deactivatedAt"
else
  echo "Skipping 'user.deactivatedAt' Directus metadata: column is missing. Run 'bun run db:migrate-custom' first."
fi

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

if database_table_exists "ai_usage_log" && database_column_exists "ai_usage_log" "total_cost_usd"; then
patch_collection "ai_usage_log" '{
    "meta": {
      "hidden": false,
      "singleton": false,
      "icon": "query_stats",
      "note": "Read-only log of Gemini/Mastra token usage per AI request."
    }
  }' "ai_usage_log"

patch_field "ai_usage_log" "id" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 1,
      "width": "half",
      "note": "Internal log id."
    }
  }' "ai_usage_log.id"

patch_field "ai_usage_log" "created_at" '{
    "type": "timestamp",
    "meta": {
      "interface": "datetime",
      "readonly": true,
      "sort": 2,
      "width": "half",
      "note": "When the AI request finished."
    }
  }' "ai_usage_log.created_at"

patch_field "ai_usage_log" "user_id" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 3,
      "width": "half",
      "note": "User that triggered the AI request."
    }
  }' "ai_usage_log.user_id"

patch_field "ai_usage_log" "company_id" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 4,
      "width": "half",
      "note": "Company scope for the AI request."
    }
  }' "ai_usage_log.company_id"

patch_field "ai_usage_log" "candidate_id" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 5,
      "width": "half",
      "note": "Candidate or imported hh.uz resume related to the request."
    }
  }' "ai_usage_log.candidate_id"

patch_field "ai_usage_log" "provider" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 6,
      "width": "half"
    }
  }' "ai_usage_log.provider"

patch_field "ai_usage_log" "model" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 7,
      "width": "half"
    }
  }' "ai_usage_log.model"

patch_field "ai_usage_log" "agent" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 8,
      "width": "half"
    }
  }' "ai_usage_log.agent"

patch_field "ai_usage_log" "operation" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 9,
      "width": "half"
    }
  }' "ai_usage_log.operation"

patch_field "ai_usage_log" "status" '{
    "type": "string",
    "meta": {
      "interface": "select-dropdown",
      "options": {
        "choices": [
          { "text": "Success", "value": "success" },
          { "text": "Failed", "value": "failed" }
        ],
        "allowOther": false,
        "allowNone": false
      },
      "readonly": true,
      "sort": 10,
      "width": "half"
    }
  }' "ai_usage_log.status"

patch_field "ai_usage_log" "input_tokens" '{
    "type": "integer",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 11,
      "width": "half",
      "note": "Prompt/input tokens."
    }
  }' "ai_usage_log.input_tokens"

patch_field "ai_usage_log" "output_tokens" '{
    "type": "integer",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 12,
      "width": "half",
      "note": "Generated response tokens."
    }
  }' "ai_usage_log.output_tokens"

patch_field "ai_usage_log" "total_tokens" '{
    "type": "integer",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 13,
      "width": "half",
      "note": "Total tokens reported by the model/provider."
    }
  }' "ai_usage_log.total_tokens"

patch_field "ai_usage_log" "reasoning_tokens" '{
    "type": "integer",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 14,
      "width": "half",
      "note": "Thinking/reasoning tokens when exposed for Gemini 2.5."
    }
  }' "ai_usage_log.reasoning_tokens"

patch_field "ai_usage_log" "cached_input_tokens" '{
    "type": "integer",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 15,
      "width": "half",
      "note": "Cached input tokens when provider reports cache usage."
    }
  }' "ai_usage_log.cached_input_tokens"

patch_field "ai_usage_log" "input_rate_usd_per_million" '{
    "type": "decimal",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 16,
      "width": "half",
      "note": "USD rate per 1M input tokens used for this estimate."
    }
  }' "ai_usage_log.input_rate_usd_per_million"

patch_field "ai_usage_log" "output_rate_usd_per_million" '{
    "type": "decimal",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 17,
      "width": "half",
      "note": "USD rate per 1M output tokens used for this estimate."
    }
  }' "ai_usage_log.output_rate_usd_per_million"

patch_field "ai_usage_log" "input_cost_usd" '{
    "type": "decimal",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 18,
      "width": "half",
      "note": "Estimated USD cost for input tokens."
    }
  }' "ai_usage_log.input_cost_usd"

patch_field "ai_usage_log" "output_cost_usd" '{
    "type": "decimal",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 19,
      "width": "half",
      "note": "Estimated USD cost for output and reasoning tokens."
    }
  }' "ai_usage_log.output_cost_usd"

patch_field "ai_usage_log" "total_cost_usd" '{
    "type": "decimal",
    "meta": {
      "interface": "input",
      "readonly": true,
      "sort": 20,
      "width": "half",
      "note": "Estimated total USD cost for the AI request."
    }
  }' "ai_usage_log.total_cost_usd"

patch_field "ai_usage_log" "error_message" '{
    "type": "text",
    "meta": {
      "interface": "input-multiline",
      "readonly": true,
      "sort": 21,
      "width": "full",
      "note": "Failure reason when the AI request did not complete successfully."
    }
  }' "ai_usage_log.error_message"

configure_readonly_collection_permissions "ai_usage_log" "ai_usage_log"
else
  echo "Skipping 'ai_usage_log' Directus metadata: database table or cost columns are missing. Run 'bun run db:migrate-custom' first."
fi

# Per-application AI match score (0–100), written by the candidateVacancyMatch
# agent during enrichment. Surface it in Directus so admins can audit, sort, or
# override the value — the enrichment worker will re-write it on the next run.
patch_field "vacancy_candidate" "match_score" '{
    "type": "integer",
    "meta": {
      "interface": "input",
      "options": {
        "min": 0,
        "max": 100,
        "iconLeft": "trending_up"
      },
      "sort": 10,
      "width": "half",
      "note": "0–100 оценка соответствия кандидата вакансии от AI-агента candidateVacancyMatch. Перезаписывается при следующем прогоне воркера обогащения."
    }
  }' "vacancy_candidate.match_score"

patch_field "vacancy" "is_active" '{
    "type": "boolean",
    "meta": {
      "interface": "boolean",
      "sort": 46,
      "width": "half",
      "note": "Активна ли строка выбранного канала."
    }
  }' "vacancy.is_active"

patch_field "vacancy" "is_internal" '{
    "type": "boolean",
    "meta": {
      "interface": "boolean",
      "readonly": true,
      "sort": 47,
      "width": "half",
      "note": "Системная вакансия: видна в Directus, но скрыта в основном приложении."
    }
  }' "vacancy.is_internal"

patch_field "vacancy" "system_key" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "readonly": true,
      "hidden": true,
      "sort": 48,
      "width": "half",
      "note": "Стабильный системный ключ внутренней вакансии. Управляется приложением."
    }
  }' "vacancy.system_key"

patch_field "vacancy" "destination" '{
    "type": "string",
    "meta": {
      "interface": "select-dropdown",
      "options": {
        "choices": [
          { "text": "LinkedIn", "value": "linkedin" },
          { "text": "hh.uz", "value": "hh.uz" },
          { "text": "Telegram", "value": "telegram" },
          { "text": "PersonHunters", "value": "person-hunter" }
        ],
        "allowOther": false,
        "allowNone": true
      },
      "sort": 48,
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

patch_field "vacancy" "person_hunter_vacancy_id" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "sort": 51,
      "width": "half",
      "note": "ID вакансии на PersonHunters, проставляется после публикации."
    }
  }' "vacancy.person_hunter_vacancy_id"

# PersonHunters-specific publication fields (duties, requirements, conditions, the selected
# reference ids, employment/schedule, experience range) that have no dedicated vacancy column.
# Stored as a single JSON blob so the PersonHunters publish form can be re-populated when editing.
patch_field "vacancy" "person_hunter_meta" '{
    "type": "json",
    "meta": {
      "interface": "input-code",
      "options": {
        "language": "json"
      },
      "sort": 52,
      "width": "full",
      "note": "Поля публикации PersonHunters (обязанности, требования, условия, выбранные справочники, занятость/график, опыт), которых нет в отдельных колонках вакансии."
    }
  }' "vacancy.person_hunter_meta"

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

# ── Company feature flags ─────────────────────────────────────────────
# Per-company toggles read by the app on every gated request. A feature is ON
# when a row exists with is_enabled = true; delete the row or untick the
# checkbox to turn it off. Managed here in Directus only.

patch_collection "company_feature_flag" '{
    "meta": {
      "hidden": false,
      "singleton": false,
      "icon": "flag",
      "note": "Фичи, включённые для компании. Строка с галочкой = функция доступна. resume_design.<ключ> открывает фирменный шаблон резюме.",
      "display_template": "{{feature}}"
    }
  }' "company feature flags"

patch_field "company_feature_flag" "company_id" '{
    "type": "string",
    "meta": {
      "special": ["m2o"],
      "interface": "select-dropdown-m2o",
      "display": "related-values",
      "display_options": {
        "template": "{{name}}"
      },
      "sort": 1,
      "width": "half",
      "note": "Компания, которой открыта функция."
    }
  }' "company_feature_flag.company_id"

upsert_relation "company_feature_flag" "company_id" '{
    "collection": "company_feature_flag",
    "field": "company_id",
    "related_collection": "company",
    "schema": {
      "table": "company_feature_flag",
      "column": "company_id",
      "foreign_key_table": "company",
      "foreign_key_column": "id",
      "constraint_name": "company_feature_flag_company_id_company_id_fk"
    },
    "meta": {
      "many_collection": "company_feature_flag",
      "many_field": "company_id",
      "one_collection": "company",
      "one_field": null
    }
  }' "company_feature_flag.company_id"

patch_field "company_feature_flag" "feature" '{
    "type": "string",
    "meta": {
      "interface": "select-dropdown",
      "options": {
        "choices": [
          { "text": "Склад кандидатов из Telegram", "value": "telegram_resume_warehouse" },
          { "text": "Публикации на PersonHunters", "value": "person_hunter_publications" },
          { "text": "Шаблон резюме Person Hunters", "value": "resume_design.person-hunters" }
        ],
        "allowOther": true
      },
      "sort": 2,
      "width": "half",
      "note": "Ключ функции. Новые шаблоны резюме добавляются как resume_design.<ключ>."
    }
  }' "company_feature_flag.feature"

patch_field "company_feature_flag" "is_enabled" '{
    "type": "boolean",
    "meta": {
      "interface": "boolean",
      "display": "boolean",
      "sort": 3,
      "width": "half",
      "note": "Снимите галочку, чтобы временно выключить функцию, не удаляя строку."
    }
  }' "company_feature_flag.is_enabled"

# ── Company Telegram resume ingestion config ──────────────────────────
# One row per company: its Telegram group and its internal warehouse vacancy.
# The bot webhook routes incoming resumes to a company by the chat they were
# posted in. Activation is governed by the telegram_resume_warehouse flag.

patch_collection "company_telegram_resume_config" '{
    "meta": {
      "hidden": false,
      "singleton": false,
      "icon": "move_to_inbox",
      "note": "Приём резюме из Telegram: группа компании и её внутренняя вакансия-склад. Включается флагом telegram_resume_warehouse.",
      "display_template": "{{chat_id}}"
    }
  }' "company telegram resume configs"

patch_field "company_telegram_resume_config" "company_id" '{
    "type": "string",
    "meta": {
      "special": ["m2o"],
      "interface": "select-dropdown-m2o",
      "display": "related-values",
      "display_options": {
        "template": "{{name}}"
      },
      "sort": 1,
      "width": "half",
      "note": "Компания, которой принадлежит группа и склад."
    }
  }' "company_telegram_resume_config.company_id"

upsert_relation "company_telegram_resume_config" "company_id" '{
    "collection": "company_telegram_resume_config",
    "field": "company_id",
    "related_collection": "company",
    "schema": {
      "table": "company_telegram_resume_config",
      "column": "company_id",
      "foreign_key_table": "company",
      "foreign_key_column": "id",
      "constraint_name": "company_telegram_resume_config_company_id_company_id_fk"
    },
    "meta": {
      "many_collection": "company_telegram_resume_config",
      "many_field": "company_id",
      "one_collection": "company",
      "one_field": null
    }
  }' "company_telegram_resume_config.company_id"

patch_field "company_telegram_resume_config" "chat_id" '{
    "type": "string",
    "meta": {
      "interface": "input",
      "options": {
        "placeholder": "-4910953100"
      },
      "sort": 2,
      "width": "half",
      "note": "ID Telegram-группы, куда присылают резюме (бот должен быть участником)."
    }
  }' "company_telegram_resume_config.chat_id"

patch_field "company_telegram_resume_config" "warehouse_vacancy_id" '{
    "type": "string",
    "meta": {
      "special": ["m2o"],
      "interface": "select-dropdown-m2o",
      "display": "related-values",
      "display_options": {
        "template": "{{title}}"
      },
      "sort": 3,
      "width": "full",
      "note": "Внутренняя вакансия-склад этой же компании (is_internal = true), куда попадают кандидаты из группы."
    }
  }' "company_telegram_resume_config.warehouse_vacancy_id"

upsert_relation "company_telegram_resume_config" "warehouse_vacancy_id" '{
    "collection": "company_telegram_resume_config",
    "field": "warehouse_vacancy_id",
    "related_collection": "vacancy",
    "schema": {
      "table": "company_telegram_resume_config",
      "column": "warehouse_vacancy_id",
      "foreign_key_table": "vacancy",
      "foreign_key_column": "id",
      "constraint_name": "company_telegram_resume_config_warehouse_vacancy_id_vacancy_id_fk"
    },
    "meta": {
      "many_collection": "company_telegram_resume_config",
      "many_field": "warehouse_vacancy_id",
      "one_collection": "vacancy",
      "one_field": null
    }
  }' "company_telegram_resume_config.warehouse_vacancy_id"

echo ""
echo "Done! All tables should now be visible at $DIRECTUS_URL/admin/content"
