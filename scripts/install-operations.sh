#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this installer as root." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OPERATION_PROJECT_DIR="${PERSONA_OPERATION_PROJECT_DIR:-$SOURCE_ROOT}"
ENV_FILE="${PERSONA_DATABASE_ENV_FILE:-$OPERATION_PROJECT_DIR/.env}"
CRON_USER="persona-cron"
INSTALL_DIR="/usr/local/lib/persona-management"
CONFIG_DIR="/etc/persona-management"
LOG_DIR="/var/log/persona-management"
LOCK_DIR="/run/lock/persona-management"
CRON_DEST="/etc/cron.d/persona-management"
LOGROTATE_DEST="/etc/logrotate.d/persona-management"
TMPFILES_DEST="/etc/tmpfiles.d/persona-management.conf"
TEMP_FILES=()

cleanup() {
  local path
  for path in "${TEMP_FILES[@]}"; do
    if [ -f "$path" ]; then
      rm -f -- "$path"
    fi
  done
}
trap cleanup EXIT

if [ ! -f "$ENV_FILE" ]; then
  echo "Application environment file not found: $ENV_FILE" >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

: "${AUTH_SECRET:?AUTH_SECRET must be set}"
PORT="${PORT:-3000}"

for command in awk crontab getent grep install logrotate sed useradd; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required command is not installed: $command" >&2
    exit 1
  fi
done

if ! getent passwd "$CRON_USER" >/dev/null; then
  useradd \
    --system \
    --user-group \
    --home-dir /nonexistent \
    --shell /usr/sbin/nologin \
    "$CRON_USER"
fi

install -d -m 0755 -o root -g root "$INSTALL_DIR"
install -d -m 0750 -o root -g "$CRON_USER" "$CONFIG_DIR"
install -d -m 0750 -o "$CRON_USER" -g "$CRON_USER" "$LOG_DIR"
install -d -m 0750 -o "$CRON_USER" -g "$CRON_USER" "$LOCK_DIR"

for lock_name in \
  hh-enrich.lock \
  hh-discover.lock \
  hh-status.lock \
  candidate-ai-backfill.lock; do
  lock_path="$LOCK_DIR/$lock_name"
  if [ ! -e "$lock_path" ]; then
    install -m 0640 -o "$CRON_USER" -g "$CRON_USER" /dev/null "$lock_path"
  else
    chown "$CRON_USER:$CRON_USER" "$lock_path"
    chmod 0640 "$lock_path"
  fi
done

install -m 0755 -o root -g root \
  "$SOURCE_ROOT/scripts/run-hh-cron.sh" \
  "$SOURCE_ROOT/scripts/hh-enrich-cron.sh" \
  "$SOURCE_ROOT/scripts/hh-discover-cron.sh" \
  "$SOURCE_ROOT/scripts/hh-status-cron.sh" \
  "$SOURCE_ROOT/scripts/candidate-ai-backfill-cron.sh" \
  "$SOURCE_ROOT/scripts/backup-database.sh" \
  "$SOURCE_ROOT/scripts/verify-database-backup.sh" \
  "$INSTALL_DIR/"

CRON_ENV_TEMP="$(mktemp)"
TEMP_FILES+=("$CRON_ENV_TEMP")
umask 077
{
  printf 'AUTH_SECRET=%q\n' "$AUTH_SECRET"
  printf 'PORT=%q\n' "$PORT"
} >"$CRON_ENV_TEMP"
install -m 0640 -o root -g "$CRON_USER" "$CRON_ENV_TEMP" "$CONFIG_DIR/cron.env"

for log_name in \
  hh-enrich.log \
  hh-discover.log \
  hh-status.log \
  candidate-ai-backfill.log \
  database-backup.log \
  database-restore-test.log; do
  log_path="$LOG_DIR/$log_name"
  if [ ! -e "$log_path" ]; then
    install -m 0640 -o "$CRON_USER" -g "$CRON_USER" /dev/null "$log_path"
  else
    chown "$CRON_USER:$CRON_USER" "$log_path"
    chmod 0640 "$log_path"
  fi
done

CRON_TEMP="$(mktemp)"
TEMP_FILES+=("$CRON_TEMP")
sed "s|__PROJECT_DIR__|$OPERATION_PROJECT_DIR|g" \
  "$SOURCE_ROOT/deploy/cron/persona-management" >"$CRON_TEMP"
sed -i "s|__DATABASE_ENV_FILE__|$ENV_FILE|g" "$CRON_TEMP"
install -m 0644 -o root -g root "$CRON_TEMP" "$CRON_DEST"

install -m 0644 -o root -g root \
  "$SOURCE_ROOT/deploy/logrotate/persona-management" \
  "$LOGROTATE_DEST"
install -m 0644 -o root -g root \
  "$SOURCE_ROOT/deploy/tmpfiles/persona-management.conf" \
  "$TMPFILES_DEST"

# Remove only the superseded project jobs from root's personal crontab.
# Preserve a timestamped copy so this migration is reversible.
ROOT_CRONTAB="$(mktemp)"
FILTERED_CRONTAB="$(mktemp)"
TEMP_FILES+=("$ROOT_CRONTAB" "$FILTERED_CRONTAB")
if crontab -l >"$ROOT_CRONTAB" 2>/dev/null; then
  if grep -Eq '/scripts/hh-(enrich|discover|status)-cron\.sh' "$ROOT_CRONTAB"; then
    install -m 0600 -o root -g root \
      "$ROOT_CRONTAB" \
      "$CONFIG_DIR/root-crontab.before-persona-management-$(date -u +%Y%m%dT%H%M%SZ)"
    awk \
      '!/\/scripts\/hh-(enrich|discover|status)-cron\.sh/' \
      "$ROOT_CRONTAB" >"$FILTERED_CRONTAB"
    crontab -n "$FILTERED_CRONTAB"
    crontab "$FILTERED_CRONTAB"
  fi
fi

LOGROTATE_DEBUG="$(mktemp)"
TEMP_FILES+=("$LOGROTATE_DEBUG")
if ! logrotate --debug "$LOGROTATE_DEST" >"$LOGROTATE_DEBUG" 2>&1; then
  sed -n '1,240p' "$LOGROTATE_DEBUG" >&2
  exit 1
fi

echo "Operational schedules installed:"
echo "  hh enrichment: every minute as $CRON_USER"
echo "  hh discovery: every 20 minutes as $CRON_USER"
echo "  hh status sync: every 5 minutes as $CRON_USER"
echo "  candidate AI metadata backfill: every minute as $CRON_USER"
echo "  database backup: nightly at 02:17 UTC as root"
echo "  database restore test: Sundays at 03:43 UTC as root"
echo "  database retention: 14 daily, 8 weekly, 12 monthly snapshots"
