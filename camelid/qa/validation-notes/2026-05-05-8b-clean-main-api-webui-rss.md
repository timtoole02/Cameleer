# 2026-05-05 — Llama 3 8B clean-main API/WebUI/RSS timing smoke

Scope: exact `llama3_8b_instruct_q8_0` row only, on the reopened Ubuntu validation lane from a fresh clean public `main` checkout.

Public summary: `qa/evidence-bundles/llama3-8b-api-webui-rss-clean-20260505T015843Z-head-aee469b9c13a/manifest.json`.

## Result

PASS on clean public `main` `aee469b9c13a0fa5e97fe6263eba71e75e29dff2`.

Validated steps:

- `scripts/with-rustup-cargo.sh build --release --bin camelid`
- `frontend npm ci`
- `frontend npm run build`
- `/api/models/load`
- `/api/models/current`
- `/v1/models`
- `/api/capabilities`
- `/v1/completions`
- `/v1/chat/completions`
- generation timing summary over both completion responses
- frontend smoke with `expect_compatibility_row=llama3_8b_instruct_q8_0`, `expect_compatibility_status=supported_exact_row_smoke`, `expect_contract_supported=true`, and `expect_webui_chat=enabled`

## Key observations

- Model SHA256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`.
- Completion response: prompt `hello`, prompt tokens `2`, generated token id `[11]`, text `,`, `camelid.timings_ms` present, forward total `3738.379 ms`, generate `3744 ms`.
- Chat response: prompt tokens `11`, generated token id `[9906]`, text `Hello`, `camelid.timings_ms` present, forward total `19891.325 ms`, generate `19898 ms`.
- Frontend smoke returned HTTP 200, loaded the requested GGUF, confirmed generation-ready health, matched the exact support row, and generated `Hello` in `20202 ms`.
- Backend RSS sample around the smoke window moved from `6316 KiB` to `283352 KiB`; the smoke process max RSS was `227696 KiB`. This is a smoke-window sample, not a peak memory proof.

## Claim boundary

This clears the earlier patched-tree caveat for the completion-diagnostics API/WebUI smoke slice by rerunning it on clean public `main`. It does **not** broaden the 8B row beyond the documented exact-row smoke/parity envelopes and does not promote neighboring Llama sizes, other quantizations, larger contexts, arbitrary template behavior, or full performance portability.
