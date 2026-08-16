#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/root/projects/persona-management}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_REPOSITORY="${DEPLOY_REPOSITORY:-origin}"
APP_NAME="${APP_NAME:-yeshunt}"
SOURCE_ALREADY_UPDATED="${SOURCE_ALREADY_UPDATED:-false}"
CURRENT_DEPLOY_STEP="Initialize deployment"

report_deploy_error() {
  local exit_code="$?"
  local line_number="$1"

  echo "::endgroup::"
  printf 'Deployment failed during "%s" at scripts/deploy.sh:%s (exit %s).\n' \
    "$CURRENT_DEPLOY_STEP" \
    "$line_number" \
    "$exit_code" >&2
  printf '::error title=Production deployment failed::Step "%s" failed on the server (scripts/deploy.sh:%s, exit %s). Review the preceding log group.\n' \
    "$CURRENT_DEPLOY_STEP" \
    "$line_number" \
    "$exit_code" >&2
  exit "$exit_code"
}

trap 'report_deploy_error "$LINENO"' ERR

run_step() {
  local label="$1"
  shift

  CURRENT_DEPLOY_STEP="$label"
  printf '::group::%s\n' "$label"
  "$@"
  echo "::endgroup::"
}

run_as_root() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  else
    sudo -n "$@"
  fi
}

ensure_bun() {
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"

  if ! command -v bun >/dev/null 2>&1; then
    echo "Bun is not available in PATH. Expected it at $BUN_INSTALL/bin/bun or in the system PATH." >&2
    exit 127
  fi
}

ensure_pm2() {
  export PATH="$HOME/.bun/bin:$HOME/.local/bin:/usr/local/bin:$PATH"

  if ! command -v pm2 >/dev/null 2>&1; then
    echo "pm2 is not installed. Installing globally with bun..."
    bun install -g pm2
  fi
}

cd "$DEPLOY_PATH"
ensure_bun
ensure_pm2

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Refusing to deploy: worktree has uncommitted changes in $DEPLOY_PATH" >&2
  exit 1
fi

if [ "$SOURCE_ALREADY_UPDATED" != "true" ]; then
  run_step "Fetch deployment source" \
    git fetch "$DEPLOY_REPOSITORY" "$DEPLOY_BRANCH"

  current_branch="$(git branch --show-current)"
  if [ "$current_branch" != "$DEPLOY_BRANCH" ]; then
    run_step "Check out deployment branch" git checkout "$DEPLOY_BRANCH"
  fi

  run_step "Fast-forward deployment source" \
    git pull --ff-only "$DEPLOY_REPOSITORY" "$DEPLOY_BRANCH"
else
  echo "Deployment source was fast-forwarded by the CI bootstrap step."
fi

run_step "Install dependencies" bun install --frozen-lockfile
run_step "Build application" bun run build

# Refuse schema changes unless a validated PostgreSQL snapshot succeeds first.
run_step "Back up production database" \
  run_as_root bash "$DEPLOY_PATH/scripts/backup-database.sh"

# The custom migrator is the only production schema path. It applies committed
# SQL migrations, reconciles databases whose schema is ahead of the Drizzle
# ledger, and exits non-zero on every non-idempotent SQL error. `db:push` is
# deliberately excluded because it skips migration backfills and ledger writes.
run_step "Apply database migrations" bun run db:migrate-custom

# Restart or start the app with pm2
CURRENT_DEPLOY_STEP="Restart application"
echo "::group::$CURRENT_DEPLOY_STEP"
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME"
  echo "Restarted '$APP_NAME' with pm2"
else
  pm2 start bun --name "$APP_NAME" -- run start
  echo "Started '$APP_NAME' with pm2"
fi
echo "::endgroup::"

run_step "Persist process configuration" pm2 save

run_step "Install operational schedules" \
  run_as_root bash "$DEPLOY_PATH/scripts/install-operations.sh"

echo ""
run_step "Show application status" pm2 status "$APP_NAME"
