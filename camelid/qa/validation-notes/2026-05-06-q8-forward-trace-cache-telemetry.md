# 2026-05-06 — Q8_0 forward-memory trace cache telemetry

Scope: diagnostic telemetry only. This does not promote 8B long-context support, does not change any compatibility row status, and does not widen API/docs support claims.

Change:

- `CAMELID_FORWARD_MEMORY_TRACE=1` stderr lines now include Q8_0 file-cache hit counts/bytes plus cache occupancy/capacity fields alongside existing Q8_0 read counts/bytes.
- Structured JSON timings already carried `cache_hit_bytes`; this makes long-running stderr traces self-contained when a diagnostic run times out before a full report is emitted.
- The file-backed Q8_0 row-reader now decodes weight-block scales once per loaded chunk for single-row matmuls too, instead of decoding the same fp16 scale inside each dot-product loop. The multi-row prefill path already used this pattern; this extends the same low-risk hot-path cleanup to single-token/file-backed projections.

Why:

- The 8B long-context lane is measuring whether lazy file-backed Q8_0 prefill is dominated by repeated Q8 payload streaming, and whether bounded cache probes actually serve meaningful bytes rather than merely recording occasional hits.
- The previous trace showed cumulative Q8 read bytes but did not expose cache-hit byte volume or live cache occupancy, making timeout-era artifacts harder to interpret.
- Single-token logits/layer projections are not the 1024/2048 red-box root cause, but scale decode reuse removes avoidable scalar work from the same Q8 file-backed reader without changing read volume, tensor layout, or support status.

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`

Follow-up local instrumentation slice:

- `CAMELID_PREFILL_LAYER_MAJOR_ATTRIBUTION=1` now adds optional structured per-layer/per-prefill-chunk attribution to forward memory timings for the layer-major prefill schedule.
- Each attribution record carries layer index, chunk start/rows/base position, hidden/next-hidden/chunk-input byte sizes, KV-cache allocated bytes before/after, Q8_0 file-read deltas, and the existing per-layer chunk timings.
- The flag also enables structured forward-memory output when no broader RSS/trace flag is enabled, so a diagnostic run can request only this attribution without changing public API/support claims.
- Focused coverage asserts the attribution serializes and keeps chunked/layer-major prefill output, logits, hidden state, and KV cache equal to the sequential path.

Follow-up local gates on current main `041b345` plus the attribution patch:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q chunked_prefill_matches_sequential_prefill_outputs_and_cache --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`
- `./scripts/with-rustup-cargo.sh clippy -q --lib -- -D warnings`
- `./scripts/with-rustup-cargo.sh test -q --lib` (`117 passed`)

Claim boundary: diagnostic/performance-only. 8B 1024/2048 remain red/timeout-blocked diagnostic targets until fresh row-specific PASS artifacts are committed and docs/API/frontend are deliberately aligned.
