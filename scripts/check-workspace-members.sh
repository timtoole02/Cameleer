#!/usr/bin/env bash
# WorkspaceGhostMember guard (HARDPAN G1).
# Asserts the Cargo workspace contains EXACTLY the crates that ship in the app,
# so the quarantined legacy gateway (or any other crate) can never silently
# rejoin the build. Run locally or in CI; exits non-zero on any drift.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

EXPECTED="camelid control-center"

# Names of workspace member packages, sorted, space-joined.
ACTUAL="$(cargo metadata --no-deps --format-version 1 \
  | python3 -c 'import json,sys; m=json.load(sys.stdin); ids=set(m["workspace_members"]); print(" ".join(sorted(p["name"] for p in m["packages"] if p["id"] in ids)))')"

if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "❌ WorkspaceGhostMember: workspace members drifted."
  echo "   expected: $EXPECTED"
  echo "   actual:   $ACTUAL"
  echo "   A crate that does not ship in the app must not be a workspace member."
  exit 1
fi

echo "✅ Workspace members are exactly: $EXPECTED"
