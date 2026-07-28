#!/usr/bin/env bash
# Drains the hh.uz candidate enrichment queue (sync Layer 2).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/run-hh-cron.sh"

# Keep this below the one-minute schedule so a stalled HTTP request cannot pile up.
run_hh_cron "hh-enrich" "hh-enrich" "${HH_ENRICH_MAX_SECONDS:-50}"
