#!/usr/bin/env bash
# Runs hh.uz candidate discovery (sync Layer 1) for every connected company.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/run-hh-cron.sh"

# Leave five minutes before the next scheduled run. flock also prevents overlap.
run_hh_cron "hh-discover" "hh-discover" "${HH_DISCOVER_MAX_SECONDS:-900}"
