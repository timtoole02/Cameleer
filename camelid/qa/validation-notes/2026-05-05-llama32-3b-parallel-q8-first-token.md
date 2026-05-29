# 2026-05-05 — Llama 3.2 3B parallel Q8 first-token perf sub-box

Scope: exact `llama32_3b_instruct_q8_0` row only; opt-in parallel Q8 first-token runtime direction sub-box.

Green row+box:

- **Llama 3.2 3B Instruct Q8_0 → performance lane → opt-in parallel Q8 first-token runtime direction sub-box**.

Public evidence:

- `qa/evidence-bundles/llama32-3b-parallel-q8-first-token-20260505T140400Z-head-ffc22b85214f/manifest.json`
- `qa/evidence-bundles/llama32-3b-parallel-q8-first-token-20260505T140400Z-head-ffc22b85214f/SHA256SUMS`

Validation gates:

- `cargo fmt --all -- --check`
- `node --check scripts/bench-q8-hotpath-bundle.mjs`
- `node --check scripts/bench-unique-chat.mjs`
- `cargo test -q q8_0_block_reader_linear_matches_q8_path_with_parallel_chunks --lib`
- `cargo test -q q8_0_file_backed_accumulate_matches_q8_block_dot_across_chunks --lib`
- `cargo build --release`
- Public bundle checksum verification: `sha256sum -c SHA256SUMS`

Measured direction:

- `CAMELID_PARALLEL_LINEAR=off`: avg generate `13960 ms`, avg layers `13847.54 ms`, avg logits `105.95 ms`, avg FFN total `10326.48 ms`, max sampled backend RSS `283.57 MiB`.
- `CAMELID_PARALLEL_LINEAR=on`: avg generate `12200 ms`, avg layers `12110.67 ms`, avg logits `81.75 ms`, avg FFN total `8912.14 ms`, max sampled backend RSS `282.97 MiB`.
- Direction: generate `-12.61%`, layers `-12.54%`, logits `-22.84%`, FFN total `-13.7%`.

Claim boundary: this closes only the exact 3B opt-in parallel Q8 first-token runtime direction sub-box. It does **not** promote broad/full Llama-family support, neighboring rows, arbitrary/Jinja template support, model-native/larger context, production-throughput support, or portability.
