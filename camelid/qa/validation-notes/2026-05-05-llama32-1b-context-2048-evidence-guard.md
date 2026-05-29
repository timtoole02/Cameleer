# Llama 3.2 1B Q8_0 2048-context evidence guard

Date: 2026-05-05 PDT / 2026-05-06 UTC

Scope: local public-evidence checker hardening only.

Change:
- `scripts/check-public-evidence-claims.mjs` now validates the legacy `camelid.public-evidence-bundle.v1` manifest shape used by `qa/evidence-bundles/llama32-1b-context-2048-rope-factors-20260506T0105Z-head-62f8cbc/manifest.json`.
- The checker pins the exact row (`llama32_1b_instruct_q8_0`), the bounded 2048 pack id/window, the expected generated token IDs `[34,2735,35,12,7854]`, generated text `CMLD-204`, narrow-boundary language, and safe relative primary artifact paths.
- `scripts/test-check-public-evidence-claims.mjs` covers a passing fixture plus a mutated-token failure fixture so the guard fails closed if the 1B/2048 claim drifts.

Validation:
- `node scripts/test-check-public-evidence-claims.mjs`
- `node scripts/check-public-evidence-claims.mjs`
- `git diff --check`

Claim boundary:
- This is a claim-integrity guard for the existing exact-row bounded 1B/2048 artifact only.
- It does not promote neighboring rows, other quantizations, larger/model-native contexts, arbitrary templates, production throughput, portability, 8B long-context, or broad/full Llama-family support.
