# Current-head exact-support guardrails (30f86fc)

Date: 2026-05-07 UTC

Scope: cron `Camelid overnight all-models fixer` safe guardrail slice on current `main` after UI/evidence commits. No support, API capability, frontend readiness, context-window, model-family, or 8B broader/full-support claim was widened.

Starting state:

- Local `main` was clean at `30f86fcae3d4ae69741fed5995cf679ae385b14a` (`Polish guarded chat landing`) and aligned with `origin/main`.
- Canonical Ubuntu validation host check used the project-approved validation host and found an already-active Llama 3 8B 1024/2048 long-context run, so no duplicate 8B long-context run was launched.
- Active 8B run observed under a scrubbed remote validation checkout at source head `72fccb3e95b99d7bd501384e45dc7429818b0c61`. Because this is older than `30f86fc`, it cannot be used to call current `main` 8B-green.

Current-head gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test capabilities_report -- --nocapture` — 4 unit tests plus `capabilities_report_support_contract_and_planned_lanes` passed.
- `./scripts/check-evidence-bundle-checksums.sh`
- `node scripts/audit-evidence-bundle-privacy.mjs` — `finding_count: 0`.
- `node scripts/check-public-evidence-claims.mjs` — `53 manifest(s), 19 summary file(s)` passed.
- `node scripts/test-check-public-evidence-claims.mjs`
- `(cd frontend && npm run smoke:model-state)` — passed.

Local transcript artifact: `target/overnight-all-models-current-head-guardrails-20260507T145151Z.log`.

Boundary:

- TinyLlama remains the verified current gate.
- Llama 3.2 1B/3B remain exact-row bounded support through checked 2048 packs.
- Llama 3 8B remains exact bounded-pack support only for checked packs with row-specific PASS artifacts; the active canonical 8B rerun is older-head evidence and is not current-head green for `30f86fc`.
- Mistral/Mixtral/Qwen/Gemma remain planned/candidate rows until row-specific PASS artifacts and synchronized docs/API/frontend alignment exist.
