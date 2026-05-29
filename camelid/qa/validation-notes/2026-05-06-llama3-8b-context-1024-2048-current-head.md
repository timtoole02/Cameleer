# Llama 3 8B current-head 1024/2048 bounded context pass

Date: 2026-05-06 PDT / 2026-05-07 UTC

Scope: exact `llama3_8b_instruct_q8_0` row only, `Meta-Llama-3-8B-Instruct-Q8_0.gguf`, bounded `llama3-context-1024-smoke-v1` and `llama3-context-2048-smoke-v1` packs, `max_tokens=5`.

Evidence source: clean Ubuntu current-main validation lane on head `78d58b866692d056bbb3a33c0d68e20482389040`.

Public bundle:

- `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T040332Z-head-78d58b866692/manifest.json`
- `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T040332Z-head-78d58b866692/summary.json`
- `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T040332Z-head-78d58b866692/SHA256SUMS`

Result:

- 1024 pack: prompt tokens matched at `881`; generated tokens matched `[34,2735,35,12,4278]`; generated text matched `CMLD-102`; elapsed `2:07.26`; max RSS `17373436 KiB`.
- 2048 pack: prompt tokens matched at `1910`; generated tokens matched `[34,2735,35,12,7854]`; generated text matched `CMLD-204`; elapsed `4:42.41`; max RSS `17507296 KiB`.

Runtime envelope: lazy Q8 enabled, retained Q8 blocks disabled, prefill chunk tokens `256`, Q8 file cache bytes `0`, Q8 file-reader chunk bytes `67108864`, parallel linear enabled, forward RSS timings enabled.

Support boundary: this promotes only the exact 8B Q8_0 row's checked bounded 1024/2048 prompt packs, aligned with docs, `/api/capabilities`, and frontend badges. It does not promote model-native/larger context beyond checked packs, arbitrary templates, production throughput, portability, neighboring rows, other quantizations, or broad/full 8B/Llama support.
