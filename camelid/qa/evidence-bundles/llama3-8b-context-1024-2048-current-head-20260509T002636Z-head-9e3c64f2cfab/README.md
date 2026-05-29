# Llama 3 8B Q8_0 bounded 1024/2048 current-head evidence

Fresh exact-row bounded-pack evidence for `Meta-Llama-3-8B-Instruct-Q8_0.gguf` at runtime source head `9e3c64f2cfab` (`9e3c64f2cfab098f9cccbc8e5f879ecd99d73666`).

- model sha256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`
- pack 1024: PASS, generated text `CMLD-102`, generated tokens `[34, 2735, 35, 12, 4278]`, prompt-token/generated-token/generated-text parity matched llama.cpp; wall `2:14.84`, max RSS `17383572` KiB
- pack 2048: PASS, generated text `CMLD-204`, generated tokens `[34, 2735, 35, 12, 7854]`, prompt-token/generated-token/generated-text parity matched llama.cpp; wall `4:37.33`, max RSS `17571348` KiB
- claim boundary: exact Llama 3 8B Instruct Q8_0 row and checked bounded 1024/2048 packs only; no broad Llama-family, neighboring-row, arbitrary-template, model-native/larger-context beyond checked packs, production-throughput, or portability claim

Primary files: `manifest.json`, `summary.json`, `run-state.json`, `SHA256SUMS`, `pack-1024/summary.json`, `pack-2048/summary.json`, and the two pack `report.json` files.
