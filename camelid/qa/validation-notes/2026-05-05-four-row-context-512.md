# Four-row bounded 512-context pack — 2026-05-05

Scope: first bounded 512-context pack for the four exact supported Q8_0 rows only: TinyLlama 1.1B Chat, Llama 3.2 1B Instruct, Llama 3.2 3B Instruct, and Llama 3 8B Instruct.

Result: PASS on a clean public checkout at `b4038844cfb666955164e22b5e6bab0e0488c473` on the approved Ubuntu validation lane.

Validated rows:

- `tinyllama_1_1b_chat_q8_0`: 291 reference prompt tokens, 5 generated tokens, prompt tokens/generated token IDs/generated text all matched, max RSS `2368876 KiB`.
- `llama32_1b_instruct_q8_0`: 245 reference prompt tokens, 5 generated tokens, prompt tokens/generated token IDs/generated text all matched, max RSS `2858252 KiB`.
- `llama32_3b_instruct_q8_0`: 245 reference prompt tokens, 5 generated tokens, prompt tokens/generated token IDs/generated text all matched, max RSS `7251932 KiB`.
- `llama3_8b_instruct_q8_0`: 245 reference prompt tokens, 5 generated tokens, prompt tokens/generated token IDs/generated text all matched, max RSS `17262740 KiB`.

Public sanitized evidence:

- `qa/evidence-bundles/four-row-context-512-20260505T051510Z-head-b403884/manifest.json`
- `qa/evidence-bundles/four-row-context-512-20260505T051510Z-head-b403884/summary.json`
- `qa/evidence-bundles/four-row-context-512-20260505T051510Z-head-b403884/SHA256SUMS`

Claim boundary: this closes only the first bounded 512-context pack for these four exact Q8_0 rows. It does **not** promote neighboring rows, other quantizations, 1k/2k or model-native context buckets, arbitrary template behavior, broader/full Llama-family support, or portability/performance support.
