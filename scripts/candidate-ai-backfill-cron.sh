#!/usr/bin/env bash
# Backfills candidate AI analysis, translations, and tags in bounded batches.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$SCRIPT_DIR/run-hh-cron.sh"

# Keep this below the one-minute schedule so stalled AI requests cannot overlap.
run_hh_cron \
  "candidate-ai-backfill" \
  "candidate-ai-backfill" \
  "${CANDIDATE_AI_BACKFILL_MAX_SECONDS:-50}"
