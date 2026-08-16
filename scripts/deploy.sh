#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/root/projects/persona-management}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_REPOSITORY="${DEPLOY_REPOSITORY:-origin}"
APP_NAME="${APP_NAME:-yeshunt}"
APP_RUNTIME_USER="${APP_RUNTIME_USER:-persona-web}"
APP_RUNTIME_HOME="${APP_RUNTIME_HOME:-/var/lib/persona-web}"
APP_RUNTIME_PATH="/opt/persona-management-runtime"
APP_SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"

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
    "$DEPLOY_PATH/" \
    "$APP_RUNTIME_PATH/"
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

git fetch "$DEPLOY_REPOSITORY" "$DEPLOY_BRANCH"

current_branch="$(git branch --show-current)"
if [ "$current_branch" != "$DEPLOY_BRANCH" ]; then
  git checkout "$DEPLOY_BRANCH"
fi

git pull --ff-only "$DEPLOY_REPOSITORY" "$DEPLOY_BRANCH"
bun install --frozen-lockfile

# Refuse schema changes unless a validated PostgreSQL snapshot succeeds first.
run_as_root bash "$DEPLOY_PATH/scripts/backup-database.sh"
# Migrations only — `db:push` is deliberately not used here. Push applies
# schema.ts directly, which silently skips the data backfills that live in the
# .sql files and leaves `drizzle.__drizzle_migrations` empty.
#
# If this database was previously deployed with push, its ledger is behind the
# schema and this step will fail on "already exists". Run `bun run
# db:migrate-custom` once to reconcile it, then this returns to working.
bun run db:migrate
bun run build

stage_runtime
install_service

# Older deployments used root-owned PM2. Stop it before binding the same port,
# but retain it until the systemd service passes its health check so rollback is
# still possible.
LEGACY_PM2=""
if [ -x /root/.bun/bin/pm2 ] && \
  /root/.bun/bin/pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  LEGACY_PM2=/root/.bun/bin/pm2
  "$LEGACY_PM2" stop "$APP_NAME"
fi

run_as_root systemctl enable "$APP_NAME.service"
if ! run_as_root systemctl restart "$APP_NAME.service"; then
  if [ -n "$LEGACY_PM2" ]; then
    "$LEGACY_PM2" restart "$APP_NAME"
  fi
  exit 1
fi

if ! curl \
  --fail \
  --silent \
  --show-error \
  --retry 10 \
  --retry-connrefused \
  --retry-delay 1 \
  --max-time 5 \
  "http://127.0.0.1:3000/api/auth/session" >/dev/null; then
  run_as_root systemctl status "$APP_NAME.service" --no-pager || true
  run_as_root journalctl -u "$APP_NAME.service" -n 120 --no-pager || true
  run_as_root systemctl stop "$APP_NAME.service"
  if [ -n "$LEGACY_PM2" ]; then
    "$LEGACY_PM2" restart "$APP_NAME"
  fi
  exit 1
fi

if [ -n "$LEGACY_PM2" ]; then
  "$LEGACY_PM2" delete "$APP_NAME"
  "$LEGACY_PM2" save
fi

run_as_root bash "$DEPLOY_PATH/scripts/install-operations.sh"

echo ""
run_as_root systemctl status "$APP_NAME.service" --no-pager
