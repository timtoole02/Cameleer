# 2026-05-07 — Q8 byte-count runtime knobs

Scope: Q8 runtime-configuration safety/diagnostics only. This does not widen model support, API capabilities, frontend readiness, context support, or broad/full 8B claims.

Change:

- Shared the Q8 byte-count parser across the lazy Q8 file cache, file-reader chunk, and multi-row output-scratch knobs.
- The affected knobs still accept plain bytes exactly as before, preserving existing numeric defaults and scripts.
- They now also accept explicit binary suffixes (`KiB`/`MiB`/`GiB`, plus `K`/`M`/`G`; underscores and spaces ignored), reducing the chance that overnight diagnostic runs accidentally fall back to default read/cache sizing because a human-friendly value was supplied.

Affected env vars:

- `CAMELID_Q8_0_FILE_CACHE_BYTES`
- `CAMELID_Q8_0_FILE_READER_CHUNK_BYTES`
- `CAMELID_Q8_0_FILE_READER_OUTPUT_SCRATCH_BYTES`

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_byte_count_env_parser_accepts_binary_suffixes --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_file_reader_batch_chunk_rows_respect_output_scratch_budget --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_file_cache --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`
- `./scripts/with-rustup-cargo.sh test -q prefill --lib`
- `node scripts/test-check-public-evidence-claims.mjs`
- `./scripts/with-rustup-cargo.sh clippy -q --all-targets -- -D warnings`

Remote status: canonical Ubuntu already had the current-head 8B 1024/2048 validation run active at `target/llama3-8b-context-1024-2048-current-head-20260507T123320Z-head-59931c313181`, so this slice did not launch a duplicate long 8B run.

Claim boundary: config parsing and local guardrails only. Any runtime/source commit after the existing public 8B bounded PASS artifacts still needs a fresh row-specific current-head PASS before being called current-head green.
