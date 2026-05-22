#!/usr/bin/env bash
#
# Reconciles candidate statuses with hh.uz (sync Layer 3) for every company
# with a connected hh.uz account — so rejections and stage changes made on
# hh.uz are reflected on the platform.
#
# Status sync is incremental (watermarked on negotiation updated_at), so it is
# cheap to run often. Schedule on the deploy server with cron, e.g. every 5 min:
#   crontab -e
#   */5 * * * * /root/projects/persona-management/scripts/hh-status-cron.sh >> /var/log/hh-status.log 2>&1
#
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

# Load AUTH_SECRET (and PORT, if overridden) from the app env file.
if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -z "${AUTH_SECRET:-}" ]]; then
  echo "AUTH_SECRET is not set; cannot authorize the status worker" >&2
  exit 1
fi

PORT="${PORT:-3000}"

curl -fsS "http://localhost:${PORT}/api/cron/hh-status" \
  -H "Authorization: Bearer ${AUTH_SECRET}" >/dev/null
