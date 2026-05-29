#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BUNDLE_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
export BUNDLE_ROOT REPO_ROOT
set -euo pipefail
cd "$BUNDLE_ROOT"
./commands/build-current-head.sh
./commands/capture-host-facts.sh > host-facts.txt
echo "== tinyllama_1_1b_chat_q8_0 =="
( cd "$BUNDLE_ROOT/tinyllama_1_1b_chat_q8_0/commands" && ./00-model-sha256.sh )
( cd "$BUNDLE_ROOT/tinyllama_1_1b_chat_q8_0/commands" && ./01-compact-parity.sh )
( cd "$BUNDLE_ROOT/tinyllama_1_1b_chat_q8_0/commands" && ./02-broader-parity.sh )
( cd "$BUNDLE_ROOT/tinyllama_1_1b_chat_q8_0/commands" && ./03-chat-template-shapes.sh )
( cd "$BUNDLE_ROOT/tinyllama_1_1b_chat_q8_0/commands" && ./04-context-512.sh )
( cd "$BUNDLE_ROOT/tinyllama_1_1b_chat_q8_0/commands" && ./05-api-webui-smoke.sh )
( cd "$BUNDLE_ROOT/tinyllama_1_1b_chat_q8_0/commands" && ./06-perf-rss-portability.sh )
echo "== llama32_1b_instruct_q8_0 =="
( cd "$BUNDLE_ROOT/llama32_1b_instruct_q8_0/commands" && ./00-model-sha256.sh )
( cd "$BUNDLE_ROOT/llama32_1b_instruct_q8_0/commands" && ./01-compact-parity.sh )
( cd "$BUNDLE_ROOT/llama32_1b_instruct_q8_0/commands" && ./02-broader-parity.sh )
( cd "$BUNDLE_ROOT/llama32_1b_instruct_q8_0/commands" && ./03-chat-template-shapes.sh )
( cd "$BUNDLE_ROOT/llama32_1b_instruct_q8_0/commands" && ./04-context-512.sh )
( cd "$BUNDLE_ROOT/llama32_1b_instruct_q8_0/commands" && ./05-api-webui-smoke.sh )
( cd "$BUNDLE_ROOT/llama32_1b_instruct_q8_0/commands" && ./06-perf-rss-portability.sh )
echo "== llama32_3b_instruct_q8_0 =="
( cd "$BUNDLE_ROOT/llama32_3b_instruct_q8_0/commands" && ./00-model-sha256.sh )
( cd "$BUNDLE_ROOT/llama32_3b_instruct_q8_0/commands" && ./01-compact-parity.sh )
( cd "$BUNDLE_ROOT/llama32_3b_instruct_q8_0/commands" && ./02-broader-parity.sh )
( cd "$BUNDLE_ROOT/llama32_3b_instruct_q8_0/commands" && ./03-chat-template-shapes.sh )
( cd "$BUNDLE_ROOT/llama32_3b_instruct_q8_0/commands" && ./04-context-512.sh )
( cd "$BUNDLE_ROOT/llama32_3b_instruct_q8_0/commands" && ./05-api-webui-smoke.sh )
( cd "$BUNDLE_ROOT/llama32_3b_instruct_q8_0/commands" && ./06-perf-rss-portability.sh )
echo "== llama3_8b_instruct_q8_0 =="
( cd "$BUNDLE_ROOT/llama3_8b_instruct_q8_0/commands" && ./00-model-sha256.sh )
( cd "$BUNDLE_ROOT/llama3_8b_instruct_q8_0/commands" && ./01-compact-parity.sh )
( cd "$BUNDLE_ROOT/llama3_8b_instruct_q8_0/commands" && ./02-broader-parity.sh )
( cd "$BUNDLE_ROOT/llama3_8b_instruct_q8_0/commands" && ./03-chat-template-shapes.sh )
( cd "$BUNDLE_ROOT/llama3_8b_instruct_q8_0/commands" && ./04-context-512.sh )
( cd "$BUNDLE_ROOT/llama3_8b_instruct_q8_0/commands" && ./05-api-webui-smoke.sh )
( cd "$BUNDLE_ROOT/llama3_8b_instruct_q8_0/commands" && ./06-perf-rss-portability.sh )
