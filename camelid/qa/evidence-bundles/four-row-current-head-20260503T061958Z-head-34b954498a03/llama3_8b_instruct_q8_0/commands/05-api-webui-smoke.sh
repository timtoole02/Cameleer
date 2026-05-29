#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROW_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BUNDLE_ROOT="$(cd -- "$ROW_ROOT/.." && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
export ROW_ROOT BUNDLE_ROOT REPO_ROOT
cd "$REPO_ROOT" && node scripts/model-promotion-smoke-bundle.mjs --api ${CAMELID_API_BASE:-http://127.0.0.1:8181} --frontend ${CAMELID_FRONTEND_URL:-http://127.0.0.1:4175} --model "${CAMELID_MODEL_DIR:?set CAMELID_MODEL_DIR to the GGUF directory}/Meta-Llama-3-8B-Instruct-Q8_0.gguf" --model-id llama3-8b-q8 --out-dir $ROW_ROOT/api-webui --message hello --max-tokens 1 --temperature 0 --expect-compatibility-row llama3_8b_instruct_q8_0 --expect-compatibility-status supported_exact_row_smoke --expect-contract-supported true --expect-webui-chat enabled
