#!/usr/bin/env bash
# package.sh (HARDPAN G2) — build the macOS app bundle and verify the bundled
# camelid runtime. Portable: no hardcoded external volumes. Exits non-zero on
# any missing or broken step. Reusable by release-check.sh and CI.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "📦 Building macOS bundle (npm run tauri build)…"
cd "$ROOT_DIR/control-center"
# `tauri build` runs prepare:camelid (stages src-tauri/camelid), tsc, vite build,
# the release cargo build, and bundles the .app + .dmg. No signing.
npm run tauri build

# Locate the cargo target dir (portable — from metadata, never a hardcoded path).
TARGET_DIR="$(cargo metadata --manifest-path "$ROOT_DIR/control-center/src-tauri/Cargo.toml" \
  --format-version 1 --no-deps | python3 -c 'import json,sys;print(json.load(sys.stdin)["target_directory"])')"
BUNDLE_DIR="$TARGET_DIR/release/bundle"

APP_PATH="$(find "$BUNDLE_DIR/macos" -maxdepth 1 -name '*.app' -print -quit 2>/dev/null || true)"
if [ -z "${APP_PATH:-}" ] || [ ! -d "$APP_PATH" ]; then
  echo "❌ ERROR: no .app bundle found under $BUNDLE_DIR/macos"
  exit 1
fi
echo "✅ App bundle: $APP_PATH"

DMG_PATH="$(find "$BUNDLE_DIR/dmg" -maxdepth 1 -name '*.dmg' -print -quit 2>/dev/null || true)"
[ -n "${DMG_PATH:-}" ] && echo "✅ DMG: $DMG_PATH" || echo "ℹ️  (no .dmg produced — .app is the primary artifact)"

# Verify the bundled camelid runtime (wherever Tauri placed the resource).
CAMELID_BIN="$(find "$APP_PATH" -name camelid -type f -print -quit 2>/dev/null || true)"
if [ -z "${CAMELID_BIN:-}" ]; then
  echo "❌ ERROR: bundled camelid binary not found anywhere inside $APP_PATH"
  exit 1
fi
echo "✅ Bundled camelid: ${CAMELID_BIN#"$APP_PATH"/}"

if [ ! -x "$CAMELID_BIN" ]; then
  echo "❌ ERROR: bundled camelid binary is not executable."
  exit 1
fi

echo "🔍 Native binary check:"
file "$CAMELID_BIN"
# NOTE: the camelid CLI has no `--version` flag (it rejects it); it exposes
# subcommands (serve/inspect/…). We verify it actually runs by invoking --help,
# which prints usage and exits 0. A broken/incompatible binary fails here.
if ! "$CAMELID_BIN" --help >/dev/null 2>&1; then
  echo "❌ ERROR: bundled camelid binary did not run ('camelid --help' failed)."
  exit 1
fi
echo "✅ Bundled camelid runs (camelid --help → exit 0)."

echo "🎉 package.sh: bundle built and camelid runtime verified."
