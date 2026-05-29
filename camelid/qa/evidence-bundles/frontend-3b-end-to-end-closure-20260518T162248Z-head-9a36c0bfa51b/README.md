# Frontend 3B end-to-end closure regression evidence

Target: Llama 3.2 3B Instruct Q8_0 frontend/WebUI closure.

## Feedback loop

Adds and gates a dedicated frontend smoke command:

- `npm run smoke:3b-closure` covers model-state/readiness surfaces, exact-row support-contract gating, API/chat model id selection, capabilities lane rendering, row boundary copy, 3B acceptance target copy, and live chat UX/source contracts.

## Gates

- `npm ci`: pass
- `npm run smoke:3b-closure`: pass
- `npm run smoke:model-state`: pass
- `npm run smoke:integration`: pass
- `npm run smoke:ui`: pass
- `npm run build`: pass

## Remote/backend check

Canonical Ubuntu SSH reached the host, but local Camelid API was not listening on `127.0.0.1:8181` during this run. Remote live backend refresh is rejected for this run; local frontend regression slice is retained.

## Retain/reject

- Retain: frontend regression feedback loop and local green gates.
- Reject for this run: live backend/API evidence refresh, blocked by `curl_exit=7` on /v1/health.

No support-contract widening is claimed by this bundle.
