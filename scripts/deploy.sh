#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/root/projects/persona-management}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_REPOSITORY="${DEPLOY_REPOSITORY:-origin}"
APP_NAME="${APP_NAME:-yeshunt}"

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

git fetch "$DEPLOY_REPOSITORY" "$DEPLOY_BRANCH"

current_branch="$(git branch --show-current)"
if [ "$current_branch" != "$DEPLOY_BRANCH" ]; then
  git checkout "$DEPLOY_BRANCH"
fi

git pull --ff-only "$DEPLOY_REPOSITORY" "$DEPLOY_BRANCH"
bun install --frozen-lockfile

# Refuse schema changes unless a validated PostgreSQL snapshot succeeds first.
run_as_root bash "$DEPLOY_PATH/scripts/backup-database.sh"
bun run db:push
bun run build

# Restart or start the app with pm2
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 restart "$APP_NAME"
  echo "Restarted '$APP_NAME' with pm2"
else
  pm2 start bun --name "$APP_NAME" -- run start
  echo "Started '$APP_NAME' with pm2"
fi

pm2 save

run_as_root bash "$DEPLOY_PATH/scripts/install-operations.sh"

echo ""
pm2 status "$APP_NAME"
