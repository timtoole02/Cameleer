# Overnight all-models fixer checkpoint — 2026-05-06 21:44 PDT

Purpose: record this bounded cron pass without duplicating a long 8B run or widening support without artifacts.

## Starting state

- Local repo: `[local Camelid checkout]`.
- Local HEAD at start: `1925860` (`Align frontend smoke with exact 8B packs`), clean and aligned with `origin/main`.
- Canonical Ubuntu host checked with the repo's private operator SSH route.
- No active long Llama 3 8B context/parity run was found on the canonical host. The only 8B-related item was the old completed-run watcher for the scrubbed `Camelid-diag-4c30c53` checkout; I did not launch a duplicate long 8B job.
- Active canonical CPU work at the checkpoint was non-8B next-family Q8 block benches for Gemma, Mixtral, and Qwen under the parallel bring-up lane.

## Evidence checked

- Current bounded 8B 1024/2048 artifact checked locally:
  - `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T040332Z-head-78d58b866692/manifest.json`
  - `passed: true`
  - row: exact `llama3_8b_instruct_q8_0`
  - claim boundary: exact bounded 1024/2048 packs only; no neighboring rows, other quantizations, model-native/larger contexts beyond checked packs, arbitrary templates, broad/full Llama support, throughput, or portability.
- Bundle checksum gate passed for the checked artifact via `sha256sum -c SHA256SUMS` and the repo-wide evidence checksum gate below.

## Gates run

- `scripts/check-public-scrub.sh` — PASS
- `scripts/check-evidence-bundle-checksums.sh` — PASS
- `node scripts/test-check-public-evidence-claims.mjs` — PASS
- `(cd frontend && npm run smoke:model-state)` — PASS
- `cargo test capabilities_report_support_contract_and_planned_lanes -- --nocapture` — PASS
- `cargo test q8_0_file_backed -- --nocapture` — PASS
- `cargo fmt --check` — PASS
- `cargo clippy --all-targets --all-features -- -D warnings` — PASS
- `(cd frontend && npm run build)` — PASS

## Boundary

This checkpoint does not create a new support claim by itself. It verifies that current docs/API/frontend wording is backed by the checked exact-row 8B 1024/2048 PASS artifact and that TinyLlama/1B/3B/8B support-surface guardrails still pass after the recent alignment commits. Mistral, Mixtral, Qwen, and Gemma remain unsupported candidate/bring-up rows until their own row-specific artifacts exist.
