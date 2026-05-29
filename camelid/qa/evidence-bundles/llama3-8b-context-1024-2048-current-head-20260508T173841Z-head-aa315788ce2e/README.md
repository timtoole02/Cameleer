# Llama 3 8B Q8_0 bounded 1024/2048 current-head evidence

Fresh exact-row bounded-pack evidence for `Meta-Llama-3-8B-Instruct-Q8_0.gguf` at runtime/API/frontend head `aa315788ce2e` (`aa315788ce2e748aff2ad736311f082b5cbaa05b`).

- model sha256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`
- pack 1024: PASS, generated text `CMLD-102`, prompt-token/generated-token/generated-text parity matched llama.cpp
- pack 2048: PASS, generated text `CMLD-204`, prompt-token/generated-token/generated-text parity matched llama.cpp
- claim boundary: exact Llama 3 8B Instruct Q8_0 row and checked bounded 1024/2048 packs only; no broad Llama-family, neighboring-row, arbitrary-template, model-native/larger-context, production-throughput, or portability claim

Primary public files: `manifest.json`, `summary.json`, `run-state.json`, `SHA256SUMS`, `pack-1024/summary.json`, `pack-2048/summary.json`, and the two pack `report.json` files.
