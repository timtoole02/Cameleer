#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROW_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BUNDLE_ROOT="$(cd -- "$ROW_ROOT/.." && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
export ROW_ROOT BUNDLE_ROOT REPO_ROOT
cd "$REPO_ROOT" && node scripts/run-llama3-prompt-pack.mjs --backend ${CAMELID_API_BASE:-http://127.0.0.1:8181} --llama-url ${TINYLLAMA_LLAMA_SERVER_URL:-http://127.0.0.1:8183} --model "${CAMELID_MODEL_DIR:?set CAMELID_MODEL_DIR to the GGUF directory}/tinyllama-1.1b-chat-v1.0.Q8_0.gguf" --model-id tinyllama-q8 --llama-server "${CAMELID_LLAMA_SERVER_BIN:-target/reference/llama.cpp/build/bin/llama-server}" --llama-tokenize "${CAMELID_LLAMA_TOKENIZE_BIN:-target/reference/llama.cpp/build/bin/llama-tokenize}" --start-llama-server --pack qa/prompt-packs/tinyllama-chat-template-shapes.json --out-dir $ROW_ROOT/chat-template-shapes --wait-ms 180000 --require-prompt-match --require-generated-match
