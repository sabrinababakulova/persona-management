#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/root/projects/persona-management}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_REPOSITORY="${DEPLOY_REPOSITORY:-origin}"
APP_NAME="${APP_NAME:-yeshunt}"
APP_RUNTIME_USER="${APP_RUNTIME_USER:-persona-web}"
APP_RUNTIME_HOME="${APP_RUNTIME_HOME:-/var/lib/persona-web}"
APP_RUNTIME_PATH="/opt/persona-management-runtime"
APP_SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
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

  if [ "$(command -v bun)" != "/usr/local/bin/bun" ]; then
    run_as_root install -m 0755 "$(command -v bun)" /usr/local/bin/bun
  fi
}

ensure_runtime_user() {
  if ! getent passwd "$APP_RUNTIME_USER" >/dev/null; then
    run_as_root useradd \
      --system \
      --user-group \
      --create-home \
      --home-dir "$APP_RUNTIME_HOME" \
      --shell /usr/sbin/nologin \
      "$APP_RUNTIME_USER"
  fi
  run_as_root install -d -m 0750 \
    -o "$APP_RUNTIME_USER" \
    -g "$APP_RUNTIME_USER" \
    "$APP_RUNTIME_HOME"
}

stage_runtime() {
  run_as_root install -d -m 0750 \
    -o root \
    -g "$APP_RUNTIME_USER" \
    "$APP_RUNTIME_PATH"
  run_as_root rsync -a --delete \
    --exclude='.git/' \
    --exclude='backups/' \
    --exclude='build/' \
    --exclude='node_modules/' \
    "$DEPLOY_PATH/" \
    "$APP_RUNTIME_PATH/"

  # Build a complete dependency tree in the staged runtime instead of copying
  # Bun's linked node_modules layout from the source checkout.
  run_as_root env HOME="$APP_RUNTIME_HOME" \
    /usr/local/bin/bun install \
    --cwd "$APP_RUNTIME_PATH" \
    --frozen-lockfile \
    --force \
    --production

  run_as_root chown -R "root:$APP_RUNTIME_USER" "$APP_RUNTIME_PATH"
  run_as_root chmod -R g+rX,o-rwx "$APP_RUNTIME_PATH"
  run_as_root chown -R "$APP_RUNTIME_USER:$APP_RUNTIME_USER" \
    "$APP_RUNTIME_PATH/.next"
  if [ -f "$APP_RUNTIME_PATH/.env" ]; then
    run_as_root chmod 0640 "$APP_RUNTIME_PATH/.env"
  fi
}

install_service() {
  local service_temp
  service_temp="$(mktemp)"
  sed \
    -e "s|__RUNTIME_USER__|$APP_RUNTIME_USER|g" \
    -e "s|__RUNTIME_HOME__|$APP_RUNTIME_HOME|g" \
    -e "s|__RUNTIME_PATH__|$APP_RUNTIME_PATH|g" \
    "$DEPLOY_PATH/deploy/systemd/yeshunt.service" >"$service_temp"
  run_as_root install -m 0644 -o root -g root \
    "$service_temp" \
    "$APP_SERVICE_FILE"
  rm -f -- "$service_temp"
  run_as_root systemctl daemon-reload
}

cd "$DEPLOY_PATH"
ensure_bun
ensure_runtime_user

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
run_step "Stage application runtime" stage_runtime
run_step "Install systemd service" install_service

# Older deployments used root-owned PM2. Stop it before binding the same port,
# but retain it until the systemd service passes its health check so rollback is
# still possible.
CURRENT_DEPLOY_STEP="Stop legacy PM2 process"
echo "::group::$CURRENT_DEPLOY_STEP"
LEGACY_PM2=""
if [ -x /root/.bun/bin/pm2 ] && \
  /root/.bun/bin/pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  LEGACY_PM2=/root/.bun/bin/pm2
  "$LEGACY_PM2" stop "$APP_NAME"
fi
echo "::endgroup::"

run_step "Enable systemd service" \
  run_as_root systemctl enable "$APP_NAME.service"

CURRENT_DEPLOY_STEP="Restart systemd service"
echo "::group::$CURRENT_DEPLOY_STEP"
if ! run_as_root systemctl restart "$APP_NAME.service"; then
  echo "::endgroup::"
  if [ -n "$LEGACY_PM2" ]; then
    "$LEGACY_PM2" restart "$APP_NAME"
  fi
  exit 1
fi
echo "::endgroup::"

CURRENT_DEPLOY_STEP="Verify application health"
echo "::group::$CURRENT_DEPLOY_STEP"
if ! curl \
  --fail \
  --silent \
  --show-error \
  --retry 10 \
  --retry-connrefused \
  --retry-delay 1 \
  --max-time 5 \
  "http://127.0.0.1:3000/api/auth/session" >/dev/null; then
  echo "::endgroup::"
  run_as_root systemctl status "$APP_NAME.service" --no-pager || true
  run_as_root journalctl -u "$APP_NAME.service" -n 120 --no-pager || true
  run_as_root systemctl stop "$APP_NAME.service"
  if [ -n "$LEGACY_PM2" ]; then
    "$LEGACY_PM2" restart "$APP_NAME"
  fi
  exit 1
fi
echo "::endgroup::"

if [ -n "$LEGACY_PM2" ]; then
  CURRENT_DEPLOY_STEP="Remove legacy PM2 process"
  echo "::group::$CURRENT_DEPLOY_STEP"
  "$LEGACY_PM2" delete "$APP_NAME"
  "$LEGACY_PM2" save
  echo "::endgroup::"
fi

run_step "Install operational schedules" \
  run_as_root bash "$DEPLOY_PATH/scripts/install-operations.sh"

echo ""
run_step "Show application status" \
  run_as_root systemctl status "$APP_NAME.service" --no-pager
