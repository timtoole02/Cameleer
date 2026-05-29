# Overnight all-models guardrail rerun

Date: 2026-05-07 UTC

Scope: cron `Camelid overnight all-models fixer` guardrail slice. No new 8B long-context run was launched.

Starting state:
- Local `main` was clean at `1428b3c` (`Promote exact 8B bounded context packs`) and aligned with `origin/main`.
- Local process check found frontend/dev-server leftovers and one local `camelid serve --addr 127.0.0.1:8191`, not a long 8B parity run.
- Canonical Ubuntu check via the private operator SSH target showed a stale/self-matching 8B diagnostic watcher (`run-8b-1024-diag-4c30c53`) plus active non-8B `bench-q8-blocks` work for Qwen/Mixtral/Gemma. No duplicate 8B long-context run was started.

Validation gates run from this head:
- `cargo fmt --check`
- `cargo test capabilities_report -- --nocapture` — 4 matching tests passed across unit/API vertical-slice coverage.
- `scripts/check-evidence-bundle-checksums.sh`
- `node scripts/audit-evidence-bundle-privacy.mjs` — `finding_count: 0`.
- `node scripts/check-public-evidence-claims.mjs` — `51 manifest(s), 17 summary file(s)` passed.
- `node scripts/test-check-public-evidence-claims.mjs`
- `(cd frontend && npm run smoke:model-state)` — passed.

Local transcript artifact: `target/overnight-all-models-guardrails-20260507T0831Z.log`.

Boundary:
- This rerun preserves the exact tracked rows only: TinyLlama current gate plus exact Llama 3.2 1B/3B and Llama 3 8B Q8_0 bounded support already present at this head.
- The 8B 1024/2048 claim remains exact bounded-pack support only, backed by `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T075407Z-head-4191ef9fcc28/`.
- Mistral remains planned exact-row bring-up; Mixtral/Qwen/Gemma remain planned exact-row candidates. No docs/API/frontend support language was widened.
