# Llama 3 8B checkmark current-head refresh — 2026-05-05

Purpose: preserve an earlier public-main exact-row checkmark for Llama 3 8B Instruct Q8_0 without widening the support claim. The newer current-main refresh is documented separately in `qa/validation-notes/2026-05-05-8b-checkmark-current-main.md`.

Published bundle:

- `qa/evidence-bundles/8b-checkmark-current-head-20260505T052647Z-head-864e07b51f36/manifest.json`
- Source head: `864e07b51f36e9248f898a07781eeaee2ed5c6d8`
- Model SHA256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`
- Result: the exact row passed `/api/models/load`, `/v1/models`, `/api/capabilities`, `/v1/completions`, `/v1/chat/completions`, generation timing summary, and frontend smoke.
- Frontend smoke required generation and generated `Hello` with `contract_supported=true` and `webui_chat=enabled`.
- Max sampled backend RSS during the smoke: `286056 KiB`.
- Public bundle `SHA256SUMS` sha256: `0774c12816651c6f330f072141ec2de83c958bb857cb771df57716755724b2cf`.

Scope boundary: exact Llama 3 8B Instruct Q8_0 API/WebUI/RSS smoke only. This preserves `supported_exact_row_smoke`; it does not promote broad/full Llama-family support, neighboring rows, other quantizations, larger contexts, arbitrary chat-template behavior, or production performance/portability.
