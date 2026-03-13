#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/root/projects/persona-management}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_REPOSITORY="${DEPLOY_REPOSITORY:-origin}"
APP_SERVICE="${APP_SERVICE:-yeshunt.service}"

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

cd "$DEPLOY_PATH"
ensure_bun()

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
bun run db:push
bun run build

run_as_root systemctl restart "$APP_SERVICE"
run_as_root systemctl status "$APP_SERVICE" --no-pager --lines=20
