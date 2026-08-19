#!/usr/bin/env bash
set -Eeuo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-/root/projects/persona-management}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_REPOSITORY="${DEPLOY_REPOSITORY:-origin}"
APP_NAME="${APP_NAME:-yeshunt}"
APP_RUNTIME_USER="${APP_RUNTIME_USER:-persona-web}"
APP_RUNTIME_HOME="${APP_RUNTIME_HOME:-/var/lib/persona-web}"
APP_RUNTIME_PATH="${APP_RUNTIME_PATH:-/opt/persona-management-runtime}"
APP_STAGING_PATH="${APP_RUNTIME_PATH}.staging"
APP_ROLLBACK_PATH="${APP_RUNTIME_PATH}.rollback"
APP_SERVICE_FILE="/etc/systemd/system/${APP_NAME}.service"
SOURCE_ALREADY_UPDATED="${SOURCE_ALREADY_UPDATED:-false}"
DEPLOY_COMMIT="${DEPLOY_COMMIT:-}"
OPERATIONS_PROJECT_PATH="${OPERATIONS_PROJECT_PATH:-$DEPLOY_PATH}"
PRODUCTION_ENV_FILE="${PRODUCTION_ENV_FILE:-$OPERATIONS_PROJECT_PATH/.env}"
CURRENT_DEPLOY_STEP="Initialize deployment"
HAD_PREVIOUS_RUNTIME=false

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

remove_managed_runtime_path() {
  local target="$1"

  case "$target" in
    "$APP_STAGING_PATH" | "$APP_ROLLBACK_PATH")
      run_as_root rm -rf -- "$target"
      ;;
    *)
      echo "Refusing to remove unmanaged runtime path: $target" >&2
      return 1
      ;;
  esac
}

