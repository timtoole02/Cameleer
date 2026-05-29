# Q8_0 borrowed/token-major batch read reuse — 2026-05-05

Scope: structural Q8_0 file-backed read-reuse work only. This does not promote 8B long-context support, does not change any compatibility row status, and does not enable dense/f32 materialization.

Change: the borrowed transposed matmul path now detects file-backed Q8_0 weights before falling back to one-row accumulation. When the weight can be interpreted as Q8_0 transposed rows, it routes the whole input batch through the existing chunked Q8 block reader so each Q8 row chunk is read once and reused across all input rows.

Why: the non-borrowed file-backed matmul path already batches reads across prefill input rows. The borrowed/token-major path still had a row-at-a-time reader, which made multi-row output-projection or reinterpreted-token-major callers structurally re-read the same Q8 chunks per input row. This closes that local reread gap while keeping the default lazy file-backed Q8 path memory-safe.

Targeted coverage:

- `inference::tests::q8_0_file_backed_borrowed_batch_matmul_reuses_chunk_reads_across_input_rows` constructs a 3-row input batch and 4 Q8_0 token-major rows with a 2-row chunk size. It verifies the file-backed borrowed/token-major result matches the retained-block Q8 dot output and records only 2 Q8 file reads / 136 bytes, not one scan per input row.

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_borrowed_batch_matmul_reuses_chunk_reads_across_input_rows --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`
- `./scripts/with-rustup-cargo.sh test -q output_projection_diagnostics_support_q8_0_file_backed_token_major_rows --lib`
- `./scripts/with-rustup-cargo.sh test -q`
- `./scripts/with-rustup-cargo.sh clippy -q --all-targets -- -D warnings`
- `bash scripts/check-public-scrub.sh`
- `./scripts/with-rustup-cargo.sh build -q --release --bin camelid`

Claim boundary: this is a structural batching/read-reuse guardrail for Q8_0 file-backed execution. It is not a support, throughput, portability, or 8B promotion claim; the 8B 1024/2048 timeout boxes remain frozen red until broader backend architecture work lands.
