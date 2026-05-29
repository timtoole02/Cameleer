# Llama 3.2 1B Instruct Q8_0

Public status: supported_exact_row_smoke
Expected model SHA256: `432f310a77f4650a88d0fd59ecdd7cebed8d684bafea53cbff0473542964f0c3`
Carry-forward bundle: `qa/evidence-bundles/four-row-public-20260503T024327Z/llama32_1b_instruct_q8_0.bundle.json`

Tracks:
- compact-parity: ready_to_run — Refresh compact-header hello parity at 5 tokens on current head.
- broader-parity: ready_to_run — Run the broader three-prompt pack and require prompt/generated parity.
- chat-template-shapes: ready_to_run — Run the chat-template-shapes pack to broaden template coverage on the exact row.
- context-512: ready_to_run — Run the bounded 512-context pack and preserve success or failure durably.
- api-webui-smoke: ready_to_run — Refresh exact-row /api/models/load, /v1/models, /v1/completions, /v1/chat/completions, and frontend smoke.
- perf-rss-portability: ready_to_run — Capture host facts, versions, model SHA, smoke timing, and backend RSS snapshots in one portable note.

Blockers:
- No durable current-head target/full-support evidence root exists yet for compact/broader/template/512/API-WebUI/perf together.
- Do not imply neighboring Llama 3.2 rows or other quantizations are supported.
