# Next-family fail-closed guardrail checkpoint

Date: 2026-05-07 UTC

Scope: one guardrail slice for the overnight all-models fixer. This does not promote Mixtral, Qwen, Gemma, Mistral, or any neighboring row.

Starting state:
- Local `main` was clean at `89a6b6d` (`Promote exact 8B bounded context packs`) and aligned with `origin/main`.
- No duplicate long Llama 3 8B 1024/2048 diagnostic was started. Local process check found only an existing local `camelid serve --addr 127.0.0.1:8191`; canonical Ubuntu showed stale/completed 8B watchers plus active non-8B Mixtral/Qwen/Gemma `bench-q8-blocks` work, not an active long 8B context run.

Change:
- Added a `/api/capabilities` regression test that locks the planned next-family exact rows (`mixtral_8x7b_instruct_v0_1_q8_0`, `qwen25_7b_instruct_q8_0`, `gemma2_9b_it_q8_0`) to `planned_exact_row_candidate`, `future_exact_row_planning_only`, fail-closed frontend readiness, no tensor/generation/parity/perf promotion, and no 512/1024/2048 context promotion.

Validation gates:
- `cargo fmt --check`
- `cargo test capabilities_report -- --nocapture` — 4 matching tests passed, including the new next-family fail-closed guardrail plus `capabilities_report_support_contract_and_planned_lanes`.
- `scripts/check-evidence-bundle-checksums.sh`
- `node scripts/audit-evidence-bundle-privacy.mjs` — finding_count `0`.
- `node scripts/check-public-evidence-claims.mjs` — `50 manifest(s), 16 summary file(s)` passed.
- `node scripts/test-check-public-evidence-claims.mjs`
- `(cd frontend && npm run smoke:model-state)` — passed.

Boundary:
- Exact supported rows remain TinyLlama current gate plus bounded exact-row Llama 3.2 1B/3B and Llama 3 8B Q8_0 claims only.
- 8B 1024/2048 remain checked bounded-pack support only for the exact tracked 8B row; no model-native/larger-context, arbitrary-template, production-throughput, portability, neighboring-row, or broad-family support is claimed.
- Mixtral/Qwen/Gemma stay planned exact-row candidates until row-specific source/SHA/license, tokenizer/template references, bounded load/readiness, parity, API/WebUI, RSS/timing, scrubbed manifests, and checksums exist.
