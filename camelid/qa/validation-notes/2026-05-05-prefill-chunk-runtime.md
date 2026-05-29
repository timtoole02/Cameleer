# 2026-05-05 — chunked prompt-prefill runtime slice

Scope: backend performance/memory architecture only. This does not promote any Llama row, and it does not clear the frozen-red Llama 3 8B 1024/2048-context blockers.

Context:

- Tim's 8B rule was satisfied first: the current 8B 1024-context diagnostic was inspected before any further 8B long-context work.
- On the approved Ubuntu lane, clean public head `96b452723993c33c6c6140824673f62834839993` ran the exact 8B 1024 pack and failed red: llama.cpp accepted the 881-token prompt, but Camelid `/v1/chat/completions` timed out after the 900-second parity harness timeout before producing a parity report.
- Therefore the work pivoted to engine performance/memory architecture instead of another 8B 2048 promotion attempt.

Change:

- Prompt prefill can now process non-final prompt tokens in bounded chunks instead of replaying each prefill token through the full single-token path.
- The chunk path batches token embedding lookup, per-layer Q/K/V projections, RoPE application, KV-cache writes, causal attention context, attention output, and gated FFN activation for the prefill portion.
- The final prompt token still runs through the existing single-token path so logits, output normalization, diagnostics, and sampling behavior remain aligned with the established generation path.
- `matmul_rhs_transposed_q8_0_block_reader` now quantizes all input rows once and reuses each file-backed Q8_0 weight chunk across those rows before advancing the reader chunk. This reduces repeated Q8 file reads for batched prefill/projected rows.
- `CAMELID_PREFILL_CHUNK_TOKENS` controls chunk size; the default is now `128`. Values `0` or `1` fall back to sequential prefill.
- For lazy file-backed Q8_0 weights, the default prefill schedule now runs layer-major across prefill chunks so each layer's file-backed Q8_0 tensors are streamed across all prefill chunks before the next layer. Set `CAMELID_PREFILL_LAYER_MAJOR=0` to force the older chunk-major schedule while debugging.
- The default borrowed/file-backed Q8_0 row-reader target chunk is now `32 MiB` via `CAMELID_Q8_0_FILE_READER_CHUNK_BYTES`, reducing per-layer chunk-loop read-call overhead while keeping the Q8 file cache itself opt-in.

Follow-up instrumentation:

- Chunked prompt prefill now participates in structured forward-memory diagnostics when `CAMELID_FORWARD_RSS_TIMINGS=1` or `CAMELID_FORWARD_MEMORY_TRACE=1` is enabled.
- The prefill chunk records start/embedding/layers/end samples, Q8 file-read deltas, and per-layer phase samples for attention norm/Q/K/RoPE/V, KV-cache write, attention context/output/residual, FFN norm/activation/down/residual.
- Forward and layer memory summaries include `peak_rss_delta_kib`, so prefill/first-token API timing output can show the RSS peak relative to that forward/layer start without post-processing absolute samples.
- The token-major output projection path uses a borrowed transposed weight view instead of cloning the output-weight tensor metadata/data before matmul, preserving the existing Q8/file-backed reader path while avoiding an avoidable dense clone on the logits hot path.
- This is instrumentation/hot-path cleanup for the performance/memory architecture lane only; it is not a row-support promotion or an 8B long-context PASS artifact.

Validation:

```bash
./scripts/with-rustup-cargo.sh test
./scripts/with-rustup-cargo.sh fmt --check
./scripts/with-rustup-cargo.sh clippy --all-targets -- -D warnings
./scripts/with-rustup-cargo.sh build --release --bin camelid
```

Result: all passed locally.

Additional local follow-up on `f91cd07` plus this lane patch:

```bash
./scripts/with-rustup-cargo.sh fmt --check
./scripts/with-rustup-cargo.sh test -q
./scripts/with-rustup-cargo.sh clippy -q --lib -- -D warnings
./scripts/with-rustup-cargo.sh build -q --release --bin camelid
bash scripts/check-public-scrub.sh
```

Result: passed locally (full `test -q`: 252 passed across test binaries).

Ubuntu follow-up validation:

- Approved validation target: private maintainer-only Ubuntu validation lane; SSH host/key details intentionally omitted from public notes.
- Isolated remote checkout base: `c4b51de7e7f7cc1bf16bd77ceded4589246b003e`.
- Applied patch SHA256: `cc30a2cdcae54ba02c2e82b86089ff7dc99dc834592719ab3ecb1a0cab111c42`.
- Remote work dir: scrubbed private temp checkout path.
- Remote gates passed: `fmt --check`, focused `chunked_prefill_matches_sequential_prefill_outputs_and_cache`, full `test -q --lib` (`106 passed` on Linux), `clippy -q --lib -- -D warnings`, and `build -q --release --bin camelid`.

Watchdog current-head spot-check:

- Clean public checkout: `ce48e934eec0de1183f2d46c421b1d542ca05f01`.
- Remote work dir: scrubbed private temp checkout path.
- Remote gates passed: `fmt --check`, focused `chunked_prefill_matches_sequential_prefill_outputs_and_cache`, focused `q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows`, `clippy -q --lib -- -D warnings`, and `build -q --release --bin camelid`.
- Local spot-check gates also passed on the same head: `fmt --check`, the same two focused tests, and `bash scripts/check-public-scrub.sh`.

Watchdog current-main follow-up after this note was committed:

- Clean public checkout: `5a2ad6bde50d3640f0e8d23c9fef3f9fc7942c2f`.
- Remote work dir: scrubbed private temp checkout path.
- Remote gates passed: `fmt --check`, focused `chunked_prefill_matches_sequential_prefill_outputs_and_cache`, focused `q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows`, `clippy -q --lib -- -D warnings`, and `build -q --release --bin camelid`.
- This remains a current-head architecture/code spot-check only; it is not an 8B 1024/2048-context support artifact.

Watchdog current-main follow-up after the spot-check note landed:

- Clean public checkout: `e90b9973d38afd8da8c016a3381e0215f766ee9a`.
- Remote work dir: scrubbed private temp checkout path.
- Local gates passed on the same head: `fmt --check`, focused `chunked_prefill_matches_sequential_prefill_outputs_and_cache`, focused `q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows`, and `bash scripts/check-public-scrub.sh`.
- Remote gates passed: `fmt --check`, focused `chunked_prefill_matches_sequential_prefill_outputs_and_cache`, focused `q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows`, `clippy -q --lib -- -D warnings`, and `build -q --release --bin camelid`.
- This remains a current-main architecture/code spot-check only; it is not an 8B 1024/2048-context support artifact.

Focused coverage:

- `chunked_prefill_matches_sequential_prefill_outputs_and_cache` compares chunked vs sequential prompt prefill for next-token output, logits, hidden state, KV-cache position, keys, and values.
- The same test now asserts chunked prefill emits structured memory timings and all expected per-layer phase samples under `CAMELID_FORWARD_RSS_TIMINGS=1`.
- `q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows` confirms a 3-row batched Q8_0 file-backed matmul reuses two weight chunk reads instead of rereading per input row while matching the existing Q8 block-dot output.

Claim boundary:

- This is code/runtime evidence for the backend architecture lane only.
- It is not a PASS artifact for Llama 3 8B 1024/2048 context.
- It is not broad Llama-family support, production throughput evidence, portability evidence, or a frontend/API support-status change.
- Any future 8B long-context status change still requires a fresh row-specific Ubuntu PASS artifact after the backend completes within the parity harness timeout.
