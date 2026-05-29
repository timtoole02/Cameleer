# WP1 normalized API/WebUI bundle publication — 2026-05-05

Purpose: preserve the reopened-lane normalized API/WebUI smoke evidence for the three non-8B rows in a durable public bundle.

Published bundle:

- `qa/evidence-bundles/full-support-normalized-wp1-20260505T032406Z-head-bcf9e647d6fd/manifest.json`
- Public bundle contents: manifest, backend RSS samples, health-ready snapshot, privacy-audit summary, and checksums; raw per-row API/WebUI drill-down files remain in the private ignored `target/` source tree.
- Rows: `tinyllama_1_1b_chat_q8_0`, `llama32_1b_instruct_q8_0`, `llama32_3b_instruct_q8_0`
- Source run head recorded by the manifest: `bcf9e647d6fd`
- Node recorded by the manifest: `v22.22.2`
- Result: all three rows passed the normalized `/api/models/load`, `/v1/models`, `/v1/completions`, `/v1/chat/completions`, timing-summary, and frontend-smoke shape captured by `scripts/model-promotion-smoke-bundle.mjs`.

Publication checks:

- Public evidence privacy audit over `qa/evidence-bundles`: `finding_count=0`
- Bundle checksum verification: `sha256sum -c SHA256SUMS` passed inside the bundle directory
- `SHA256SUMS` sha256: `ce87c02fba64fcd78efe10c01b030435d185bc785f06a4d9df4cbd04048da283`
- Public scrub: `bash scripts/check-public-scrub.sh` passed
- Whitespace gate: `git diff --check` passed

Scope boundary: this publishes API/WebUI smoke evidence only for the exact TinyLlama, Llama 3.2 1B, and Llama 3.2 3B Q8_0 rows. It does not broaden support to neighboring rows, larger contexts, broader chat-template behavior, stronger performance/portability claims, or non-Q8_0 quantizations.
