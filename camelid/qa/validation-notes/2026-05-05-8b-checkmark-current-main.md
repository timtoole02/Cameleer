# Llama 3 8B checkmark current-main refresh — 2026-05-05

Purpose: preserve the exact-row Llama 3 8B Instruct Q8_0 API/WebUI/RSS checkmark after public `main` advanced to `15bfc41d15d5aaf4b8b0244bc38989a2d096f922`, without widening the support claim.

Published bundle:

- `qa/evidence-bundles/8b-checkmark-current-main-20260505T084931Z-head-15bfc41d15d5/manifest.json`
- Source head: `15bfc41d15d5aaf4b8b0244bc38989a2d096f922`
- Model SHA256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`
- Result: the exact row passed `/api/models/load`, `/v1/models`, `/api/capabilities`, `/v1/completions`, `/v1/chat/completions`, generation timing summary, and frontend smoke.
- Frontend smoke required generation and generated `Hello` with `contract_supported=true` and `webui_chat=enabled`.
- Response-local timing summary: completion `generate_ms=3849`; chat `generate_ms=20524`.
- Max sampled backend RSS during the smoke: `286148 KiB`.
- Public bundle `SHA256SUMS` sha256: `a2d7a7266bc1de9fec1f8143492661d29e68c2902ee70d3b1c60e2f2673892a6`.

Scope boundary: exact Llama 3 8B Instruct Q8_0 current-main API/WebUI/RSS smoke only. This preserves `supported_exact_row_smoke`; it does not promote broad/full Llama-family support, neighboring rows, other quantizations, larger contexts, arbitrary chat-template behavior, or production performance/portability.
