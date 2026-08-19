#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEST_ROOT="$(mktemp -d)"

cleanup() {
  rm -rf -- "$TEST_ROOT"
}
trap cleanup EXIT

mkdir -p "$TEST_ROOT/bin" "$TEST_ROOT/runtime" "$TEST_ROOT/runtime.staging"
printf 'old\n' >"$TEST_ROOT/runtime/version"
printf 'new\n' >"$TEST_ROOT/runtime.staging/version"
printf '%s\n' \
  '#!/usr/bin/env bash' \
  'printf "%s\n" "$*" >>"$SYSTEMCTL_LOG"' \
  >"$TEST_ROOT/bin/systemctl"
chmod 0755 "$TEST_ROOT/bin/systemctl"

export PATH="$TEST_ROOT/bin:$PATH"
export SYSTEMCTL_LOG="$TEST_ROOT/systemctl.log"
APP_RUNTIME_PATH="$TEST_ROOT/runtime"
DEPLOY_LIBRARY_ONLY=true
export APP_RUNTIME_PATH DEPLOY_LIBRARY_ONLY
# shellcheck disable=SC1090
source "$REPO_ROOT/scripts/deploy.sh"

activate_staged_runtime
test "$(cat "$TEST_ROOT/runtime/version")" = new
test "$(cat "$TEST_ROOT/runtime.rollback/version")" = old

restore_previous_runtime
test "$(cat "$TEST_ROOT/runtime/version")" = old
test "$(cat "$TEST_ROOT/runtime.staging/version")" = new
grep -Eq '^stop yeshunt.service$' "$SYSTEMCTL_LOG"
grep -Eq '^restart yeshunt.service$' "$SYSTEMCTL_LOG"

echo "Runtime activation and rollback preserve the previous release."
