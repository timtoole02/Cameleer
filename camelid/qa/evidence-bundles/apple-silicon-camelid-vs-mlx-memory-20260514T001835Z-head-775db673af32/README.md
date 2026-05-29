# Camelid vs MLX-LM local memory profile

Captured: 20260514T001835Z
Source head: `775db673af32`

This bundle is intentionally narrow: it compares resident memory on the same Apple Silicon host for Camelid's memory-first lazy GGUF Q8_0 path against MLX-LM public 4-bit models. It is **not** a strict quant-equivalent speed benchmark.

## Result

| Model family | Camelid observed RSS MiB | MLX-LM observed RSS MiB | MLX / Camelid RSS | Camelid RSS reduction |
| --- | ---: | ---: | ---: | ---: |
| Llama 3.2 1B Instruct | 257.72 | 1062.06 | 4.12x | 75.73% |
| Llama 3.2 3B Instruct | 328.92 | 2139.7 | 6.51x | 84.63% |

## Important boundary

- Camelid wins this **resident-memory** comparison in the memory-first profile.
- MLX-LM is much faster in this short probe; do not present this as a speed win.
- Camelid uses GGUF Q8_0; the MLX rows use public 4-bit MLX weights.
- Local paths and machine-specific details were scrubbed from the committed artifact.

See `summary.json` for the full sanitized row data.
