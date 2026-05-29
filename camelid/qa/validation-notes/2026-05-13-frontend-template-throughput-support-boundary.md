# 2026-05-13 — Frontend template/throughput support-boundary guard

Scope: support-surface copy and frontend readiness interpretation only. No remote runtime validation was run for this slice because no model/runtime support claim was strengthened.

Evidence checked before edits:

- Repo was on `main` at `41f4b81` (`Update frontend supported-row readiness lanes`).
- The working tree already had pre-existing modified backend/Metal files: `src/inference.rs`, `src/main.rs`, and `src/metal.rs`. This slice did not edit or stage those files.
- The current blocker-proof bundle remains `qa/evidence-bundles/supported-row-template-throughput-blocker-proof-20260513T2049Z-head-994569dbf995/manifest.json`, which records that broad arbitrary/Jinja-template execution and production-throughput support are still blocked for current supported rows.

Changes recorded:

- `README.md` now describes current supported-row template/perf evidence as row-scoped or bounded where cited, while keeping broad arbitrary/Jinja-template behavior and production throughput explicitly outside the support claim.
- `frontend/src/lib/capabilities.js` no longer treats bounded template-shape, metadata-Jinja exact-row renderer, `measured`, or bounded perf/RSS fields as broad arbitrary-template or production-throughput readiness.
- `frontend/scripts/model-state-smoke.mjs` now guards the bounded-only case and keeps blockers visible unless explicit broad template plus production-throughput evidence is advertised.

Validated commands:

- `node frontend/scripts/model-state-smoke.mjs`
- `cd frontend && npm run build`
- `git diff --check`
- `bash scripts/check-public-scrub.sh`
- `node scripts/test-check-public-evidence-claims.mjs`
- `node scripts/test-readme-screenshot.mjs`

Claim boundary:

- This does not promote Llama, Mistral, Mixtral, Qwen, Gemma, arbitrary-template behavior, production throughput, portability, neighboring rows, or broader/full support.
- Public docs continue to avoid private validation-host addresses, key paths, local home paths, and operator-only commands.
