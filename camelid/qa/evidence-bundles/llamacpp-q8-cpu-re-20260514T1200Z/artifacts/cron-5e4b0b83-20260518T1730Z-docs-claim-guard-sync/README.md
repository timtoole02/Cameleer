# cron 5e4b0b83 — docs claim guard sync, 2026-05-18T17:30Z

Scope: Ubuntu x86_64 dense Q8 docs/context and evidence-reference hygiene only. No Mac, Apple Silicon, Metal, Mixtral, model support, frontend/API readiness, portability, production-throughput, or default-on acceleration promotion.

## Inputs reviewed

- Repo `CONTEXT.md` and `docs/adr/0001-agentic-engineering-discipline.md`.
- Current docs claim guard branch after fast-forwarding to `origin/main` at `fe96c34`.
- `qa/evidence-bundles/llamacpp-q8-cpu-re-20260514T1200Z/artifacts/cron-0719640b-20260518T1515Z-ffndown-rowgroup-threshold/README.md`.
- `qa/evidence-bundles/llamacpp-q8-cpu-re-20260514T1200Z/artifacts/cron-95495a91-20260518T1616Z-ffn-gate-up-single-owner-env-guard/README.md`.
- Existing frontend 3B evidence bundles that public scrub checks flagged for local path / SSH key / raw host details.

## Docs retained

- Updated `docs/performance/ubuntu-x86-q8.md` to name the FFN-down GEMM4 row-group min-input-groups guard as a retained default-off scheduler guard only.
- Updated `docs/performance/ubuntu-x86-q8.md` to name the FFN gate/up single-owner ExecutionPlan env guard as default-off control-plane hygiene only.
- Updated `STATUS.md` to keep these slices narrow: scheduler/control-plane guard evidence only, with no throughput/support/portability/API/frontend/default-on promotion.
- Added evidence anchors for the two retained guard slices and this docs claim-guard sync.

## Scrub retained

- Replaced private/local checkout paths with `<local-checkout>`.
- Replaced raw validation-host IP / SSH user-key command details with `<canonical-ubuntu-host>`.
- Rewrote the FFN-down row-group artifact wording to describe a sanitized canonical validation host and rustup-managed toolchain need without exposing a host IP or local path.
- Refreshed SHA256SUMS for evidence bundles whose scrubbed command/state files changed.

## Gates

- `git diff --check`: PASS.
- `bash scripts/check-public-scrub.sh`: PASS.
- `git status --short`: inspected before commit.

## Claim boundary

- No README support-matrix change.
- No support-contract promotion.
- No API/frontend readiness claim.
- No broad model-family, portability, production-throughput, or default-on acceleration claim.
- Row-group threshold evidence remains a default-off scheduler/context-switch tracer bullet, not a model-backed throughput result.
- FFN gate/up single-owner env management remains a control-plane guard, not parity/performance evidence.
