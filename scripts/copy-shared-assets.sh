#!/usr/bin/env bash
#
# copy-shared-assets.sh
# Copies shared assets from @repo/design-system to all apps' public directories.
# Run this before building any app to ensure icons are available.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ASSETS_DIR="${REPO_ROOT}/packages/design-system/assets"

# Shared assets to copy (add new files here)
ASSETS=(
  "icon.svg"
  "favicon.ico"
  "apple-touch-icon.png"
)

# Apps that need the assets
APPS=(
  "web"
  "admin"
  "landing"
  "landing-static"
  "storybook"
  "demo"
)

# Validate all source assets exist
for asset in "${ASSETS[@]}"; do
  if [[ ! -f "${ASSETS_DIR}/${asset}" ]]; then
    echo "[assets] Error: Source asset not found: ${ASSETS_DIR}/${asset}" >&2
    exit 1
  fi
done

copied=0

for app in "${APPS[@]}"; do
  PUBLIC_DIR="${REPO_ROOT}/apps/${app}/public"
  mkdir -p "${PUBLIC_DIR}"

  for asset in "${ASSETS[@]}"; do
    src="${ASSETS_DIR}/${asset}"
    dest="${PUBLIC_DIR}/${asset}"

    # Skip if destination is already identical
    if [[ -f "${dest}" ]] && cmp -s "${src}" "${dest}"; then
      continue
    fi

    cp "${src}" "${dest}"
    echo "  + Copied ${asset} to apps/${app}/public/"
    copied=$((copied + 1))
  done
done

if [[ ${copied} -eq 0 ]]; then
  echo "[assets] All apps already up to date."
else
  echo "[assets] Done. Copied ${copied} file(s)."
fi
