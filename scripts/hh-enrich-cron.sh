#!/usr/bin/env bash
#
# Drains the hh.uz candidate enrichment queue (sync Layer 2).
#
# Schedule on the deploy server with cron, e.g. once a minute:
#   crontab -e
#   * * * * * /root/projects/persona-management/scripts/hh-enrich-cron.sh >> /var/log/hh-enrich.log 2>&1
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
  echo "AUTH_SECRET is not set; cannot authorize the enrichment worker" >&2
  exit 1
fi

PORT="${PORT:-3000}"

curl -fsS "http://localhost:${PORT}/api/cron/hh-enrich" \
  -H "Authorization: Bearer ${AUTH_SECRET}" >/dev/null
