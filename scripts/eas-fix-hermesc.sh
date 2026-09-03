#!/usr/bin/env bash

set -euo pipefail

if [[ "${EAS_BUILD_PLATFORM:-}" != "android" ]]; then
  exit 0
fi

echo "Reinstalling JavaScript dependencies from package-lock.json..."
npm ci --legacy-peer-deps --ignore-scripts

hermesc_root="node_modules/react-native/sdks/hermesc"
hermesc_package="node_modules/hermes-compiler/hermesc"
hermesc="$hermesc_root/linux64-bin/hermesc"

# React Native 0.86.3 receives hermesc from the separate hermes-compiler package.
if [[ ! -f "$hermesc" ]]; then
  if [[ ! -d "$hermesc_package" ]]; then
    echo "ERROR: Hermes compiler package is missing: $hermesc_package" >&2
    exit 1
  fi

  echo "Restoring Hermes compiler files to the React Native SDK path..."
  mkdir -p "$hermesc_root"
  cp -R "$hermesc_package"/. "$hermesc_root"/
fi

if [[ ! -f "$hermesc" ]]; then
  echo "ERROR: Linux Hermes compiler is missing: $hermesc" >&2
  exit 1
fi

chmod +x "$hermesc"

if [[ ! -x "$hermesc" ]]; then
  echo "ERROR: Linux Hermes compiler is not executable after chmod: $hermesc" >&2
  exit 1
fi

echo "Hermes compiler is present and executable: $hermesc"
