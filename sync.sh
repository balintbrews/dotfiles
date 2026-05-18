#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

STOW_ARGS=(--target="$HOME" --dotfiles --restow)

if [ "${1:-}" = "--adopt" ]; then
  STOW_ARGS+=(--adopt)
  shift
fi

PACKAGES=()
for dir in */; do
  PACKAGES+=("${dir%/}")
done

stow "${STOW_ARGS[@]}" "${PACKAGES[@]}"
