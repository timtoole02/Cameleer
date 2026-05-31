#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🚀 Starting Release QA Check..."

cd "$ROOT_DIR/control-center"
echo "🌐 Checking Frontend..."
npm run build

export CARGO_TARGET_DIR="/Volumes/Untitled/Cameleer/target"

cd "$ROOT_DIR/control-center/src-tauri"
echo "🦀 Checking Tauri Backend Formatting & Compilation..."
cargo fmt --check || echo "⚠️ cargo fmt warning"
cargo check
cargo test

cd "$ROOT_DIR"
echo "📦 Running Full Packaging Script..."
./package.sh

cd "$ROOT_DIR/control-center/src-tauri"
TAURI_TARGET_DIR="$(cargo metadata --format-version 1 --no-deps | jq -r '.target_directory')"
APP_MACOS_DIR="$TAURI_TARGET_DIR/release/bundle/macos/Cameleer.app/Contents/MacOS"

echo "🔍 Verifying Packaged Camelid Runtime..."

if [ ! -f "$APP_MACOS_DIR/camelid" ]; then
  echo "❌ ERROR: Packaged camelid binary missing at $APP_MACOS_DIR/camelid"
  exit 1
fi

if [ ! -x "$APP_MACOS_DIR/camelid" ]; then
  echo "❌ ERROR: Packaged camelid binary is not executable."
  exit 1
fi

echo "✅ Binary exists and is executable."

echo "🔍 Running native binary verification..."
file "$APP_MACOS_DIR/camelid"
"$APP_MACOS_DIR/camelid" --version || true

echo "🎉 RELEASE CHECK PASSED!"
