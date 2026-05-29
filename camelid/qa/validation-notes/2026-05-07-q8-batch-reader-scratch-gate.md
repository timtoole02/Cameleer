# Q8 file-reader scratch gating guard

Date: 2026-05-07
Head under test: local worktree after `4b776f623c497090c7eee9a374034f33933e7752`

## Scope

Code-only structural runtime/perf guard for lazy/file-backed Q8_0 batched matmul. This does not change any model support row, bounded context claim, or public 8B status.

## Change

`matmul_rhs_transposed_q8_0_block_reader` now computes the Q8 output-parallel decision once and applies the output-scratch chunk cap only when that parallel scratch buffer will actually be used. Serial or narrow-output batched calls keep the larger weight-read chunk size instead of being split by an unused scratch budget.

This prevents avoidable extra file-backed Q8 read chunks in serial/small-output batched paths while preserving the existing bounded scratch cap for parallel wide-output paths.

## Local validation

- `cargo fmt --check`
- `cargo test q8_file_reader_batch_chunk_rows_respect_output_scratch_budget -- --nocapture`
- `cargo test q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows -- --nocapture`
- `cargo test q8_0_file_backed_borrowed_batch_matmul_reuses_chunk_reads_across_input_rows -- --nocapture`
- `cargo test -q` (status 0)

All passed locally.

## Support boundary

This is local code/test evidence only. It does not refresh TinyLlama, Llama 3.2 1B/3B, or Llama 3 8B current-head evidence and must not be cited as a current-head 8B green artifact.
