#!/usr/bin/env bash
set -euo pipefail

# Create a timestamped archive of the Directus uploads volume.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if ! [ -x "$(command -v docker)" ] && ! [ -x "$(command -v podman)" ]; then
  echo "Docker or Podman is not installed."
  exit 1
fi

if [ -x "$(command -v docker)" ]; then
  DOCKER_CMD="docker"
else
  DOCKER_CMD="podman"
fi

BACKUP_DIR="${BACKUP_DIR:-$REPO_ROOT/backups}"
TIMESTAMP=$(date -u +"%Y%m%dT%H%M%SZ")
ARCHIVE_PATH="$BACKUP_DIR/directus-uploads-${TIMESTAMP}.tar.gz"
VOLUME_NAME="${DIRECTUS_UPLOADS_VOLUME:-persona-management_directus_uploads}"
ARCHIVE_IMAGE="${DIRECTUS_BACKUP_IMAGE:-directus/directus@sha256:8543bb57029d6e4087fd6bd83944233b271b3858465aa8e43d888e618bbe0a69}"

mkdir -p "$BACKUP_DIR"

$DOCKER_CMD run --rm \
  --user root \
  -v "$VOLUME_NAME:/source:ro" \
  -v "$BACKUP_DIR:/backup" \
  "$ARCHIVE_IMAGE" \
  sh -lc "tar -C /source -czf /backup/$(basename "$ARCHIVE_PATH") ."

echo "Uploads backup created at $ARCHIVE_PATH"
