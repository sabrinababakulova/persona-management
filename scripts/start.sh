#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

set -a
source "$REPO_ROOT/.env"
set +a

if [ "$NODE_ENV" = "production" ]; then
  export AUTH_URL="https://ilovehr.uz"
else
  export AUTH_URL="http://localhost:3000"
fi

exec bun run start
