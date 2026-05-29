# Llama 3 8B current-head bounded 1024/2048 evidence

Git head: `bb8b616a09d6cdde00d157a586722b1688e87eff`

Passed: `True`

Boundary: Promotes only exact llama3_8b_instruct_q8_0 bounded 1024/2048 prompt packs at this git head; does not promote model-native/larger context, arbitrary templates, neighboring rows, broad 8B, full Llama-family support, portability, or production throughput.

- 1024: CMLD-102, prompt tokens 881, max RSS 922252 KiB, Q8 reads 3210 calls / 54703408384 bytes
- 2048: CMLD-204, prompt tokens 1910, max RSS 1582312 KiB, Q8 reads 4879 calls / 69538945536 bytes
