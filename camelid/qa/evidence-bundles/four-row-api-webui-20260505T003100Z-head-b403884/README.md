# Four-row API + frontend smoke — 2026-05-05

Public, sanitized summary for the reopened Ubuntu validation lane on a clean public checkout at `b4038844cfb666955164e22b5e6bab0e0488c473`.

Result: TinyLlama 1.1B Chat Q8_0, Llama 3.2 1B Instruct Q8_0, Llama 3.2 3B Instruct Q8_0, and Llama 3 8B Instruct Q8_0 all passed the exact-row API + frontend smoke slice recorded in `manifest.json`.

Covered in this bundle:

- release build
- frontend install/build/model-state smoke
- `/v1/health` before and after model load
- `/api/models/load`
- `/api/models/current`
- `/v1/models`
- `/api/capabilities`
- `/v1/completions`
- `/v1/chat/completions`
- frontend smoke contract checks

Boundary: this is freshness evidence for the four exact supported/smoke-supported rows only. It does not promote broad Llama-family support, neighboring rows, other quantizations, longer contexts, arbitrary-template support, full parity, or performance portability. The bounded 8B broader 50-token pass is recorded separately at `../llama3-8b-broader-50tok-20260505T005031Z-head-d13541ad8d7e/`, the first 8B 512-context pass is recorded separately at `../llama3-8b-context-512-20260504T234625Z-head-58acf592345c/`, and the bounded 8B compact chat-template-shapes pass is recorded separately at `../llama3-8b-chat-template-shapes-20260505T003821Z-head-d13541ad8d7e/`.
