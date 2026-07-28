#!/usr/bin/env bash
# Reconciles candidate statuses with hh.uz (sync Layer 3).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/run-hh-cron.sh"

# Leave one minute before the next scheduled run. flock also prevents overlap.
run_hh_cron "hh-status" "hh-status" "${HH_STATUS_MAX_SECONDS:-240}"
