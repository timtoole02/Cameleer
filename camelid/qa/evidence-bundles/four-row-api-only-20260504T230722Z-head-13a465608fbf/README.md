# Four-row API-only smoke — 2026-05-04

Public, sanitized summary for the reopened Ubuntu validation lane on public `main` at `13a465608fbf1840b543851a4445f72ac2a2df0e`.

Result: TinyLlama 1.1B Chat Q8_0, Llama 3.2 1B Instruct Q8_0, Llama 3.2 3B Instruct Q8_0, and Llama 3 8B Instruct Q8_0 all passed the exact-row API-only smoke slice recorded in `manifest.json`.

Covered in this bundle:

- `/v1/health` before and after model load
- `/api/models/load`
- `/api/models/current`
- `/v1/models`
- `/api/capabilities`
- `/v1/completions`
- `/v1/chat/completions`

Boundary: this bundle is an API freshness slice only. The later API + frontend smoke summary at `../four-row-api-webui-20260505T003100Z-head-b403884/` supersedes it for WebUI freshness; the bounded 8B broader 50-token pass is recorded separately at `../llama3-8b-broader-50tok-20260505T005031Z-head-d13541ad8d7e/`; the first 8B 512-context pass is recorded separately at `../llama3-8b-context-512-20260504T234625Z-head-58acf592345c/`; and the bounded 8B compact chat-template-shapes pass is recorded separately at `../llama3-8b-chat-template-shapes-20260505T003821Z-head-d13541ad8d7e/`. None of these bundles promote broad/full support, neighboring rows, other quantizations, larger contexts, arbitrary-template support, or performance portability.