validate_deploy_configuration() {
  case "$APP_RUNTIME_PATH" in
    /opt/* | /srv/* | /var/lib/*) ;;
    *)
      echo "APP_RUNTIME_PATH must be below /opt, /srv, or /var/lib." >&2
      return 2
      ;;
  esac

  if [ ! -f "$PRODUCTION_ENV_FILE" ]; then
    echo "Production environment file is missing: $PRODUCTION_ENV_FILE" >&2
    return 1
  fi
  if [ "$(id -u)" -ne 0 ]; then
    sudo -n true
  fi

  for command in curl git install rsync sed systemctl; do
    if ! command -v "$command" >/dev/null 2>&1; then
      echo "Required deployment command is missing: $command" >&2
      return 127
    fi
  done
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
  remove_managed_runtime_path "$APP_STAGING_PATH"
  run_as_root install -d -m 0750 \
    -o root \
    -g "$APP_RUNTIME_USER" \
    "$APP_STAGING_PATH"
  run_as_root rsync -a --delete \
    --exclude='.git/' \
    --exclude='backups/' \
    --exclude='build/' \
    --exclude='node_modules/' \
    "$DEPLOY_PATH/" \
    "$APP_STAGING_PATH/"

  # Build a complete dependency tree in the staged runtime instead of copying
  # Bun's linked node_modules layout from the source checkout.
  run_as_root env HOME="$APP_RUNTIME_HOME" \
    /usr/local/bin/bun install \
    --cwd "$APP_STAGING_PATH" \
    --frozen-lockfile \
    --production

  run_as_root chown -R "root:$APP_RUNTIME_USER" "$APP_STAGING_PATH"
  run_as_root chmod -R g+rX,o-rwx "$APP_STAGING_PATH"
  run_as_root chown -R "$APP_RUNTIME_USER:$APP_RUNTIME_USER" \
    "$APP_STAGING_PATH/.next"
  if [ -f "$APP_STAGING_PATH/.env" ]; then
    run_as_root chmod 0640 "$APP_STAGING_PATH/.env"
  fi
}

activate_staged_runtime() {
  remove_managed_runtime_path "$APP_ROLLBACK_PATH"
  HAD_PREVIOUS_RUNTIME=false

  if [ -e "$APP_RUNTIME_PATH" ] || [ -L "$APP_RUNTIME_PATH" ]; then
    run_as_root mv "$APP_RUNTIME_PATH" "$APP_ROLLBACK_PATH"
    HAD_PREVIOUS_RUNTIME=true
  fi
  run_as_root mv "$APP_STAGING_PATH" "$APP_RUNTIME_PATH"
}

restore_previous_runtime() {
  run_as_root systemctl stop "$APP_NAME.service" || true

  if [ "$HAD_PREVIOUS_RUNTIME" != "true" ] ||
    { [ ! -e "$APP_ROLLBACK_PATH" ] && [ ! -L "$APP_ROLLBACK_PATH" ]; }; then
    echo "No previous runtime is available for rollback." >&2
    return 1
  fi

  remove_managed_runtime_path "$APP_STAGING_PATH"
  if [ -e "$APP_RUNTIME_PATH" ] || [ -L "$APP_RUNTIME_PATH" ]; then
    run_as_root mv "$APP_RUNTIME_PATH" "$APP_STAGING_PATH"
  fi
  run_as_root mv "$APP_ROLLBACK_PATH" "$APP_RUNTIME_PATH"
  run_as_root systemctl restart "$APP_NAME.service"
}

verify_application_health() {
  curl \
    --fail \
    --silent \
    --show-error \
    --retry 10 \
    --retry-connrefused \
    --retry-delay 1 \
    --max-time 5 \
    "http://127.0.0.1:3000/api/auth/session" >/dev/null
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

if [ "${DEPLOY_LIBRARY_ONLY:-false}" = "true" ]; then
  return 0 2>/dev/null || exit 0
fi

cd "$DEPLOY_PATH"
validate_deploy_configuration
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

resolved_deploy_commit="$(git rev-parse HEAD)"
if [ -n "$DEPLOY_COMMIT" ] && [ "$resolved_deploy_commit" != "$DEPLOY_COMMIT" ]; then
  echo "Deployment source mismatch: expected $DEPLOY_COMMIT, got $resolved_deploy_commit." >&2
  exit 1
fi
DEPLOY_COMMIT="$resolved_deploy_commit"
echo "Deploying commit $DEPLOY_COMMIT."

run_step "Install dependencies" bun install --frozen-lockfile
run_step "Build application" bun run build

# Refuse schema changes unless a validated PostgreSQL snapshot succeeds first.
run_step "Back up production database" \
  run_as_root env \
    PERSONA_PROJECT_DIR="$OPERATIONS_PROJECT_PATH" \
    PERSONA_DATABASE_ENV_FILE="$PRODUCTION_ENV_FILE" \
    bash "$DEPLOY_PATH/scripts/backup-database.sh"

# The custom migrator is the only production schema path. It applies committed
# SQL migrations, reconciles databases whose schema is ahead of the Drizzle
# ledger, and exits non-zero on every non-idempotent SQL error. `db:push` is
# deliberately excluded because it skips migration backfills and ledger writes.
run_step "Apply database migrations" bun run db:migrate-custom
run_step "Stage application runtime" stage_runtime
run_step "Install systemd service" install_service
run_step "Activate staged runtime" activate_staged_runtime

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
  ROLLBACK_HEALTHY=false
  if restore_previous_runtime && verify_application_health; then
    ROLLBACK_HEALTHY=true
  fi
  if [ "$ROLLBACK_HEALTHY" != "true" ] && [ -n "$LEGACY_PM2" ]; then
    "$LEGACY_PM2" restart "$APP_NAME"
  fi
  exit 1
fi
echo "::endgroup::"

CURRENT_DEPLOY_STEP="Verify application health"
echo "::group::$CURRENT_DEPLOY_STEP"
if ! verify_application_health; then
  echo "::endgroup::"
  run_as_root systemctl status "$APP_NAME.service" --no-pager || true
  run_as_root journalctl -u "$APP_NAME.service" -n 120 --no-pager || true
  ROLLBACK_HEALTHY=false
  if restore_previous_runtime && verify_application_health; then
    ROLLBACK_HEALTHY=true
  fi
  if [ "$ROLLBACK_HEALTHY" != "true" ] && [ -n "$LEGACY_PM2" ]; then
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
  run_as_root env \
    PERSONA_OPERATION_PROJECT_DIR="$OPERATIONS_PROJECT_PATH" \
    PERSONA_DATABASE_ENV_FILE="$PRODUCTION_ENV_FILE" \
    bash "$DEPLOY_PATH/scripts/install-operations.sh"

echo ""
run_step "Show application status" \
  run_as_root systemctl status "$APP_NAME.service" --no-pager
