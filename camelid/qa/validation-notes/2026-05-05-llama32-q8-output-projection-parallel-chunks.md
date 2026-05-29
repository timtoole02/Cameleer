# Llama 3.2 Q8 output-projection chunking — 2026-05-05

Scope: runtime-only hardening for the exact Llama 3.2 1B/3B Q8_0 full-support memory/perf lane. This does not widen the public support claim and does not replace row-specific Ubuntu evidence.

Change:

- `matmul_rhs_transposed_q8_0_block_reader` now uses the same guarded `CAMELID_PARALLEL_LINEAR=on` / `CAMELID_PARALLEL_LINEAR_MIN_OUTPUTS` chunk-parallel row-dot path already used by file-backed per-row linear accumulation.
- The default remains unchanged because `CAMELID_PARALLEL_LINEAR` is opt-in.
- Each output row still uses the deterministic scalar Q8_0 encoded-row dot; parallelism only partitions independent output rows inside the already bounded file-reader chunk.

Why it closes a row+box sub-check:

- Llama 3.2 1B/3B already have bounded unique-chat RSS/perf evidence, but full support still needs stronger production-throughput work.
- This closes the code/runtime sub-box for optional chunk-parallel file-backed Q8_0 output projection, the hot final projection path that 1B/3B share with the larger Llama rows.
- Initial code evidence was local unit coverage only; the follow-up Ubuntu perf probe below adds small-sample runtime direction, but promotion-grade latency/RSS numbers still require the approved row-specific lane.

Validation:

```bash
cargo fmt --all -- --check
cargo test -q q8_0_block_reader_linear_matches_q8_path_with_parallel_chunks --lib
cargo test -q q8_0_block_reader --lib
cargo test -q q8_0_file_backed_accumulate_matches_q8_block_dot_across_chunks --lib
```

Result: all passed locally.

Ubuntu runtime perf probe:

- Host: approved Ubuntu validation lane; source archive copied from local `c1762a4` into an isolated temporary validation worktree; the standing remote checkout was not modified.
- Remote gates passed before measurement: `cargo fmt --all -- --check`, `cargo test -q q8_0_block_reader_linear_matches_q8_path_with_parallel_chunks --lib`, `cargo test -q q8_0_file_backed_accumulate_matches_q8_block_dot_across_chunks --lib`, and `cargo build --release`.
- Runtime command shape: `CAMELID_PARALLEL_LINEAR=<off|on> CAMELID_PARALLEL_LINEAR_MIN_OUTPUTS=1024 RAYON_NUM_THREADS=16 node scripts/bench-unique-chat.mjs --start-backend --model <gguf> --warmup 1 --repeats <1|2|3> --max-tokens 1`.
- Local artifact copy: `target/perf-c1762a4-20260505T1035Z/manifest.json` plus JSON run files, `model-SHA256SUMS`, and `SHA256SUMS`.

Small-sample first-token direction:

| exact model | repeats | generate off → on | layers off → on | logits off → on | FFN total off → on |
| --- | ---: | ---: | ---: | ---: | ---: |
| Llama 3.2 1B Q8_0 | 3 | 5854.67 → 5827.33 ms (-0.47%) | 5781.48 → 5760.46 ms (-0.36%) | 67.42 → 60.90 ms (-9.67%) | 4759.28 → 4732.08 ms (-0.57%) |
| Llama 3.2 3B Q8_0 | 2 | 17275.50 → 15460.50 ms (-10.51%) | 17160.68 → 15369.17 ms (-10.44%) | 105.99 → 82.39 ms (-22.27%) | 12823.02 → 11305.91 ms (-11.83%) |
| Llama 3 8B Q8_0 | 1 | 41265.00 → 38767.00 ms (-6.05%) | 41119.85 → 38633.46 ms (-6.05%) | 135.21 → 125.83 ms (-6.94%) | 33071.61 → 30751.89 ms (-7.01%) |

Interpretation: the opt-in chunk-parallel file-backed Q8 path is measurable on the target host, with the clearest win on 3B in this quick probe. 1B is essentially neutral at whole-token scale. 8B improves in a single-run directional check but remains dominated by FFN/layer work, so this is not support or portability evidence by itself.
