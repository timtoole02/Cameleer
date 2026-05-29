# Current-head 8B guardrail alignment — 2026-05-07

- Local branch/head before commit: `main` at `17a56f7a1ba6998b7b59653f2dcd2cae326b3945`, matching `origin/main`.
- Canonical remote was checked at 2026-05-07 15:48 UTC using the project-approved Ubuntu validation host.
- No new long 8B 1024/2048 validation was launched in this slice. Remote showed only existing `camelid serve` processes on ports 8181/8311/8312/8313/8391 and no active `run-llama3-prompt-pack`/current 8B 1024/2048 runner to duplicate.

## Guardrail decision

Do not promote stale Llama 3 8B 1024/2048 evidence on current `main`. Existing 8B 1024/2048 bundles are historical for their source heads only after later runtime/source commits. Current public/API/frontend support remains:

- TinyLlama: current verified gate.
- Llama 3.2 1B/3B Q8_0: exact-row bounded 512/1024/2048 packs.
- Llama 3 8B Instruct Q8_0: exact-row smoke plus checked bounded 512-context pack only on current `main`; 1024/2048 stay red/not promoted until fresh canonical current-head PASS artifacts plus synchronized docs/API/frontend alignment exist.

## Files aligned

- `README.md`
- `STATUS.md`
- `COMPATIBILITY.md`
- `ROADMAP.md`
- `frontend/README.md`
- `frontend/src/views/ModelsView.jsx`
- `frontend/scripts/model-state-smoke.mjs`

The frontend card now shows a warm/red guardrail badge for 8B 1024/2048 instead of a green passed badge, and the model-state smoke fixture expects 8B 1024/2048 to remain blocked while latest checked output stays `CMLD-512`.

## Gates

- `npm run smoke:model-state` — PASS
- `npm run build` — PASS
- `cargo test --test api_vertical_slice` — PASS, 53 tests

## Blocker for 8B 1024/2048 promotion

Fresh current-head canonical 8B 1024/2048 PASS artifacts are still missing for `17a56f7a1ba6998b7b59653f2dcd2cae326b3945` or later, along with synchronized docs/API/frontend alignment. Until then, keep 8B 1024/2048 red/not promoted.
