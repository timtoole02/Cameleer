# Llama 3 8B Instruct Q8_0

Public status: supported_exact_row_smoke
Expected model SHA256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`
Carry-forward bundle: `qa/evidence-bundles/four-row-public-20260503T024327Z/llama3_8b_instruct_q8_0.bundle.json`

Tracks:
- compact-parity: ready_to_run — Refresh compact-header hello parity at 5 tokens on current head.
- broader-parity: ready_to_run — Run the broader three-prompt pack and require prompt/generated parity.
- chat-template-shapes: ready_to_run — Run the chat-template-shapes pack to broaden template coverage on the exact row.
- context-512: known_blocker — Run the bounded 512-context pack and preserve success or failure durably.
- api-webui-smoke: ready_to_run — Refresh exact-row /api/models/load, /v1/models, /v1/completions, /v1/chat/completions, and frontend smoke.
- perf-rss-portability: ready_to_run — Capture host facts, versions, model SHA, smoke timing, and backend RSS snapshots in one portable note.

Blockers:
- 512-context parity on Ubuntu current head was not completed in this bundle; keep that failure preserved side-by-side with passing short smoke.
- Do not broaden to neighboring Llama sizes, quantizations, longer contexts, or other template families.
