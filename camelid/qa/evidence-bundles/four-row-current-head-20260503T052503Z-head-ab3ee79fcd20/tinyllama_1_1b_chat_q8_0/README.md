# TinyLlama 1.1B Chat Q8_0

Public status: supported_current_gate
Expected model SHA256: `a4c9bb1dbaa372f6381a035fa5c02ef087aaa1ff1f843a56a22328114f03fc59`
Carry-forward bundle: `qa/evidence-bundles/four-row-public-20260503T024327Z/tinyllama_1_1b_chat_q8_0.bundle.json`

Tracks:
- compact-parity: ready_to_run — Refresh bounded TinyLlama hello parity on current head.
- broader-parity: carry_forward_only — Preserve the existing five-prompt/50-token TinyLlama gate while a fresh current-head rerun is scheduled.
- chat-template-shapes: ready_to_run — Run the exact-row TinyLlama marker-template shape pack.
- context-512: ready_to_run — Run the bounded TinyLlama 512-context pack and preserve success or failure durably.
- api-webui-smoke: ready_to_run — Refresh current-head TinyLlama load/completions/chat/frontend smoke.
- perf-rss-portability: ready_to_run — Capture host facts plus RSS after load/1tok/5tok/API-WebUI smoke.

Blockers:
- Fresh current-head API/WebUI/perf artifacts are still needed in a durable target/full-support root.
- Do not imply support for adjacent TinyLlama quantizations or other families.
