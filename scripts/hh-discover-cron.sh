#!/usr/bin/env bash
#
# Runs hh.uz candidate discovery (sync Layer 1) for every company with a
# connected hh.uz account, so the funnel keeps picking up new applicants
# without anyone reconnecting.
#
# Schedule on the deploy server with cron, e.g. every 20 minutes:
#   crontab -e
#   */20 * * * * /root/projects/persona-management/scripts/hh-discover-cron.sh >> /var/log/hh-discover.log 2>&1
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
  echo "AUTH_SECRET is not set; cannot authorize the discovery worker" >&2
  exit 1
fi

PORT="${PORT:-3000}"

curl -fsS "http://localhost:${PORT}/api/cron/hh-discover" \
  -H "Authorization: Bearer ${AUTH_SECRET}" >/dev/null
