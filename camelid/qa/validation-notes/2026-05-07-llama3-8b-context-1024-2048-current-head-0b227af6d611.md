# Llama 3 8B bounded 1024/2048 current-head validation — 2026-05-07

Result: **PASS** for the exact `llama3_8b_instruct_q8_0` bounded 1024/2048 prompt packs on current `main` after the support-claim alignment commit.

Git head: `0b227af6d61122701cfdbdd1ffa09b9b8d019c1c` (`Promote exact 8B bounded 1024/2048 evidence`).

Public bundle: `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T1738Z-head-0b227af6d611/manifest.json` plus `SHA256SUMS`. The source remote run directory was `<canonical-remote-workdir>/target/llama3-8b-context-1024-2048-current-head-20260507T1738Z-head-0b227af6d611/`.

Canonical remote: `canonical Ubuntu validation host`.

Runtime env: `CAMELID_FORWARD_RSS_TIMINGS=on`, `CAMELID_FORWARD_MEMORY_TRACE=0`, `CAMELID_PREFILL_LAYER_MAJOR_ATTRIBUTION=0`, and `CAMELID_Q8_FILE_CACHE_BYTES` unset.

Rows:

- `qa/prompt-packs/llama3-context-1024-smoke.json`: prompt tokens matched (`881`), generated token IDs/text matched, generated text `CMLD-102`, max observed RSS `979,796 KiB`, Q8 file reads `3,210` calls / `54,703,408,384` bytes.
- `qa/prompt-packs/llama3-context-2048-smoke.json`: prompt tokens matched (`1910`), generated token IDs/text matched, generated text `CMLD-204`, max observed RSS `1,855,444 KiB`, Q8 file reads `4,879` calls / `69,538,945,536` bytes.

Boundary: this promotes only the exact `llama3_8b_instruct_q8_0` bounded 1024/2048 prompt packs at git head `0b227af6d61122701cfdbdd1ffa09b9b8d019c1c`. It does **not** promote model-native/larger context, arbitrary templates, neighboring rows, broad 8B, full Llama-family support, portability, or production throughput.
