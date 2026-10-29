#!/usr/bin/env bash

set -euo pipefail

if [[ "${EAS_BUILD_PLATFORM:-}" != "android" ]]; then
  exit 0
fi

echo "Reinstalling JavaScript dependencies from package-lock.json..."
npm ci --legacy-peer-deps --ignore-scripts

# --ignore-scripts skips react-native-skia's postinstall, which copies its
# prebuilt libskia.a into libs/android; without it the CMake step fails with
# "Skia prebuilt binaries not found".
skia_install="node_modules/@shopify/react-native-skia/scripts/install-libs.js"
if [[ -f "$skia_install" ]]; then
  echo "Installing Skia prebuilt binaries..."
  node "$skia_install"
fi

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
