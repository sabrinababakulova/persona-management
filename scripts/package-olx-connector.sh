#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="$project_dir/browser-extension/olx-connector"
output_dir="$project_dir/build"
version="$(bun -e 'const manifest = await Bun.file(process.argv[1]).json(); process.stdout.write(manifest.version)' "$source_dir/manifest.production.json")"
output_file="$output_dir/talanty-olx-connector-$version.zip"
staging_dir="$(mktemp -d)"

cleanup() {
  rm -rf "$staging_dir"
}
trap cleanup EXIT

mkdir -p "$staging_dir/icons" "$output_dir"
cp "$source_dir/background.js" "$staging_dir/background.js"
cp "$source_dir/olx-content.js" "$staging_dir/olx-content.js"
cp "$source_dir/persona-content.js" "$staging_dir/persona-content.js"
cp "$source_dir/popup.css" "$staging_dir/popup.css"
cp "$source_dir/popup.html" "$staging_dir/popup.html"
cp "$source_dir/popup.js" "$staging_dir/popup.js"
cp "$source_dir/manifest.production.json" "$staging_dir/manifest.json"
cp "$source_dir/icons/icon16.png" "$staging_dir/icons/icon16.png"
cp "$source_dir/icons/icon32.png" "$staging_dir/icons/icon32.png"
cp "$source_dir/icons/icon48.png" "$staging_dir/icons/icon48.png"
cp "$source_dir/icons/icon128.png" "$staging_dir/icons/icon128.png"

rm -f "$output_file"
(
  cd "$staging_dir"
  zip -q -r "$output_file" .
)

printf '%s\n' "Created $output_file"
