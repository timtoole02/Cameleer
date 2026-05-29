# 2026-05-14 — Throughput harness cleanup

Scope: local throughput-harness hygiene and support-claim boundary only.

## Cleanup

- Promoted the local ignored WIP harness `scripts/bench-llama3-same-host.mjs` into a tracked, repeatable same-host Camelid-vs-llama.cpp benchmark harness.
- Removed the local `.git/info/exclude` rule that silently hid that script from `git status`.
- Added `scripts/test-bench-llama3-same-host.mjs` to exercise the non-network `--print-plan` and `--help` paths.
- Rechecked the local support path: the harness is tracked, there is no `.git/info/exclude` rule hiding it, and the remaining ignored throughput/perf files are historical evidence/log artifacts rather than active silent harness WIP.

## Exact harness command shape

Dry-run plan / command audit without starting servers:

```sh
node scripts/bench-llama3-same-host.mjs \
  --print-plan \
  --model /path/to/Llama-3.2-3B-Instruct-Q8_0.gguf \
  --model-id llama32-3b-q8-throughput \
  --row-id llama32_3b_instruct_q8_0 \
  --max-tokens 16 --warmup 1 --repeats 3 --threads 8 \
  --out target/bench-llama32-3b-same-host.plan.json
```

Measurement run after building Camelid and ensuring llama.cpp `llama-server` is available:

```sh
CAMELID_BIN=target/release/camelid \
LLAMA3_LLAMA_SERVER=target/reference/llama.cpp/build/bin/llama-server \
node scripts/bench-llama3-same-host.mjs \
  --model /path/to/Llama-3.2-3B-Instruct-Q8_0.gguf \
  --model-id llama32-3b-q8-throughput \
  --row-id llama32_3b_instruct_q8_0 \
  --max-tokens 16 --warmup 1 --repeats 3 --threads 8 \
  --out target/bench-llama32-3b-same-host.json
```

## Outputs and bounded metrics

Stdout summary keys:

- `camelid_ttft_ms`
- `camelid_decode_tok_s`
- `camelid_ms_tok`
- `llama_cpp_ttft_ms`
- `llama_cpp_decode_tok_s`
- `llama_cpp_ms_tok`
- `json_out` when `--out` is set

JSON report schema: `camelid.same_host_llama3_benchmark.v1`.

Metric bounds: TTFT is first non-empty streamed content chunk. Decode tok/s and ms/token are derived from non-empty streamed content chunk count, not tokenizer-ground-truth generated-token counts.

## Claim boundary

This harness does not make or promote a throughput claim by itself. It records bounded same-host timing evidence for the exact row, GGUF, prompt, token budget, host, binaries, and thread settings used in one run.

It does not influence Llama 3.2 1B or Mixtral support claims unless separate row-specific evidence is captured under those exact conditions. Mixtral remains blocked by later-generation divergence/hang evidence, and 1B remains bounded to its existing row-specific support/evidence lanes.
