# Llama 3 8B Instruct Q8_0

Public status: supported_exact_row_smoke
Expected model SHA256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`
Carry-forward bundle: `qa/evidence-bundles/four-row-public-20260503T024327Z/llama3_8b_instruct_q8_0.bundle.json`

Tracks:
- compact-parity: ready_to_run — Refresh compact-header hello parity at 5 tokens on current head.
- broader-parity: ready_to_run — Run the broader three-prompt pack and require prompt/generated parity.
- chat-template-shapes: ready_to_run — Run the chat-template-shapes pack to broaden template coverage on the exact row.
- context-512: superseded_by_later_pass — The scaffold preserved the bounded 512-context timeout; the later one-pack pass is recorded at `../../llama3-8b-context-512-20260504T234625Z-head-58acf592345c/manifest.json`.
- api-webui-smoke: refreshed_by_later_pass — Reopened-lane API + frontend smoke for this exact row is recorded at `../../four-row-api-webui-20260505T003100Z-head-b403884/manifest.json`.
- perf-rss-portability: ready_to_run — Capture host facts, versions, model SHA, smoke timing, and backend RSS snapshots in one portable note.

Blockers:
- Historical scaffold blocker: the first 512-context attempt timed out on the original current head and remains preserved for auditability. Current status: a later reopened-lane rerun passed for one bounded pack only; it does not promote broader/larger-context support.
- Do not broaden to neighboring Llama sizes, quantizations, longer contexts, or other template families.
