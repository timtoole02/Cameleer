# 2026-05-06 — Q8 test guard deadlock repair

Scope: test hardening for the lazy/file-backed Q8 path only. This does not promote 8B 1024/2048 support and does not widen docs/API/frontend claims.

Finding:

- A local orphaned `cargo test -q q8 --lib -- --test-threads=1` process in this repo had been idle for ~46 minutes at 0 CPU.
- Root cause: test-only Q8 global-state serialization was also taken inside low-level Q8 read/cache helper functions. Guarded tests that exercised the parallel Q8 reader held the test guard on the main test thread, then Rayon workers attempted to re-enter the same thread-owned guard and blocked.
- Runtime Q8 counters are atomics and the bounded Q8 file cache is protected by its own mutex, so low-level helper functions do not need the test-only serialization guard. Tests retain explicit Q8/env guards around global-state assertions.

Change:

- Removed test-only `q8_file_state_lock()` acquisition from low-level Q8 file-read/cache/stat helper paths:
  - `Q8BlockReader::dequantize_block_to_slice`
  - `record_q8_0_file_read`
  - `q8_0_file_read_stats`
  - `q8_file_cache_get`
  - `q8_file_cache_insert`
  - `q8_file_cache_snapshot`

Evidence gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows --lib -- --test-threads=1` — PASS (1 passed)
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_borrowed_batch_matmul_reuses_chunk_reads_across_input_rows --lib -- --test-threads=1` — PASS (1 passed)
- `./scripts/with-rustup-cargo.sh test -q q8_file_cache --lib -- --test-threads=1` — PASS (4 passed)
- `./scripts/with-rustup-cargo.sh test -q q8 --lib -- --test-threads=1` — PASS (35 passed)
- `./scripts/with-rustup-cargo.sh clippy -q --all-targets -- -D warnings` — PASS
- `./scripts/with-rustup-cargo.sh test -q --test api_vertical_slice capabilities_report_support_contract_and_planned_lanes` — PASS (1 passed)
- `node scripts/test-check-public-evidence-claims.mjs` — PASS

Cleanup:

- Terminated the stale local q8 lib-test process after the fixed q8 suite completed locally. No long 8B run was duplicated.
