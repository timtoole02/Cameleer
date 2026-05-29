# Llama 3 8B current-head bounded 1024/2048 pass

Run: 2026-05-07T113718Z on the canonical Ubuntu validation host.

Git head: `b3633cbd6271c9a5bc28b4da97f8150ce0e6ebbf` (`Align 8B bounded context support surfaces`).

Public bundle: `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T113718Z-head-b3633cbd6271/manifest.json` plus `SHA256SUMS`. Raw copied artifacts are under `target/llama3-8b-context-1024-2048-current-head-20260507T113718Z-head-b3633cbd6271/`.

Results:
- `llama3-context-1024-smoke-v1`: 881 prompt tokens, generated text `CMLD-102`, max RSS 17,373,420 KiB, PASS.
- `llama3-context-2048-smoke-v1`: 1910 prompt tokens, generated text `CMLD-204`, max RSS 17,507,704 KiB, PASS.

Boundary: this promotes only the exact `llama3_8b_instruct_q8_0` bounded 1024/2048 prompt packs. It does **not** promote model-native/larger context, arbitrary templates, neighboring rows, broad 8B, full Llama-family support, portability, or production throughput.
