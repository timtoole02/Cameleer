# Llama 3 8B clean-main API/WebUI/RSS smoke — 2026-05-05

Sanitized public summary for the exact `llama3_8b_instruct_q8_0` row on the reopened Ubuntu validation lane.

This rerun validates the completion-timing diagnostics path after it landed on clean public `main` (`aee469b9c13a0fa5e97fe6263eba71e75e29dff2`): non-streaming `/v1/completions` and `/v1/chat/completions` both carry response-local `backendinference.timings_ms`, the generation-timing summarizer passed, and the frontend smoke kept the exact 8B row chat-enabled under the support contract.

Claim boundary: exact 8B API/WebUI smoke + timing/RSS sample only. This does not broaden 8B support beyond the already documented exact-row smoke/parity envelopes.
