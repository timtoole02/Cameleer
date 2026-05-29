# Frontend 3B support-gated chat regression — 2026-05-18T07:59:33Z

## Target

Llama 3.2 3B Instruct Q8_0 frontend/WebUI exact-row gating.

## Feedback loop

- Local: `npm run smoke:integration && npm run smoke:model-state && npm run smoke:ui && npm run build`
- Remote: canonical Ubuntu host curl check for `/v1/health` and `/api/capabilities`.

## Retained slice

Added a frontend integration regression for the support-contract guard where the backend/runtime is green for the exact 3B Q8_0 GGUF (`loaded_now=true`, `generation_ready=true`) but `/api/capabilities` downgrades the exact row to `groundwork_backend_evidence_only`.

The retained assertion bundle proves the WebUI:

- keeps runtime readiness visible as `Runtime ready, support gated`;
- names the exact unpromoted `llama32_3b_instruct_q8_0` row;
- keeps the composer blocked (`Load a model first`);
- does not render `Local chat ready`, `Message Camelid…`, or demo starters.

## Gates

- PASS: frontend integration smoke.
- PASS: model-state smoke.
- PASS: UI regression smoke.
- PASS: Vite production build.
- Remote live backend check not retained: historical note says SSH reached the canonical Ubuntu host, but `curl http://127.0.0.1:8181/v1/health` failed with connection refused (exit 7).

## Retain/reject decision

Retained as a support-contract/doc guard. It does not widen the frontend support claim; it prevents a future regression where live 3B runtime readiness alone would unlock chat without exact supported `/api/capabilities` evidence.
