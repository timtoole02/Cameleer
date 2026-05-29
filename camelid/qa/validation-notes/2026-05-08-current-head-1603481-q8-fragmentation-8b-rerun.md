# Current-head Q8 file-reader fragmentation slice + Llama 3 8B bounded rerun — 1603481

Git runtime/source head: `160348118d44605fc13c2b50af0e73047a509305`

Public artifact root: `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260508T210500Z-head-160348118d44`

Canonical remote artifact root: `target/llama3-8b-context-1024-2048-current-head-20260508T210500Z-head-160348118d44`

Boundary: exact `llama3_8b_instruct_q8_0` bounded 1024/2048 prompt packs only. This does not promote model-native/larger context, arbitrary templates, neighboring rows, broad/full 8B or Llama-family support, portability, or production throughput.

Preflight:

- Local `main` started at `788838e77bff80d5e7cea8986d4f154fde6d3871` and `origin/main` matched.
- Canonical Ubuntu validation-host process scan found stale backend/Vite processes, but no active duplicate `run-llama3`, `chat-parity`, `prompt-pack`, or `llama-server` long 8B run on the validation lane before launching this run.

Change:

- Backend-only Q8_0 file-reader scheduling slice in `src/inference.rs`.
- When the default Q8 output scratch budget would fragment an otherwise whole-tensor file-backed Q8 read during multi-row prefill, the reader falls back to the existing no-scratch traversal. Explicit `CAMELID_Q8_0_FILE_READER_OUTPUT_SCRATCH_BYTES` overrides are preserved.
- Removed the unused `InferenceWorkspace` argument/allocation from the file-backed Q8 block-reader call path.
- Added a targeted unit guard for the default-scratch fragmentation fallback.
- Added a test-helper `#[allow(clippy::too_many_arguments)]` so `clippy --all-targets -D warnings` stays usable on the current toolchain.

Local gates before canonical run:

```text
./scripts/with-rustup-cargo.sh fmt --all -- --check
./scripts/with-rustup-cargo.sh test -q
./scripts/with-rustup-cargo.sh clippy --all-targets -- -D warnings
node scripts/check-public-evidence-claims.mjs
node scripts/test-check-public-evidence-claims.mjs
git diff --check
```

Targeted Q8 gates also passed:

```text
./scripts/with-rustup-cargo.sh test -q q8_file_reader_parallel_output_falls_back --lib
./scripts/with-rustup-cargo.sh test -q q8_file_reader_batch_chunk_rows_respect_output_scratch_budget --lib
./scripts/with-rustup-cargo.sh test -q q8_0_block_reader_linear --lib
./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib
./scripts/with-rustup-cargo.sh test -q q8_file_reader --lib
./scripts/with-rustup-cargo.sh test -q q8_file_cache --lib
```

Canonical 8B rerun:

- Exact model row: `meta-llama3-8b-q8` / `llama3_8b_instruct_q8_0`
- Model file: `Meta-Llama-3-8B-Instruct-Q8_0.gguf`
- Model SHA256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`

| Pack | Prompt tokens | Generated text | Wall time | Max RSS | Result |
| --- | ---: | --- | ---: | ---: | --- |
| 1024 | 881 | `CMLD-102` | `2:15.70` | 17,383,088 KiB | PASS |
| 2048 | 1910 | `CMLD-204` | `4:46.20` | 17,571,368 KiB | PASS |

Both rows matched prompt tokens, generated token IDs, and generated text against llama.cpp.
