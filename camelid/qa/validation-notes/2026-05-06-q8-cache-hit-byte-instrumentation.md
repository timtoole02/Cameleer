# 2026-05-06 — Q8_0 cache-hit byte instrumentation

Scope: structural Q8_0 file-backed read/cache telemetry only. This does not promote 8B long-context support, does not change any compatibility row status, and does not widen Llama-family support.

Change:

- `Q8_0FileReadStats` now reports `cache_hit_bytes` alongside `cache_hits`, `read_calls`, and `read_bytes`.
- Forward/layer/phase merge logic accumulates `cache_hit_bytes`, so structured RSS/forward timing artifacts can distinguish "a hit occurred" from "how much Q8 payload was actually served from the bounded cache".
- Existing cache behavior remains opt-in and memory-safe by default (`CAMELID_Q8_0_FILE_CACHE_BYTES=0` unless explicitly raised).

Why this slice:

- Tim's current working hypothesis is that lazy file-backed Q8 prefill with the default 128-token chunks can stream very large Q8 payload volumes, while retained Q8 blocks reduce file I/O by keeping Q8 payload resident at heavy RAM cost.
- Existing exact 1B/2048 evidence supports the mechanism: the default chunked lazy Q8 path streamed `62,037,910,144` bytes during prefill for the 1910-token prompt, with `0` cache hits at capacity `0` (`qa/validation-notes/2026-05-05-llama32-1b-q8-2048-current-main-watchdog.md`).
- The diagnostic 256 MiB cache probe did not materially reduce bytes (`63,350,893,312` -> `63,349,770,496`) and raised backend peak RSS by roughly `353 MiB`, showing that small opportunistic caching is not enough for this access pattern (`qa/validation-notes/2026-05-05-llama32-1b-q8-2048-cache-probe.md`).
- For 8B, the retained-block hot-path probe shows much larger representative Q8 payloads: each checked FFN projection is `59.5 MiB`, and `output.weight` alone is `532.3 MiB` while avoiding about `2.0 GiB` of f32 materialization (`qa/validation-notes/2026-05-05-lazy-q8-hotpath-costs.md`). A default 128-token prefill over ~2048 tokens has roughly 15-16 chunks, so repeated lazy scans over 8B-sized Q8 weights plausibly reach the reported ~400+ GiB I/O class without a full-model retained/cache strategy. This is an extrapolated blocker hypothesis, not a fresh 8B long-run result.

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_file_cache --lib`
- `./scripts/with-rustup-cargo.sh test -q layer_memory_merge_accumulates_q8_file_reads --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`
- `./scripts/with-rustup-cargo.sh clippy -q --all-targets -- -D warnings`
- `bash scripts/check-public-scrub.sh`
- `./scripts/with-rustup-cargo.sh test -q`
- `./scripts/with-rustup-cargo.sh build -q --release --bin camelid`

Claim boundary: this adds byte-level cache-hit accounting to make future Q8 read-reduction artifacts auditable. It is not a correctness fix, throughput claim, support promotion, or 8B 1024/2048 green-box change.
