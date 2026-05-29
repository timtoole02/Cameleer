# Llama 3 8B current-head 1024/2048 bounded context evidence

Clean Ubuntu current-main run at 9f8588bb4a4e. Both checked prompt packs passed prompt-token, generated-token, and generated-text parity against llama.cpp.

This is exact-row bounded-pack evidence only for Meta-Llama-3-8B-Instruct-Q8_0.gguf; it does not promote neighboring rows, other quantizations, model-native/larger context beyond these checked packs, arbitrary templates, portability, broad/full Llama-family support, or production throughput.

Raw operator paths/ports are sanitized in the published bundle.
