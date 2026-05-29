#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROW_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BUNDLE_ROOT="$(cd -- "$ROW_ROOT/.." && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
export ROW_ROOT BUNDLE_ROOT REPO_ROOT
set -euo pipefail
cd "$REPO_ROOT"
mkdir -p "$ROW_ROOT/perf-rss-portability"
MODEL="${CAMELID_MODEL_DIR:?set CAMELID_MODEL_DIR to the GGUF directory}/Llama-3.2-3B-Instruct-Q8_0.gguf"
MODEL_ID="llama32-3b-q8"
API_BASE="${CAMELID_API_BASE:-http://127.0.0.1:8181}"
FRONTEND_URL="${CAMELID_FRONTEND_URL:-http://127.0.0.1:4175}"
WAIT_MS="300000"
date -u +%FT%TZ | tee "$ROW_ROOT/perf-rss-portability/captured-at.txt"
uname -a | tee "$ROW_ROOT/perf-rss-portability/uname.txt"
hostname | tee "$ROW_ROOT/perf-rss-portability/hostname.txt"
node --version | tee "$ROW_ROOT/perf-rss-portability/node-version.txt"
./scripts/with-rustup-cargo.sh --version | tee "$ROW_ROOT/perf-rss-portability/cargo-version.txt"
free -h | tee "$ROW_ROOT/perf-rss-portability/free.txt"
df -h / | tee "$ROW_ROOT/perf-rss-portability/disk-root.txt"
shasum -a 256 "$MODEL" | tee "$ROW_ROOT/perf-rss-portability/model.sha256.txt"
node scripts/model-promotion-smoke-bundle.mjs --api ${CAMELID_API_BASE:-http://127.0.0.1:8181} --frontend ${CAMELID_FRONTEND_URL:-http://127.0.0.1:4175} --model "${CAMELID_MODEL_DIR:?set CAMELID_MODEL_DIR to the GGUF directory}/Llama-3.2-3B-Instruct-Q8_0.gguf" --model-id llama32-3b-q8 --out-dir "$ROW_ROOT/perf-rss-portability/api-webui-smoke" --message hello --max-tokens 1 --temperature 0 || true
pgrep -f 'target/release/backendinference serve' | tail -n 1 | tee "$ROW_ROOT/perf-rss-portability/backend.pid.txt"
if [ -s "$ROW_ROOT/perf-rss-portability/backend.pid.txt" ]; then ps -o pid,rss,vsz,etime,command -p "$(cat "$ROW_ROOT/perf-rss-portability/backend.pid.txt")" | tee "$ROW_ROOT/perf-rss-portability/backend.ps.txt"; fi
