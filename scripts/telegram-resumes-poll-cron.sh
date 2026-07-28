#!/usr/bin/env bash
#
# Pulls new Telegram updates into PostgreSQL, then processes at most one resume.
# Installed once per minute by setup-telegram-resume-ingestion.ts.
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -z "${BUN_BIN:-}" ]] || [[ ! -x "$BUN_BIN" ]]; then
  echo "BUN_BIN is missing or not executable; rerun telegram:resume:setup" >&2
  exit 127
fi
if [[ -z "${TELEGRAM_RESUME_ENV_FILE:-}" ]] || \
  [[ ! -f "$TELEGRAM_RESUME_ENV_FILE" ]]; then
  echo "Telegram resume environment file is missing; rerun telegram:resume:setup" >&2
  exit 1
fi

BUN_ARGS=()
if [[ -n "${TELEGRAM_RESUME_WORKER_DIR:-}" ]]; then
  cd "$TELEGRAM_RESUME_WORKER_DIR"
  POLL_ENTRY="$TELEGRAM_RESUME_WORKER_DIR/import-pending-telegram-resumes.js"
  DRAIN_ENTRY="$TELEGRAM_RESUME_WORKER_DIR/drain-telegram-resumes.js"
else
  cd "$APP_DIR"
  BASE_ENV_FILE="$APP_DIR/.env"
  if [[ -f "$BASE_ENV_FILE" ]] && [[ "$BASE_ENV_FILE" != "$TELEGRAM_RESUME_ENV_FILE" ]]; then
    BUN_ARGS+=("--env-file=$BASE_ENV_FILE")
  fi
  POLL_ENTRY="scripts/import-pending-telegram-resumes.ts"
  DRAIN_ENTRY="scripts/drain-telegram-resumes.ts"
fi
BUN_ARGS+=("--env-file=$TELEGRAM_RESUME_ENV_FILE")

LOCK_ROOT="${TMPDIR:-/tmp}"
LOCK_DIR="${LOCK_ROOT%/}/persona-management-telegram-resumes-${UID}.lock"

acquire_lock() {
  if mkdir "$LOCK_DIR" 2>/dev/null; then
    printf '%s\n' "$$" > "$LOCK_DIR/pid"
    return 0
  fi

  local existing_pid=""
  if [[ -f "$LOCK_DIR/pid" ]]; then
    existing_pid="$(<"$LOCK_DIR/pid")"
  fi
  if [[ "$existing_pid" =~ ^[0-9]+$ ]] && kill -0 "$existing_pid" 2>/dev/null; then
    # The previous minute's worker is still active. SKIP LOCKED protects the
    # database too, but avoiding another AI process is cheaper and quieter.
    exit 0
  fi

  # Recover a lock left behind by an abruptly terminated process.
  rm -f "$LOCK_DIR/pid"
  rmdir "$LOCK_DIR" 2>/dev/null || true
  mkdir "$LOCK_DIR"
  printf '%s\n' "$$" > "$LOCK_DIR/pid"
}

release_lock() {
  rm -f "$LOCK_DIR/pid"
  rmdir "$LOCK_DIR" 2>/dev/null || true
}

acquire_lock
trap release_lock EXIT INT TERM

"$BUN_BIN" "${BUN_ARGS[@]}" run "$POLL_ENTRY"
"$BUN_BIN" "${BUN_ARGS[@]}" run "$DRAIN_ENTRY" --once
