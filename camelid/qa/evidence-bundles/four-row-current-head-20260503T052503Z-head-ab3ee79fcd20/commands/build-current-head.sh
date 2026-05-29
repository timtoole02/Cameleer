#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
export BUNDLE_ROOT REPO_ROOT
cd "$REPO_ROOT" && ./scripts/with-rustup-cargo.sh +1.87.0 build --release --bin backendinference
