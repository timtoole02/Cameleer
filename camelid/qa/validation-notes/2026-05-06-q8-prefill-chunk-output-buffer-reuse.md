# 2026-05-06 — Q8 prefill chunk-output buffer reuse

Scope: diagnostic/performance structural headroom only. This does not promote 8B 1024/2048 support and does not widen docs/API/frontend claims.

Starting state:

- Current main/head at start of this run: `59a9134` (`Flatten Q8 prefill quant input buffer`).
- Active-run check found no existing long 8B/Camelid benchmark process and no visible Camelid 8B session, so this run did not duplicate a long 8B validation.

Change:

- Reused the multi-row file-backed Q8 block-reader chunk-output scratch buffer with a thread-local `Vec<f32>`.
- This removes one per-matmul allocation from the layer-major multi-row prefill Q8 path while preserving the existing Q8 bytes read, scale decode, dot products, output layout, cache policy, and single-row path behavior.
- The change is intentionally a small allocation-reuse slice; it is not a support-surface change and does not claim new model/context support.

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_borrowed_batch_matmul_reuses_chunk_reads_across_input_rows --lib`
- `./scripts/with-rustup-cargo.sh test -q prefill --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_accumulate_matches_q8_block_dot_across_chunks --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_file_cache --lib`
- `./scripts/with-rustup-cargo.sh test -q`
- `./scripts/with-rustup-cargo.sh clippy -q --all-targets -- -D warnings`
- `bash scripts/check-public-scrub.sh`
- `./scripts/with-rustup-cargo.sh build -q --release --bin camelid`

Claim boundary: performance-only. Exact support remains bounded by existing row-specific PASS artifacts; 8B 1024/2048 must stay red unless/until docs/API/frontend are deliberately aligned with reviewed current-head PASS artifacts.
