# Llama 3 8B current-head 1024/2048 bounded context evidence

Clean Ubuntu current-main run at 86081876d01e. Both checked prompt packs passed prompt-token, generated-token, and generated-text parity against the independent local reference runtime.

This bundle also records structured RSS/Q8 file-read counters from Camelid with lazy file-backed Q8, retained Q8 blocks off, chunked prefill 256, and the scoped layer-major Q8 cache set to 256 MiB.

Boundary: Closes only current-head bounded 1024/2048 context parity packs for the exact Llama 3 8B Instruct Q8_0 row at 86081876d01e. This does not promote neighboring rows, other quantizations, model-native/larger context buckets beyond these checked packs, arbitrary GGUF/Jinja template execution, broad/full Llama-family support, production throughput, or portability support.

Raw operator paths/ports are intentionally omitted from the public bundle.
