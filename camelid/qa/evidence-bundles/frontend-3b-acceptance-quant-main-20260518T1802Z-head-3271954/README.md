# Frontend 3B acceptance quant gate (main)

Tracer bullet for Llama 3.2 3B Instruct Q8_0 frontend/WebUI support-contract closure on current `origin/main`.

## Retained slice

- Hardens the 3B acceptance placeholder so a browser record using the canonical acceptance id/path still must advertise Q8_0 evidence before the WebUI treats it as the exact 3B Q8_0 row.
- Extends `frontend/scripts/frontend-integration-smoke.mjs` with a neighboring-quant regression: a Q4_0 record with the 3B acceptance id must keep the missing-exact-row placeholder visible and surface the `llama32_3b_instruct_q8_0: quant mismatch` support-contract reason.

## Gates

All local frontend gates passed on this exact code slice:

```sh
cd frontend && npm ci && npm run build && npm run smoke:model-state && npm run smoke:ui && npm run smoke:streaming && npm run smoke:integration && npm run smoke:3b-closure
```

See `logs/frontend-gates.log`.

Public scrub/privacy and whitespace checks were rerun after staging this evidence bundle before commit.
