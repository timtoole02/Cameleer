# Llama 3.2 1B Q8_0 bounded 2048-context RoPE-factor pass

This sanitized bundle records the exact Llama 3.2 1B Instruct Q8_0 `llama3-context-2048-smoke-v1` rerun after Camelid changed GGUF `rope_freqs.weight` handling to match llama.cpp frequency factors.

Result: the 1910-token bounded recall prompt matched prompt tokens, generated token IDs, and generated text for the checked 5-token output (`CMLD-204`).

Boundary: this closes only the third bounded 2048-context pack for this exact 1B Q8_0 row. It does not promote neighboring rows, other quantizations, model-native/larger context buckets beyond the checked pack, arbitrary templates, broad/full Llama-family support, production throughput, or portability support.
