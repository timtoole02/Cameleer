#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROW_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BUNDLE_ROOT="$(cd -- "$ROW_ROOT/.." && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
export ROW_ROOT BUNDLE_ROOT REPO_ROOT
set -euo pipefail
cd "$REPO_ROOT"
MODEL="${CAMELID_MODEL_DIR:?set CAMELID_MODEL_DIR to the GGUF directory}/tinyllama-1.1b-chat-v1.0.Q8_0.gguf"
mkdir -p "$ROW_ROOT/evidence"
shasum -a 256 "$MODEL" | tee "$ROW_ROOT/evidence/model.sha256.txt"
