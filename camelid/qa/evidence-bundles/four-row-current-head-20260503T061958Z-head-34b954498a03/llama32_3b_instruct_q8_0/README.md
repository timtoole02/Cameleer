# Llama 3.2 3B Instruct Q8_0

Public status: supported_exact_row_smoke
Expected model SHA256: `b5607b5090a8280063fff2d706bb3408ca6542341b06aab39c3eca0a28575921`
Carry-forward bundle: `qa/evidence-bundles/four-row-public-20260503T024327Z/llama32_3b_instruct_q8_0.bundle.json`

Tracks:
- compact-parity: ready_to_run — Refresh compact-header hello parity at 5 tokens on current head.
- broader-parity: ready_to_run — Run the broader three-prompt pack and require prompt/generated parity.
- chat-template-shapes: ready_to_run — Run the chat-template-shapes pack to broaden template coverage on the exact row.
- context-512: ready_to_run — Run the bounded 512-context pack and preserve success or failure durably.
- api-webui-smoke: ready_to_run — Refresh exact-row /api/models/load, /v1/models, /v1/completions, /v1/chat/completions, and frontend smoke.
- perf-rss-portability: ready_to_run — Capture host facts, versions, model SHA, smoke timing, and backend RSS snapshots in one portable note.

Blockers:
- Current public support is still exact-row smoke only.
- Do not broaden beyond the exact 3B Instruct Q8_0 row without fresh Ubuntu artifacts and synchronized docs/API/frontend changes.
