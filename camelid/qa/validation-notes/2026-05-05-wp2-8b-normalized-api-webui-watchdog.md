# WP2 8B normalized API/WebUI bundle refresh — 2026-05-05

Purpose: preserve a current-public-head normalized API/WebUI/RSS smoke for the exact Llama 3 8B Instruct Q8_0 row after the CI evidence-checksum gate landed.

Published bundle:

- `qa/evidence-bundles/full-support-normalized-wp2-8b-watchdog-20260505T041404Z-head-83c21f0cbf5a/manifest.json`
- Public bundle contents: manifest, backend RSS samples, health-ready snapshot, compacted model metadata snapshots, API/WebUI smoke drill-down JSON/commands, privacy-audit summary, and checksums.
- Row: `llama3_8b_instruct_q8_0`
- Source run head recorded by the manifest: `83c21f0cbf5a715c12a8e33c8e9138d9e354dd64`
- Node recorded by the manifest: `v22.22.2`
- Model SHA256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`
- Result: the exact 8B row passed `/api/models/load`, `/v1/models`, `/api/capabilities`, `/v1/completions`, `/v1/chat/completions`, generation timing summary, and frontend smoke through `scripts/model-promotion-smoke-bundle.mjs`.
- Frontend smoke required generation and produced `Hello` for the one-token chat smoke.
- Backend RSS sampling max recorded by the public manifest: `283372 KiB`.

Publication checks:

- Bundle privacy audit: `finding_count=0`
- Bundle checksum verification: `shasum -a 256 -c SHA256SUMS` passed inside the bundle directory
- `SHA256SUMS` sha256: `83334a9083806081569322978db273044753515a195359d0b4326cf6352367da`

Scope boundary: this refreshes API/WebUI/RSS smoke evidence only for the exact Llama 3 8B Instruct Q8_0 row on current public `main`. It does not broaden support to neighboring Llama rows, larger context buckets, broader chat-template behavior, stronger production performance/portability claims, or non-Q8_0 quantizations.
