# Llama 3 8B current-head bounded 1024/2048 context evidence

Generated: `2026-05-08T09:32:57Z`
Started: `2026-05-08T09:10:25Z`
Git head: `844e8d4709d1a1de9bd441a66ce908283755417f`

Result: `PASS` for the exact `llama3_8b_instruct_q8_0` row on the checked bounded 1024/2048 prompt packs only.

Primary checks:
- `llama3-context-1024-smoke-v1`: prompt tokens, generated tokens, and generated text matched llama.cpp; generated text `CMLD-102`.
- `llama3-context-2048-smoke-v1`: prompt tokens, generated tokens, and generated text matched llama.cpp; generated text `CMLD-204`.

Claim boundary: Closes only current-head bounded 1024/2048 context parity packs for the exact Llama 3 8B Instruct Q8_0 row at 844e8d4709d1. This does not promote neighboring rows, other quantizations, model-native/larger context buckets beyond these checked packs, arbitrary GGUF/Jinja template execution, broad/full Llama-family support, production throughput, or portability support.
