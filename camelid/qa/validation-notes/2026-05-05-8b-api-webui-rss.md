# 2026-05-05 — 8B API/WebUI/RSS timing smoke

Scope: exact `llama3_8b_instruct_q8_0` only.

A fresh Ubuntu clone of public `origin/main` at `8cef7af4d6c6198210681257f2b7b111d5801ff4` was patched locally so non-streaming `/v1/completions` exposes `camelid.timings_ms`, matching the existing chat-completions diagnostics shape. This fixed the promotion smoke bundle's response-local timing summary step without widening support language.

Result: PASS.

Validated steps:

- release backend build
- frontend `npm ci` and production build
- `/v1/health` before/after
- `/api/models/load`
- `/api/models/current`
- `/v1/models`
- `/api/capabilities`
- `/v1/completions`
- `/v1/chat/completions`
- response-local generation timing summary for completion + chat responses
- frontend smoke with exact-row support-contract checks

Key 8B observations:

- model SHA: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`
- completion response now had `camelid.timings_ms`, 2 prompt tokens, 1 generated token `[11]`, and `forward_total_ms=3746.333`
- chat response had 11 prompt tokens, 1 generated token `[9906]`, and `forward_total_ms=19969.736`
- frontend smoke generated `Hello` in `20283 ms` with WebUI chat enabled for `llama3_8b_instruct_q8_0`
- sampled backend RSS moved from `6308 KiB` before smoke to `286216 KiB` after smoke; this is a smoke-window RSS sample, not peak model-memory proof

Public sanitized evidence:

- `qa/evidence-bundles/llama3-8b-api-webui-rss-20260505T014408Z-head-8cef7af4d6c6/manifest.json`
- `qa/evidence-bundles/llama3-8b-api-webui-rss-20260505T014408Z-head-8cef7af4d6c6/SHA256SUMS`

Claim boundary: this validates only the exact 8B API/WebUI smoke slice and the completion-diagnostics API patch. It does not promote broad Llama-family support, neighboring sizes, other quantizations, larger contexts, arbitrary chat-template behavior, or full performance portability.
