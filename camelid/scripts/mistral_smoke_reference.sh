#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODEL_PATH="${MISTRAL_MODEL_PATH:-${CAMELID_MODEL_DIR:-}/mistral-7b-instruct-v0.3-q8_0.gguf}"
LLAMA_TOKENIZE_BIN="${MISTRAL_LLAMA_TOKENIZE_BIN:-${CAMELID_LLAMA_TOKENIZE_BIN:-$REPO_ROOT/target/reference/llama.cpp/build/bin/llama-tokenize}}"
OUT_PATH="${1:-$REPO_ROOT/fixtures/tokenizer/mistral-7b-instruct-v0.3-reference-pack.template.json}"

if [[ ! -f "$MODEL_PATH" ]]; then
  echo "missing Mistral GGUF: $MODEL_PATH" >&2
  echo "set MISTRAL_MODEL_PATH or CAMELID_MODEL_DIR to the exact Mistral-7B-Instruct-v0.3 Q8_0 GGUF path" >&2
  exit 1
fi

if [[ ! -x "$LLAMA_TOKENIZE_BIN" ]]; then
  echo "missing llama-tokenize binary: $LLAMA_TOKENIZE_BIN" >&2
  echo "set MISTRAL_LLAMA_TOKENIZE_BIN or CAMELID_LLAMA_TOKENIZE_BIN" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT_PATH")"

echo "# sha256" >&2
sha256sum "$MODEL_PATH" >&2

echo "# writing tokenizer/chat-template reference pack to $OUT_PATH" >&2
node "$REPO_ROOT/scripts/mistral-reference-pack.mjs" \
  --model "$MODEL_PATH" \
  --llama-tokenize "$LLAMA_TOKENIZE_BIN" \
  --out "$OUT_PATH"
