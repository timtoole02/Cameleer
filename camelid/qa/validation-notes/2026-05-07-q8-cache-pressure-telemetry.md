# 2026-05-07 — Q8 cache pressure telemetry

Scope: runtime diagnostics and benchmark reporting only. This does not widen model support, API capabilities, frontend readiness, context support, or broader/full 8B claims.

Change:

- Extended lazy Q8_0 file-read stats with bounded-cache pressure counters: misses/bytes, inserts/bytes, evictions/bytes, and coalescing merges/bytes, alongside existing reads and cache-hit bytes.
- Forward memory trace stderr now prints these counters and MiB totals, so interrupted long-context probes can still distinguish useful cache reuse from capacity churn.
- Structured forward/layer/phase memory merge logic accumulates the new counters, preserving per-layer Q8 cache attribution.
- `scripts/bench-unique-chat.mjs` carries the new cache pressure fields into compact per-run memory summaries and printed averages for cache hits, misses, inserts, and evictions.

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_file_cache --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`
- `./scripts/with-rustup-cargo.sh test -q memory_timing_merge_tracks_forward_passes_and_peak_rss --lib`
- `./scripts/with-rustup-cargo.sh test -q layer_memory_merge_accumulates_q8_file_reads --lib`
- `./scripts/with-rustup-cargo.sh test -q prefill --lib`
- `node --check scripts/bench-unique-chat.mjs`
- `node scripts/check-public-evidence-claims.mjs && node scripts/test-check-public-evidence-claims.mjs`
- `./scripts/check-public-scrub.sh`
- `./scripts/with-rustup-cargo.sh clippy -q --all-targets -- -D warnings`
- `./scripts/with-rustup-cargo.sh test`

Remote note: canonical Ubuntu was checked first; existing backend/bench processes were active, including non-Llama Q8 block benches, so no duplicate long 8B run was launched for this telemetry-only slice.

Claim boundary: diagnostics only. Existing Llama 3 8B current-head support remains exact-row bounded-pack only where fresh row-specific PASS artifacts plus support-surface alignment exist; this source change requires a new canonical PASS before any current-head green 8B 1024/2048 claim.
