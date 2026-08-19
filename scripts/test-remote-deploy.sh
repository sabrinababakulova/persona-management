#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_ROOT="$(mktemp -d)"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

ORIGIN_PATH="$TEST_ROOT/origin.git"
SOURCE_PATH="$TEST_ROOT/source"
SERVER_PATH="$TEST_ROOT/server"
MARKER_PATH="$TEST_ROOT/deployed"

git init --bare --quiet "$ORIGIN_PATH"
git init --quiet "$SOURCE_PATH"
git -C "$SOURCE_PATH" config user.email deploy-test@example.invalid
git -C "$SOURCE_PATH" config user.name "Deployment Test"
mkdir -p "$SOURCE_PATH/scripts"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'set -Eeuo pipefail' \
  ': "${DEPLOY_COMMIT:?}"' \
  ': "${DEPLOY_PATH:?}"' \
  ': "${OPERATIONS_PROJECT_PATH:?}"' \
  ': "${PRODUCTION_ENV_FILE:?}"' \
  'test "$SOURCE_ALREADY_UPDATED" = true' \
  'test -f "$DEPLOY_PATH/.env"' \
  'test -f "$DEPLOY_PATH/.env.local"' \
  'test "$OPERATIONS_PROJECT_PATH" != "$DEPLOY_PATH"' \
  'printf "%s" "$DEPLOY_COMMIT" >"$TEST_MARKER"' \
  >"$SOURCE_PATH/scripts/deploy.sh"
chmod 0755 "$SOURCE_PATH/scripts/deploy.sh"
printf 'tracked\n' >"$SOURCE_PATH/README.md"
git -C "$SOURCE_PATH" add README.md scripts/deploy.sh
git -C "$SOURCE_PATH" commit --quiet -m fixture
git -C "$SOURCE_PATH" branch -M main
git -C "$SOURCE_PATH" remote add origin "$ORIGIN_PATH"
git -C "$SOURCE_PATH" push --quiet -u origin main

git clone --quiet --branch main "$ORIGIN_PATH" "$SERVER_PATH"
printf 'production=true\n' >"$SERVER_PATH/.env"
printf 'override=true\n' >"$SERVER_PATH/.env.local"
printf 'dirty server edit\n' >>"$SERVER_PATH/README.md"

DEPLOY_SHA="$(git -C "$SOURCE_PATH" rev-parse HEAD)" \
DEPLOY_REF=main \
DEPLOY_REPO_PATH="$SERVER_PATH" \
DEPLOY_REPOSITORY=origin \
TEST_MARKER="$MARKER_PATH" \
bash "$REPO_ROOT/deploy/remote-deploy.sh"

expected_sha="$(git -C "$SOURCE_PATH" rev-parse HEAD)"
test "$(cat "$MARKER_PATH")" = "$expected_sha"
test "$(git -C "$SERVER_PATH" branch --show-current)" = main
test -n "$(git -C "$SERVER_PATH" status --porcelain README.md)"
test "$(git -C "$SERVER_PATH" worktree list --porcelain | rg -c '^worktree ')" = 1

echo "Remote deployment uses the validated commit without mutating a dirty server checkout."
