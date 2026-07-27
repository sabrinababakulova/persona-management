#!/usr/bin/env bash
set -euo pipefail

# Apply the Talanty identity to Directus using its supported project branding
# and theme settings APIs. The script is safe to rerun: it replaces the three
# managed brand assets and removes the superseded copies after settings update.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

DIRECTUS_BRANDING_URL="${DIRECTUS_ADMIN_URL:-${DIRECTUS_URL:-http://127.0.0.1:8055}}"
DIRECTUS_BRANDING_URL="${DIRECTUS_BRANDING_URL%/}"

: "${DIRECTUS_ADMIN_EMAIL:?DIRECTUS_ADMIN_EMAIL must be set}"
: "${DIRECTUS_ADMIN_PASSWORD:?DIRECTUS_ADMIN_PASSWORD must be set}"

for command in curl python3; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command is not installed: $command" >&2
    exit 1
  fi
done

HERO_PATH="$REPO_ROOT/public/talanty-hero.png"
LOGO_PATH="$REPO_ROOT/public/talanty-logo.svg"
MARK_PATH="$REPO_ROOT/public/talanty-mark.svg"
THEME_CSS_PATH="$REPO_ROOT/directus/talanty-theme.css"

for asset in "$HERO_PATH" "$LOGO_PATH" "$MARK_PATH" "$THEME_CSS_PATH"; do
  if [ ! -f "$asset" ]; then
    echo "Required Talanty branding file is missing: $asset" >&2
    exit 1
  fi
done

AUTH_PAYLOAD=$(
  DIRECTUS_AUTH_EMAIL="$DIRECTUS_ADMIN_EMAIL" \
    DIRECTUS_AUTH_PASSWORD="$DIRECTUS_ADMIN_PASSWORD" \
    python3 - <<'PY'
import json
import os

print(json.dumps({
    "email": os.environ["DIRECTUS_AUTH_EMAIL"],
    "password": os.environ["DIRECTUS_AUTH_PASSWORD"],
}))
PY
)

