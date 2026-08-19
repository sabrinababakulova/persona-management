#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf -- "$TEMP_DIR"
}
trap cleanup EXIT

cd "$REPO_ROOT"

bash -n \
  deploy/remote-deploy.sh \
  scripts/deploy.sh \
  scripts/install-operations.sh \
  scripts/test-deploy-runtime-swap.sh \
  scripts/test-remote-deploy.sh \
  scripts/backup-database.sh \
  scripts/verify-database-backup.sh \
  scripts/run-hh-cron.sh

sed \
  -e 's|__RUNTIME_USER__|persona-web|g' \
  -e 's|__RUNTIME_HOME__|/var/lib/persona-web|g' \
  -e 's|__RUNTIME_PATH__|/opt/persona-management-runtime|g' \
  deploy/systemd/yeshunt.service >"$TEMP_DIR/yeshunt.service"
sed \
  -e 's|__PROJECT_DIR__|/root/projects/persona-management|g' \
  -e 's|__DATABASE_ENV_FILE__|/root/projects/persona-management/.env|g' \
  deploy/cron/persona-management >"$TEMP_DIR/persona-management.cron"

if rg -n '__[A-Z0-9_]+__' "$TEMP_DIR"; then
  echo "A deployment template contains an unresolved placeholder." >&2
  exit 1
fi

rg -q 'User=persona-web' "$TEMP_DIR/yeshunt.service"
rg -q 'WorkingDirectory=/opt/persona-management-runtime' \
  "$TEMP_DIR/yeshunt.service"
rg -q 'PERSONA_DATABASE_ENV_FILE=/root/projects/persona-management/.env' \
  "$TEMP_DIR/persona-management.cron"
rg -q 'uses: actions/checkout@v6' .github/workflows/deploy.yml
rg -q 'DEPLOY_SHA:.*needs.validate.outputs.commit_sha' \
  .github/workflows/deploy.yml
rg -q 'deploy/remote-deploy.sh' .github/workflows/deploy.yml

bash scripts/test-remote-deploy.sh
bash scripts/test-deploy-runtime-swap.sh

echo "Deployment scripts and rendered templates are valid."
