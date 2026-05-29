# 2026-05-05 — Llama 3.2 1B/3B unique-chat perf/RSS envelope

Scope: exact `llama32_1b_instruct_q8_0` and `llama32_3b_instruct_q8_0` rows only.

A clean public `main` checkout at `e9f28572e090e8c564e7ebbf36a4475c345da2b8` ran `scripts/bench-unique-chat.mjs` on the approved Ubuntu validation lane against the exact Llama 3.2 1B and 3B Instruct Q8_0 GGUFs.

Result: PASS.

Validated steps:

- clean public checkout with dirty tree `false`
- release `camelid` build via the pinned Rust wrapper
- `scripts/bench-unique-chat.mjs` with `--warmup 2 --repeats 4 --max-tokens 5`
- unique `/v1/chat/completions` prompts for each warmup/measured request so prompt-cache hits stay false
- backend RSS milestones before model load, after model load, after first generated token, and after first 10 generated tokens
- sanitized `manifest.json`, `summary.json`, and `SHA256SUMS` generation

Key observations:

- Llama 3.2 1B Instruct Q8_0: 4 measured requests, all measured runs reported hot weight cache, no prompt-cache hits, average wall time `7379.73 ms`, average backend generate time `7065.25 ms`, max sampled backend RSS `274.31 MiB`.
- Llama 3.2 3B Instruct Q8_0: 4 measured requests, all measured runs reported hot weight cache, no prompt-cache hits, average wall time `19762.21 ms`, average backend generate time `19449.25 ms`, max sampled backend RSS `287.21 MiB`.

Public sanitized evidence:

- `qa/evidence-bundles/llama32-1b-3b-unique-chat-perf-rss-20260505T061644Z-head-e9f28572e090/manifest.json`
- `qa/evidence-bundles/llama32-1b-3b-unique-chat-perf-rss-20260505T061644Z-head-e9f28572e090/SHA256SUMS`

Claim boundary: this closes only the bounded unique-chat memory/perf envelope box for the exact Llama 3.2 1B/3B Instruct Q8_0 rows. It does **not** promote broad/full Llama-family support, neighboring rows, other quantizations, larger context buckets, arbitrary GGUF/Jinja template execution, production throughput, or portability support.
