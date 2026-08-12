#!/bin/sh
set -eu
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
target_dir=${1:-"$project_dir/../../.obsidian/plugins/client-kanban"}
mkdir -p "$target_dir"
cp "$project_dir/main.js" "$project_dir/manifest.json" "$project_dir/styles.css" "$target_dir/"
printf 'Deployed Client Kanban to %s\n' "$target_dir"
