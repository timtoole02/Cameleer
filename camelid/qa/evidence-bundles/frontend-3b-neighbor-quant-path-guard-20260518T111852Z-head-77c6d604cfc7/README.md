# Frontend 3B neighboring-quant path guard evidence

CAMELID SLICE:
- Target: Llama 3.2 3B Instruct Q8_0 frontend/WebUI exact-row closure for the neighboring-quant failure mode.
- Domain terms used: support contract, exact row, tracer bullet, evidence bundle, retained slice, parity envelope.
- Feedback loop: frontend model-state smoke, SSR integration smoke, UI regression smoke, production build, source inspection, canonical Ubuntu backend probe.
- Files changed: frontend/src/lib/capabilities.js; frontend/scripts/model-state-smoke.mjs; frontend/scripts/frontend-integration-smoke.mjs.
- Gate/env: local macOS frontend Node/Vite; canonical Ubuntu SSH probe to canonical-private-ubuntu-validation-host.
- Baseline: 3B WebUI exact-row readiness already required runtime loaded_now/generation_ready and supported /api/capabilities row, but quant inference could read Q8_0 from a canonical browser row id before reading a loaded GGUF path that named a neighboring quant.
- Results: local frontend gates pass; source inspection shows artifact-path quant precedence, GGUF-style mismatch copy, and new 3B Q4_0-path support-gated chat regression coverage.
- Retain/reject: retain frontend guard; reject live backend/API green claim if remote probe is not fully green (see remote log/status below).
- Next tracer bullet: rerun live backend/API/WebUI probe when canonical Ubuntu API is listening, without widening support claims before evidence is green.

## Repo state
See logs/repo-state.log. This shared tree had pre-existing unrelated dirty files; this slice changed only the frontend files listed above and this evidence bundle.

## Local gates
Command list: local-gates.command.txt
Raw log: logs/local-gates.log

Passed:
- cd frontend && npm run smoke:model-state
- cd frontend && npm run smoke:integration
- cd frontend && npm run smoke:ui
- cd frontend && npm run build

## Source contract inspected
Command: source-inspection.command.txt
Raw log: logs/source-inspection.log

Retained guard:
- Quant inference now uses explicit metadata first, then loaded artifact paths/filenames, then generic ids/names; mismatch copy displays normalized keys like Q40 as GGUF-style Q4_0.
- A canonical 3B browser row id with a loaded Llama-3.2-3B-Instruct-Q4_0.gguf path returns quant_mismatch, does not satisfy the Q8_0 support contract, and keeps live chat support-gated while still surfacing runtime readiness.

## Remote backend probe
Command: remote-backend-check.command.txt
Raw log: logs/remote-backend-check.log
Exit status: 7

No live backend/API support-contract promotion is claimed unless this log contains green health/current/capabilities output for the exact 3B row.
