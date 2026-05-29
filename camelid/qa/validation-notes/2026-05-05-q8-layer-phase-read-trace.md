# Q8_0 layer phase read tracing — 2026-05-05

Scope: structural Q8_0 I/O/correctness tracing only. This does not promote any row, does not change 8B long-context status, and does not widen Llama-family support.

Change: when structured forward memory timings are enabled, each `LlamaLayerMemoryTimings` now includes `q8_file_read_phases`: per-layer Q8_0 file-read/cache-hit deltas attributed to the layer phase that just completed, e.g. attention Q/K/V/output and FFN gate/up/down boundaries. Existing per-layer total `q8_file_reads` remains unchanged.

Why: previous 1B/2048 watchdog traces showed aggregate Q8 reads for prefill/layers but required manual inference to identify which layer phases were streaming file-backed Q8 payload. Phase-attributed deltas make future 1B/2048 correctness/perf traces more surgical without turning on dense diagnostics or changing support claims.

Local guardrails:

- `cargo test layer_memory_merge_accumulates_q8_file_reads`
- `cargo test q8_0_file_backed`

Claim boundary: code-only instrumentation/read-tracing guardrail. No green row/box changes are made here; row-specific PASS artifacts remain required before docs/API/frontend can promote any support boundary.
