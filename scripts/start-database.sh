#!/usr/bin/env bash
# Use this script to start a docker container for a local development database

# TO RUN ON WINDOWS:
# 1. Install WSL (Windows Subsystem for Linux) - https://learn.microsoft.com/en-us/windows/wsl/install
# 2. Install Docker Desktop or Podman Deskop
# - Docker Desktop for Windows - https://docs.docker.com/docker-for-windows/install/
# - Podman Desktop - https://podman.io/getting-started/installation
# 3. Open WSL - `wsl`
# 4. Run this script - `./scripts/start-database.sh`

# On Linux and macOS you can run this script directly - `./scripts/start-database.sh`

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# import env variables from .env
set -a
source "$REPO_ROOT/.env"

DB_PASSWORD=$(echo "$DATABASE_URL" | awk -F':' '{print $3}' | awk -F'@' '{print $1}')
DB_PORT=$(echo "$DATABASE_URL" | awk -F':' '{print $4}' | awk -F'/' '{print $1}')
DB_NAME=$(echo "$DATABASE_URL" | awk -F'/' '{print $4}')
DB_CONTAINER_NAME="$DB_NAME-postgres"
DB_BIND_ADDRESS="127.0.0.1"
DB_NETWORK_NAME="persona-management-internal"
DB_NETWORK_ALIAS="postgres-internal"

if ! [ -x "$(command -v docker)" ] && ! [ -x "$(command -v podman)" ]; then
  echo -e "Docker or Podman is not installed. Please install docker or podman and try again.\nDocker install guide: https://docs.docker.com/engine/install/\nPodman install guide: https://podman.io/getting-started/installation"
  exit 1
fi

# determine which docker command to use
if [ -x "$(command -v docker)" ]; then
  DOCKER_CMD="docker"
elif [ -x "$(command -v podman)" ]; then
  DOCKER_CMD="podman"
fi

if ! $DOCKER_CMD info > /dev/null 2>&1; then
  echo "$DOCKER_CMD daemon is not running. Please start $DOCKER_CMD and try again."
  exit 1
fi

if ! $DOCKER_CMD network inspect "$DB_NETWORK_NAME" > /dev/null 2>&1; then
  $DOCKER_CMD network create "$DB_NETWORK_NAME" > /dev/null
fi

if command -v nc >/dev/null 2>&1; then
  if nc -z localhost "$DB_PORT" 2>/dev/null; then
    echo "Port $DB_PORT is already in use."
    exit 1
  fi
else
  echo "Warning: Unable to check if port $DB_PORT is already in use (netcat not installed)"
  read -p "Do you want to continue anyway? [y/N]: " -r REPLY
  if ! [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborting."
    exit 1
  fi
fi

if [ "$($DOCKER_CMD ps -q -f name=$DB_CONTAINER_NAME)" ]; then
  echo "Database container '$DB_CONTAINER_NAME' already running"
  exit 0
fi

if [ "$($DOCKER_CMD ps -q -a -f name=$DB_CONTAINER_NAME)" ]; then
  EXISTING_BINDINGS=$($DOCKER_CMD port "$DB_CONTAINER_NAME" 5432/tcp 2>/dev/null || true)
  if echo "$EXISTING_BINDINGS" | grep -Eq '(^|[[:space:]])0\.0\.0\.0:|(^|[[:space:]]):::|(^|[[:space:]])\[::\]:'; then
    echo "Existing database container '$DB_CONTAINER_NAME' is published on a non-local interface."
    echo "Refusing to start it because that would expose Postgres to the network."
    echo "Remove and recreate it so the port binds only to $DB_BIND_ADDRESS:"
    echo "  $DOCKER_CMD rm -f $DB_CONTAINER_NAME"
    echo "  ./scripts/start-database.sh"
    exit 1
  fi

  $DOCKER_CMD start "$DB_CONTAINER_NAME"
  echo "Existing database container '$DB_CONTAINER_NAME' started"
  exit 0
fi

if [ "$DB_PASSWORD" = "password" ]; then
  echo "You are using the default database password"
  read -p "Should we generate a random password for you? [y/N]: " -r REPLY
  if ! [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Please change the default password in the .env file and try again"
    exit 1
  fi
  # Generate a random URL-safe password
  DB_PASSWORD=$(openssl rand -base64 12 | tr '+/' '-_')
  if [[ "$(uname)" == "Darwin" ]]; then
    # macOS requires an empty string to be passed with the `i` flag
    sed -i '' "s#:password@#:$DB_PASSWORD@#" "$REPO_ROOT/.env"
  else
    sed -i "s#:password@#:$DB_PASSWORD@#" "$REPO_ROOT/.env"
  fi
fi

DB_VOLUME_NAME="$DB_NAME-postgres-data"

$DOCKER_CMD run -d \
  --name $DB_CONTAINER_NAME \
  --network "$DB_NETWORK_NAME" \
  --network-alias "$DB_NETWORK_ALIAS" \
  -e POSTGRES_USER="postgres" \
  -e POSTGRES_PASSWORD="$DB_PASSWORD" \
  -e POSTGRES_DB="$DB_NAME" \
  -v "$DB_VOLUME_NAME:/var/lib/postgresql" \
  -p "$DB_BIND_ADDRESS:$DB_PORT:5432" \
  docker.io/postgres && echo "Database container '$DB_CONTAINER_NAME' was successfully created"
