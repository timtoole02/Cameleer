#!/usr/bin/env bash
# release-check.sh (HARDPAN G2) — the portable release gate.
# Runs on any machine (no /Volumes/* assumptions, no missing package.sh).
# Exits non-zero on the first broken step. macOS-only for the packaging step.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🚀 Cameleer release check"
echo "   repo: $ROOT_DIR"
echo "   host: $(uname -srm)"
echo

echo "🧭 Workspace member guard…"
"$ROOT_DIR/scripts/check-workspace-members.sh"
echo

echo "🌐 Frontend: typecheck + lint + tests…"
cd "$ROOT_DIR/control-center"
npm run typecheck
npm run lint
npx vitest run
npm run smoke:p0
echo

echo "🦀 Backend: format + clippy + tests…"
cd "$ROOT_DIR"
cargo fmt -p control-center -- --check
cargo clippy -p control-center --all-targets -- -D warnings
cargo test -p control-center
echo

if [ "$(uname -s)" = "Darwin" ]; then
  echo "📦 Packaging (macOS)…"
  "$ROOT_DIR/scripts/package.sh"
else
  echo "⏭️  Skipping packaging: macOS bundle can only be built on macOS."
fi

echo
echo "🎉 RELEASE CHECK PASSED"
