#!/usr/bin/env bash
set -Eeuo pipefail

: "${DEPLOY_SHA:?DEPLOY_SHA is required}"
: "${DEPLOY_REF:?DEPLOY_REF is required}"

DEPLOY_REPO_PATH="${DEPLOY_REPO_PATH:-/root/projects/persona-management}"
DEPLOY_REPOSITORY="${DEPLOY_REPOSITORY:-origin}"
DEPLOY_WORKTREE=""

if ! [[ "$DEPLOY_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "DEPLOY_SHA must be a full 40-character commit SHA." >&2
  exit 2
fi
if ! [[ "$DEPLOY_REF" =~ ^[A-Za-z0-9][A-Za-z0-9._/-]*$ ]] ||
  [[ "$DEPLOY_REF" == *..* || "$DEPLOY_REF" == */ || "$DEPLOY_REF" == *//* ]]; then
  echo "DEPLOY_REF contains unsupported characters: $DEPLOY_REF" >&2
  exit 2
fi
if [ ! -d "$DEPLOY_REPO_PATH/.git" ]; then
  echo "Deployment repository is missing: $DEPLOY_REPO_PATH" >&2
  exit 1
fi
if [ ! -f "$DEPLOY_REPO_PATH/.env" ]; then
  echo "Production environment file is missing: $DEPLOY_REPO_PATH/.env" >&2
  exit 1
fi
for command in flock git install mktemp; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Required remote deployment command is missing: $command" >&2
    exit 127
  fi
done

cleanup() {
  local exit_code="$?"
  trap - EXIT
  set +e
  if [ -n "$DEPLOY_WORKTREE" ] && [ -e "$DEPLOY_WORKTREE/.git" ]; then
    git -C "$DEPLOY_REPO_PATH" worktree remove --force "$DEPLOY_WORKTREE"
  fi
  git -C "$DEPLOY_REPO_PATH" worktree prune
  exit "$exit_code"
}
trap cleanup EXIT

cd "$DEPLOY_REPO_PATH"
exec 9>"$DEPLOY_REPO_PATH/.git/persona-deploy.lock"
if ! flock -n 9; then
  echo "Another production deployment is already running." >&2
  exit 1
fi

echo "::group::Fetch validated deployment commit"
git fetch --no-tags "$DEPLOY_REPOSITORY" "$DEPLOY_REF"
if ! git cat-file -e "$DEPLOY_SHA^{commit}" 2>/dev/null; then
  git fetch --no-tags "$DEPLOY_REPOSITORY" "$DEPLOY_SHA"
fi
resolved_sha="$(git rev-parse "$DEPLOY_SHA^{commit}")"
if [ "$resolved_sha" != "$DEPLOY_SHA" ]; then
  echo "Fetched commit does not match the validated commit: $resolved_sha" >&2
  exit 1
fi
echo "Deploying validated commit $DEPLOY_SHA from $DEPLOY_REF."
echo "::endgroup::"

git worktree prune
DEPLOY_WORKTREE="$(mktemp -d "${TMPDIR:-/tmp}/persona-deploy.XXXXXX")"
rmdir "$DEPLOY_WORKTREE"
git worktree add --detach "$DEPLOY_WORKTREE" "$DEPLOY_SHA"

install -m 0600 "$DEPLOY_REPO_PATH/.env" "$DEPLOY_WORKTREE/.env"
if [ -f "$DEPLOY_REPO_PATH/.env.local" ]; then
  install -m 0600 \
    "$DEPLOY_REPO_PATH/.env.local" \
    "$DEPLOY_WORKTREE/.env.local"
fi

SOURCE_ALREADY_UPDATED=true \
DEPLOY_COMMIT="$DEPLOY_SHA" \
DEPLOY_BRANCH="$DEPLOY_REF" \
DEPLOY_PATH="$DEPLOY_WORKTREE" \
DEPLOY_REPOSITORY="$DEPLOY_REPOSITORY" \
OPERATIONS_PROJECT_PATH="$DEPLOY_REPO_PATH" \
PRODUCTION_ENV_FILE="$DEPLOY_REPO_PATH/.env" \
APP_NAME=yeshunt \
bash "$DEPLOY_WORKTREE/scripts/deploy.sh"
