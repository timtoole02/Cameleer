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
free -h
df -h /
