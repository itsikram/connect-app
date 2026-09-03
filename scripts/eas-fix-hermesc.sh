#!/usr/bin/env bash

set -euo pipefail

if [[ "${EAS_BUILD_PLATFORM:-}" != "android" ]]; then
  exit 0
fi

echo "Reinstalling JavaScript dependencies from package-lock.json..."
npm ci --legacy-peer-deps --ignore-scripts

hermesc_root="node_modules/react-native/sdks/hermesc"
if [[ ! -d "$hermesc_root" ]]; then
  echo "ERROR: React Native Hermes compiler directory is missing: $hermesc_root" >&2
  exit 1
fi

shopt -s globstar nullglob
chmod +x "$hermesc_root"/**/*hermesc* 2>/dev/null || true

hermesc="$hermesc_root/linux64-bin/hermesc"
if [[ ! -f "$hermesc" ]]; then
  echo "ERROR: Linux Hermes compiler is missing: $hermesc" >&2
  exit 1
fi

if [[ ! -x "$hermesc" ]]; then
  echo "ERROR: Linux Hermes compiler is not executable after chmod: $hermesc" >&2
  exit 1
fi

echo "Hermes compiler is present and executable: $hermesc"
