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
MODEL="${CAMELID_MODEL_DIR:?set CAMELID_MODEL_DIR to the GGUF directory}/Llama-3.2-1B-Instruct-Q8_0.gguf"
MODEL_ID="llama32-1b-q8"
API_BASE="${CAMELID_API_BASE:-http://127.0.0.1:8181}"
FRONTEND_URL="${CAMELID_FRONTEND_URL:-http://127.0.0.1:4175}"
WAIT_MS="180000"
date -u +%FT%TZ | tee "$ROW_ROOT/perf-rss-portability/captured-at.txt"
uname -a | tee "$ROW_ROOT/perf-rss-portability/uname.txt"
hostname | tee "$ROW_ROOT/perf-rss-portability/hostname.txt"
node --version | tee "$ROW_ROOT/perf-rss-portability/node-version.txt"
./scripts/with-rustup-cargo.sh --version | tee "$ROW_ROOT/perf-rss-portability/cargo-version.txt"
if command -v free >/dev/null 2>&1; then
  free -h | tee "$ROW_ROOT/perf-rss-portability/free.txt"
elif command -v vm_stat >/dev/null 2>&1; then
  vm_stat | tee "$ROW_ROOT/perf-rss-portability/vm_stat.txt"
  if command -v sysctl >/dev/null 2>&1; then sysctl hw.memsize 2>/dev/null | tee "$ROW_ROOT/perf-rss-portability/hw.memsize.txt" || true; fi
  if command -v memory_pressure >/dev/null 2>&1; then memory_pressure 2>/dev/null | tee "$ROW_ROOT/perf-rss-portability/memory_pressure.txt" || true; fi
else
  echo "memory facts unavailable on this host" | tee "$ROW_ROOT/perf-rss-portability/memory.txt"
fi
df -h / | tee "$ROW_ROOT/perf-rss-portability/disk-root.txt"
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$MODEL" | tee "$ROW_ROOT/perf-rss-portability/model.sha256.txt"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$MODEL" | tee "$ROW_ROOT/perf-rss-portability/model.sha256.txt"
else
  echo "sha256 tool unavailable" >&2
  exit 1
fi
node scripts/model-promotion-smoke-bundle.mjs --api ${CAMELID_API_BASE:-http://127.0.0.1:8181} --frontend ${CAMELID_FRONTEND_URL:-http://127.0.0.1:4175} --model "${CAMELID_MODEL_DIR:?set CAMELID_MODEL_DIR to the GGUF directory}/Llama-3.2-1B-Instruct-Q8_0.gguf" --model-id llama32-1b-q8 --out-dir "$ROW_ROOT/perf-rss-portability/api-webui-smoke" --message hello --max-tokens 1 --temperature 0 || true
pgrep -f 'target/release/backendinference serve' | tail -n 1 | tee "$ROW_ROOT/perf-rss-portability/backend.pid.txt"
if [ -s "$ROW_ROOT/perf-rss-portability/backend.pid.txt" ]; then ps -o pid,rss,vsz,etime,command -p "$(cat "$ROW_ROOT/perf-rss-portability/backend.pid.txt")" | tee "$ROW_ROOT/perf-rss-portability/backend.ps.txt"; fi
