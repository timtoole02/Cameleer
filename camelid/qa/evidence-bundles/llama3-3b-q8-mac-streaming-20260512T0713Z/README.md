# Llama 3.2 3B Q8_0 Mac streaming smoke — 2026-05-12

Public-safe compact evidence for the exact Llama 3.2 3B Instruct Q8_0 scrubbed local streaming-responsiveness lane.

Scope:
- Exact row: `Llama-3.2-3B-Instruct-Q8_0.gguf`.
- Runtime path: local release backend on loopback.
- Request path: `POST /api/models/load`, then streaming `POST /v1/chat/completions` with `stream:true`, `temperature:0`, and a small token budget.
- Privacy: raw local model paths, hostnames, and operator-only staging details are intentionally redacted.

Initial observation before the streaming-responsiveness patch:
- `/api/models/load` returned successfully in about `607.7 ms` on the isolated backend.
- First streamed assistant content arrived after about `253,510.9 ms` (`~253.5 s` TTFT) on the first 3B Q8 smoke request.
- After first content, SSE content deltas were progressive rather than one final burst: about `1.01` content chunks/sec over the 16-token window.
- While generation was active, separate `/health` and `/v1/models` requests to the same backend timed out after about `2 s` with no response body.
- A follow-up non-streaming timing request did not complete promptly and was killed to avoid leaving the isolated backend wedged.

After the local streaming-responsiveness patch:
- The rebuilt local release backend returned headers plus the role-only assistant SSE chunk in about `91.8 ms`.
- While dense generation was still active, `/health` returned `200` in about `3.65 ms` with the loaded 3B model marked ready.
- Compact artifact: `patched-stream-role-health.json`.

Interpretation:
- The user-visible issue on this exact Mac 3B Q8_0 path is still dominated by long prefill/first-content latency.
- The patch evidence supports immediate connected/waiting-for-first-token UI state and preserved API responsiveness during long prefill.
- This is streaming plumbing and responsiveness evidence only; it does **not** change the underlying `~253.5 s` first-content finding.

Support boundary:
- This bundle is exact-row scrubbed local evidence for `Llama-3.2-3B-Instruct-Q8_0.gguf` only.
- It does not promote production throughput, portability, model-native/larger context, neighboring Llama rows, arbitrary templates, or broad Llama support.
