# Llama 3 8B 1024/2048 current-head refresh (48c2b8d)

Scope: exact `llama3_8b_instruct_q8_0` row only, `Meta-Llama-3-8B-Instruct-Q8_0.gguf`, bounded `llama3-context-1024-smoke-v1` and `llama3-context-2048-smoke-v1` packs, `max_tokens=5`.

Current-head source: clean public `main` at `48c2b8d4ba1f459e4939e9f64d39bf03f29e7a04` after the attention KV scan hot-path change.

Public artifacts:

- `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T063016Z-head-48c2b8d4ba1f/manifest.json`
- `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T063016Z-head-48c2b8d4ba1f/summary.json`
- `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T063016Z-head-48c2b8d4ba1f/SHA256SUMS`

Result:

- 1024 pack: prompt tokens matched at `881`; generated tokens matched `[34,2735,35,12,4278]`; generated text matched `CMLD-102`; max RSS `17373544 KiB`.
- 2048 pack: prompt tokens matched at `1910`; generated tokens matched `[34,2735,35,12,7854]`; generated text matched `CMLD-204`; max RSS `17507640 KiB`.

Boundary: this promotes only the checked 1024/2048 bounded packs for the exact Llama 3 8B Instruct Q8_0 row. It does not promote model-native/larger context, arbitrary templates, production throughput, portability, neighboring quantizations, or broader/full Llama-family support.
