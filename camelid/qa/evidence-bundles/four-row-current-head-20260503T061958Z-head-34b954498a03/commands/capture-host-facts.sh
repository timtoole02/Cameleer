#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
export BUNDLE_ROOT REPO_ROOT
set -euo pipefail
cd "$REPO_ROOT"
date -u +%FT%TZ
git rev-parse HEAD
git status --short
uname -a
hostname
node --version
./scripts/with-rustup-cargo.sh --version
if command -v free >/dev/null 2>&1; then
  free -h
elif command -v vm_stat >/dev/null 2>&1; then
  vm_stat
  if command -v sysctl >/dev/null 2>&1; then sysctl hw.memsize 2>/dev/null || true; fi
  if command -v memory_pressure >/dev/null 2>&1; then memory_pressure 2>/dev/null || true; fi
else
  echo "memory facts unavailable on this host"
fi
df -h /
