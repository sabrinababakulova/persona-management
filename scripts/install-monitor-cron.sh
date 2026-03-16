#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUN_BIN="${BUN_BIN:-$(command -v bun)}"
LOG_DIR="$PROJECT_ROOT/storage/monitor"
LOG_FILE="$LOG_DIR/monitor.log"
CRON_ENTRY="* * * * * cd $PROJECT_ROOT && $BUN_BIN run scripts/monitor.ts >> $LOG_FILE 2>&1"

mkdir -p "$LOG_DIR"

TMP_FILE="$(mktemp)"
trap 'rm -f "$TMP_FILE"' EXIT

crontab -l 2>/dev/null | grep -Fv "scripts/monitor.ts" > "$TMP_FILE" || true
printf '%s\n' "$CRON_ENTRY" >> "$TMP_FILE"
crontab "$TMP_FILE"

echo "Installed monitor cron job:"
echo "$CRON_ENTRY"
