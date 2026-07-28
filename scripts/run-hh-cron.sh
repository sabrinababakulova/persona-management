#!/usr/bin/env bash
set -euo pipefail

run_hh_cron() {
  if [ "$#" -ne 3 ]; then
    echo "Usage: run_hh_cron <endpoint> <label> <max-seconds>" >&2
    return 2
  fi

  local endpoint="$1"
  local label="$2"
  local max_seconds="$3"
  local script_dir
  local project_dir
  local env_file
  local lock_dir
  local lock_file
  local response

  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  project_dir="${PERSONA_PROJECT_DIR:-$(cd "$script_dir/.." && pwd)}"
  env_file="${PERSONA_CRON_ENV_FILE:-$project_dir/.env}"

  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi

  if [ -z "${AUTH_SECRET:-}" ]; then
    echo "AUTH_SECRET is not set; cannot authorize $label" >&2
    return 1
  fi

  if ! [[ "$max_seconds" =~ ^[1-9][0-9]*$ ]]; then
    echo "Invalid timeout for $label: $max_seconds" >&2
    return 2
  fi

  PORT="${PORT:-3000}"
  if ! [[ "$PORT" =~ ^[0-9]{1,5}$ ]] || [ "$PORT" -gt 65535 ]; then
    echo "Invalid application port for $label: $PORT" >&2
    return 2
  fi

  lock_dir="${PERSONA_CRON_LOCK_DIR:-/var/lock/persona-management}"
  lock_file="$lock_dir/$label.lock"

  mkdir -p "$lock_dir"

  exec 9>"$lock_file"
  if ! flock -n 9; then
    printf '%s %s skipped: previous invocation is still running\n' \
      "$(date -Is)" "$label"
    return 0
  fi

  if ! response="$(
    printf 'Authorization: Bearer %s\n' "$AUTH_SECRET" |
      curl \
        --fail-with-body \
        --silent \
        --show-error \
        --connect-timeout "${HH_CRON_CONNECT_TIMEOUT_SECONDS:-5}" \
        --max-time "$max_seconds" \
        --header @- \
        "http://127.0.0.1:${PORT}/api/cron/${endpoint}" 2>&1
  )"; then
    printf '%s %s failed: %s\n' "$(date -Is)" "$label" "$response" >&2
    return 1
  fi

  printf '%s %s %s\n' "$(date -Is)" "$label" "$response"
}