AUTH_RESPONSE=$(curl --fail-with-body --silent --show-error \
  -X POST "$DIRECTUS_BRANDING_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "$AUTH_PAYLOAD")

TOKEN=$(
  printf '%s' "$AUTH_RESPONSE" | python3 -c '
import json
import sys

payload = json.load(sys.stdin)
print((payload.get("data") or {}).get("access_token") or "")
'
)

if [ -z "$TOKEN" ]; then
  echo "Directus authentication succeeded without returning an access token." >&2
  exit 1
fi

BRANDING_APPLIED=0
NEW_ASSET_IDS_FILE=$(mktemp)
SETTINGS_RESPONSE_FILE=$(mktemp)

cleanup() {
  if [ "$BRANDING_APPLIED" -eq 0 ] && [ -s "$NEW_ASSET_IDS_FILE" ]; then
    while IFS= read -r asset_id; do
      curl --silent --output /dev/null \
        -X DELETE "$DIRECTUS_BRANDING_URL/files/$asset_id" \
        -H "Authorization: Bearer $TOKEN" || true
    done <"$NEW_ASSET_IDS_FILE"
  fi

  rm -f "$NEW_ASSET_IDS_FILE" "$SETTINGS_RESPONSE_FILE"
}

trap cleanup EXIT

find_managed_assets() {
  local title="$1"

  curl --fail-with-body --silent --show-error --get \
    "$DIRECTUS_BRANDING_URL/files" \
    -H "Authorization: Bearer $TOKEN" \
    --data-urlencode "filter[title][_eq]=$title" \
    --data-urlencode "fields=id" \
    --data-urlencode "limit=-1" |
    python3 -c '
import json
import sys

payload = json.load(sys.stdin)
for item in payload.get("data") or []:
    asset_id = item.get("id")
    if asset_id:
        print(asset_id)
'
}

upload_managed_asset() {
  local path="$1"
  local title="$2"
  local response
  local asset_id

  response=$(curl --fail-with-body --silent --show-error \
    -X POST "$DIRECTUS_BRANDING_URL/files" \
    -H "Authorization: Bearer $TOKEN" \
    -F "title=$title" \
    -F "file=@$path")

  asset_id=$(
    printf '%s' "$response" | python3 -c '
import json
import sys

payload = json.load(sys.stdin)
print((payload.get("data") or {}).get("id") or "")
'
  )

  if [ -z "$asset_id" ]; then
    echo "Directus did not return an ID after uploading $path." >&2
    exit 1
  fi

  printf '%s\n' "$asset_id" >>"$NEW_ASSET_IDS_FILE"
  printf '%s' "$asset_id"
}

echo "Uploading Talanty brand assets to Directus..."
OLD_HERO_IDS=$(find_managed_assets "Talanty Directus Hero")
OLD_LOGO_IDS=$(find_managed_assets "Talanty Directus Logo")
OLD_MARK_IDS=$(find_managed_assets "Talanty Directus Mark")

HERO_ID=$(upload_managed_asset "$HERO_PATH" "Talanty Directus Hero")
LOGO_ID=$(upload_managed_asset "$LOGO_PATH" "Talanty Directus Logo")
MARK_ID=$(upload_managed_asset "$MARK_PATH" "Talanty Directus Mark")

SETTINGS_PAYLOAD=$(
  DIRECTUS_HERO_ID="$HERO_ID" \
    DIRECTUS_LOGO_ID="$LOGO_ID" \
    DIRECTUS_MARK_ID="$MARK_ID" \
    DIRECTUS_THEME_CSS_PATH="$THEME_CSS_PATH" \
    python3 - <<'PY'
import json
import os
from pathlib import Path

cream = "#FFF8EF"
ink = "#1C1A1E"
signal = "#FD372C"
violet = "#9575DE"

font_overrides = {
    "display": {
        "fontFamily": '"Bricolage Grotesque", "Inter", sans-serif',
        "fontWeight": "700",
    },
    "sans": {
        "fontFamily": '"Geist", "Inter", sans-serif',
        "fontWeight": "450",
    },
}

light_theme = {
    "borderRadius": "12px",
    "borderWidth": "1px",
    "backgroundPage": cream,
    "background": "#FFFFFF",
    "backgroundNormal": "#F7F0E8",
    "backgroundAccent": "#F1E8DE",
    "backgroundSubdued": "#FCF7F1",
    "foreground": ink,
    "foregroundAccent": "#111012",
    "foregroundSubdued": "#716964",
    "borderColor": "#E5DCD3",
    "borderColorAccent": "#D3C6BA",
    "borderColorSubdued": "#EFE7DF",
    "primary": signal,
    "primaryBackground": "color-mix(in srgb, #FFFFFF, #FD372C 10%)",
    "primarySubdued": "color-mix(in srgb, #FFFFFF, #FD372C 28%)",
    "primaryAccent": "#D92720",
    "secondary": violet,
    "secondaryBackground": "color-mix(in srgb, #FFFFFF, #9575DE 10%)",
    "secondarySubdued": "color-mix(in srgb, #FFFFFF, #9575DE 28%)",
    "secondaryAccent": "#7E5DC9",
    "navigation": {
        "background": ink,
        "backgroundAccent": "#2A272C",
        "borderColor": "#332F35",
        "modules": {
            "background": ink,
            "button": {
                "background": ink,
                "backgroundHover": "#2A272C",
                "backgroundActive": signal,
                "foreground": "#D8D0CA",
                "foregroundHover": "#FFFFFF",
                "foregroundActive": "#FFFFFF",
            },
        },
        "project": {
            "background": cream,
            "borderColor": "#3A353C",
            "borderWidth": "1px",
        },
        "list": {
            "icon": {"foreground": cream},
            "divider": {"borderColor": "#332F35"},
        },
    },
    "header": {
        "background": cream,
        "borderColor": "#E5DCD3",
        "borderWidth": "1px",
        "boxShadow": "0 8px 24px rgba(28, 26, 30, 0.06)",
    },
    "sidebar": {
        "background": "#FFFDF9",
        "borderColor": "#E5DCD3",
        "borderWidth": "1px",
    },
    "form": {
        "rowGap": "28px",
        "field": {
            "input": {
                "height": "52px",
                "background": "#FFFFFF",
                "backgroundSubdued": "#F7F0E8",
                "borderColor": "#D3C6BA",
                "borderColorHover": "#A89B8F",
                "borderColorFocus": signal,
                "boxShadowFocus": "0 0 0 3px rgba(253, 55, 44, 0.14)",
            },
            "label": {"foreground": ink},
        },
    },
    "public": {
        "background": cream,
        "art": {
            "background": violet,
            "primary": signal,
            "secondary": violet,
        },
    },
    "fonts": font_overrides,
}

dark_theme = {
    "borderRadius": "12px",
    "borderWidth": "1px",
    "backgroundPage": "#141315",
    "background": "#1C1A1E",
    "backgroundNormal": "#252227",
    "backgroundAccent": "#302C32",
    "backgroundSubdued": "#19171B",
    "foreground": "#FFF8EF",
    "foregroundAccent": "#FFFFFF",
    "foregroundSubdued": "#BDB3AB",
    "borderColor": "#3A353C",
    "borderColorAccent": "#514A54",
    "borderColorSubdued": "#2B282D",
    "primary": signal,
    "primaryBackground": "color-mix(in srgb, #1C1A1E, #FD372C 16%)",
    "primarySubdued": "color-mix(in srgb, #1C1A1E, #FD372C 38%)",
    "primaryAccent": "#FF6258",
    "secondary": violet,
    "secondaryBackground": "color-mix(in srgb, #1C1A1E, #9575DE 16%)",
    "secondarySubdued": "color-mix(in srgb, #1C1A1E, #9575DE 38%)",
    "secondaryAccent": "#B79AF4",
    "navigation": {
        "background": "#0E0D0F",
        "backgroundAccent": "#242126",
        "borderColor": "#302C32",
        "modules": {
            "background": "#0E0D0F",
            "button": {
                "background": "#0E0D0F",
                "backgroundHover": "#242126",
                "backgroundActive": signal,
                "foreground": "#D8D0CA",
                "foregroundHover": "#FFFFFF",
                "foregroundActive": "#FFFFFF",
            },
        },
        "project": {
            "background": cream,
            "borderColor": "#302C32",
            "borderWidth": "1px",
        },
        "list": {
            "icon": {"foreground": cream},
            "divider": {"borderColor": "#302C32"},
        },
    },
    "header": {
        "background": "#141315",
        "borderColor": "#3A353C",
        "borderWidth": "1px",
        "boxShadow": "0 8px 24px rgba(0, 0, 0, 0.16)",
    },
    "sidebar": {
        "background": "#19171B",
        "borderColor": "#3A353C",
        "borderWidth": "1px",
    },
    "form": {
        "rowGap": "28px",
        "field": {
            "input": {
                "height": "52px",
                "background": "#1C1A1E",
                "backgroundSubdued": "#252227",
                "borderColor": "#514A54",
                "borderColorHover": "#716974",
                "borderColorFocus": signal,
                "boxShadowFocus": "0 0 0 3px rgba(253, 55, 44, 0.2)",
            },
            "label": {"foreground": "#FFF8EF"},
        },
    },
    "public": {
        "background": cream,
        "art": {
            "background": violet,
            "primary": signal,
            "secondary": violet,
        },
    },
    "fonts": font_overrides,
}

payload = {
    "project_name": "Talanty",
    "project_descriptor": "Recruiting workspace",
    "project_url": "https://talanty.uz",
    "project_color": signal,
    "project_logo": os.environ["DIRECTUS_LOGO_ID"],
    "public_background": os.environ["DIRECTUS_HERO_ID"],
    "public_foreground": None,
    "public_favicon": os.environ["DIRECTUS_MARK_ID"],
    "public_note": "Recruiting, with momentum.  \n[talanty.uz](https://talanty.uz)",
    "default_appearance": "light",
    "default_theme_light": "Directus Minimal",
    "theme_light_overrides": light_theme,
    "theme_dark_overrides": dark_theme,
    "custom_css": Path(os.environ["DIRECTUS_THEME_CSS_PATH"]).read_text(),
}

print(json.dumps(payload))
PY
)

echo "Applying Talanty project and theme settings..."
SETTINGS_STATUS=$(curl --silent --show-error \
  --output "$SETTINGS_RESPONSE_FILE" \
  --write-out "%{http_code}" \
  -X PATCH "$DIRECTUS_BRANDING_URL/settings" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$SETTINGS_PAYLOAD")

if [ "$SETTINGS_STATUS" != "200" ]; then
  echo "Directus rejected the branding settings (HTTP $SETTINGS_STATUS)." >&2
  python3 - "$SETTINGS_RESPONSE_FILE" <<'PY' >&2
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
try:
    payload = json.loads(path.read_text())
except (OSError, json.JSONDecodeError):
    print("Directus returned an unreadable error response.")
    raise SystemExit(0)

messages = [
    str(error.get("message", error))
    for error in payload.get("errors") or []
]
print("; ".join(messages) or "Directus returned no error message.")
PY
  exit 1
fi

BRANDING_APPLIED=1

printf '%s\n%s\n%s\n' "$OLD_HERO_IDS" "$OLD_LOGO_IDS" "$OLD_MARK_IDS" |
while IFS= read -r old_asset_id; do
  if [ -n "$old_asset_id" ]; then
    curl --silent --output /dev/null \
      -X DELETE "$DIRECTUS_BRANDING_URL/files/$old_asset_id" \
      -H "Authorization: Bearer $TOKEN" || true
  fi
done

echo "Talanty Directus branding applied successfully."
