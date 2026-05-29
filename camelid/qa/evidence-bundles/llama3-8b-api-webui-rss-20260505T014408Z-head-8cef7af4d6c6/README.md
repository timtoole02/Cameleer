# Llama 3 8B API/WebUI/RSS smoke — 2026-05-05

Sanitized public summary for the exact `llama3_8b_instruct_q8_0` row on the reopened Ubuntu validation lane.

This run validates a narrow API patch over `8cef7af4d6c6198210681257f2b7b111d5801ff4`: non-streaming `/v1/completions` now carries the same `backendinference.timings_ms` diagnostics shape that `/v1/chat/completions` already exposed, allowing the promotion smoke bundle to summarize both response-local timings.

Claim boundary: exact 8B API/WebUI smoke + timing/RSS sample only. This does not broaden 8B support beyond the already documented exact-row smoke/parity envelopes.
