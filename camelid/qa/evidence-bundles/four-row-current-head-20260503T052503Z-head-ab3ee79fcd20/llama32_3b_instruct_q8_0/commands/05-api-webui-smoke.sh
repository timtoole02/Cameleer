#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROW_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BUNDLE_ROOT="$(cd -- "$ROW_ROOT/.." && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
export ROW_ROOT BUNDLE_ROOT REPO_ROOT
cd "$REPO_ROOT" && node scripts/model-promotion-smoke-bundle.mjs --api ${CAMELID_API_BASE:-http://127.0.0.1:8181} --frontend ${CAMELID_FRONTEND_URL:-http://127.0.0.1:4175} --model "${CAMELID_MODEL_DIR:?set CAMELID_MODEL_DIR to the GGUF directory}/Llama-3.2-3B-Instruct-Q8_0.gguf" --model-id llama32-3b-q8 --out-dir $ROW_ROOT/api-webui --message hello --max-tokens 1 --temperature 0 --expect-compatibility-row llama32_3b_instruct_q8_0 --expect-compatibility-status evidence_backed_validation_lane --expect-contract-supported false --expect-webui-chat guarded
