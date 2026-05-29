# Apple Silicon retained-Q8 hybrid default gate

This bundle records the sanitized result behind changing the retained-Q8 CPU+Metal hybrid scheduler from macOS default-on to explicit opt-in.

## Scope

- Exact row: Llama 3.2 3B Instruct Q8_0
- Workload: same-host Apple Silicon short chat decode, max_tokens=8
- Endpoint: /v1/chat/completions
- Weight cache: hot on measured rows
- Prompt cache: unique prompts; measured rows reported no prompt-cache hits

## Result

| Mode | Repeats | Avg generate ms | Avg layers ms | Avg FFN total ms | Observed peak backend RSS MiB |
| --- | ---: | ---: | ---: | ---: | ---: |
| old_implicit_hybrid_default_10_percent | 2 | 4867 | 4749.75 | 883.52 | 4458.73 |
| explicit_cpu_only_sweep | 2 | 4808 | 4689.74 | 858.8 | 4255.06 |
| new_default_hybrid_off | 3 | 4819.33 | 4701.71 | 846.32 | 3817.66 |

Decision: keep the retained-Q8 CPU path as the normal default and leave the CPU+Metal suffix scheduler as an explicit experiment through `CAMELID_HYBRID_Q8_RETAINED=1`.

## Boundary

This is a narrow tuning gate, not a broad Metal benchmark. Raw local JSON files are not committed because they include local paths and host/process details.
