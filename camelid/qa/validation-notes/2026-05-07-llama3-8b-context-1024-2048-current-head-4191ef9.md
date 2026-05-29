# Llama 3 8B current-head bounded 1024/2048 pass

Run: 2026-05-07T075407Z on the canonical Ubuntu validation host.

Git head: `4191ef9fcc286a7996bad672397ee5582f2c5b26` (`Clamp 8B context support at 512` before this promotion alignment).

Public bundle: `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T075407Z-head-4191ef9fcc28/manifest.json` plus `SHA256SUMS`.

Results:
- `llama3-context-1024-smoke-v1`: 881 prompt tokens, generated text `CMLD-102`, max RSS 17,373,148 KiB, PASS.
- `llama3-context-2048-smoke-v1`: 1910 prompt tokens, generated text `CMLD-204`, max RSS 17,507,408 KiB, PASS.

Boundary: this promotes only the exact `llama3_8b_instruct_q8_0` bounded 1024/2048 prompt packs. It does **not** promote model-native/larger context, arbitrary templates, neighboring rows, broad 8B, full Llama-family support, portability, or production throughput.
