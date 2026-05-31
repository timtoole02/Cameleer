#!/bin/bash
set -euo pipefail

export COPYFILE_DISABLE=1
export COPY_EXTENDED_ATTRIBUTES_DISABLE=1

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export CARGO_TARGET_DIR="/Volumes/Untitled/Cameleer/target"
echo "📦 Starting Cameleer Production Build from $ROOT_DIR..."

cd "$ROOT_DIR/camelid"
CAMELID_TARGET_DIR="$(cargo metadata --format-version 1 --no-deps | jq -r '.target_directory')"
echo "🦀 Building Camelid backend..."
cargo build --release --bin camelid
CAMELID_BIN="$CAMELID_TARGET_DIR/release/camelid"

if [ ! -x "$CAMELID_BIN" ]; then
  echo "ERROR: camelid binary missing or not executable at $CAMELID_BIN"
  exit 1
fi
echo "✅ Camelid built successfully at $CAMELID_BIN"

cd "$ROOT_DIR/control-center"
echo "🌐 Building Frontend..."
npm install
npm run build

echo "🖥️ Packaging Mac App Bundle..."
npm run tauri build

cd "$ROOT_DIR/control-center/src-tauri"
TAURI_TARGET_DIR="$(cargo metadata --format-version 1 --no-deps | jq -r '.target_directory')"
APP_BUNDLE="$TAURI_TARGET_DIR/release/bundle/macos/Cameleer.app"

if [ ! -d "$APP_BUNDLE" ]; then
    echo "ERROR: App bundle not found at $APP_BUNDLE"
    exit 1
fi

APP_MACOS_DIR="$APP_BUNDLE/Contents/MacOS"
echo "📦 Injecting Camelid runtime into App bundle at $APP_MACOS_DIR..."

mkdir -p "$APP_MACOS_DIR"
cp "$CAMELID_BIN" "$APP_MACOS_DIR/camelid"
chmod +x "$APP_MACOS_DIR/camelid"

if [ ! -x "$APP_MACOS_DIR/camelid" ]; then
  echo "ERROR: packaged camelid binary missing at $APP_MACOS_DIR/camelid"
  exit 1
fi

echo "✅ Packaged Camelid runtime: $APP_MACOS_DIR/camelid"
echo "✅ Build Complete! App bundle is located at $APP_BUNDLE"
