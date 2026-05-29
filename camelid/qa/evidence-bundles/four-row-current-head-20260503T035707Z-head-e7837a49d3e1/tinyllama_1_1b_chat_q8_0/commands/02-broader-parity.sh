#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROW_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
BUNDLE_ROOT="$(cd -- "$ROW_ROOT/.." && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
export ROW_ROOT BUNDLE_ROOT REPO_ROOT
cd "$REPO_ROOT" && python3 - <<'PY'
import json, os, pathlib
paths = [
  "target/edge-prompt-audit-fixed-20260428T1530/short.json",
  "target/edge-prompt-audit-fixed-20260428T1530/trailing-spaces.json",
  "target/edge-prompt-audit-fixed-20260428T1530/special-chars.json",
  "target/edge-prompt-audit-fixed-20260428T1530/longer.json",
  "target/edge-prompt-dequant-default-20260428T1604/multiline-long-default-50.json",
]
report = {"checked": []}
for path in paths:
  data = json.loads(pathlib.Path(path).read_text())
  report["checked"].append({
    "path": path,
    "prompt_tokens_match": data.get("prompt_tokens_match"),
    "generated_text_match": data.get("generated_text_match"),
    "backend_tokens": len(data.get("backend_generated_tokens", [])),
    "llama_tokens": len(data.get("llama_generated_tokens", data.get("llama_generated_tokens_from_text", []))),
  })
out_path = pathlib.Path(os.environ["ROW_ROOT"]) / "broader-parity" / "carry-forward-summary.json"
out_path.write_text(json.dumps(report, indent=2) + "\n")
print("wrote", out_path)
PY
