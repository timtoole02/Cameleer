# 2026-05-05 — Llama 3.2 1B Q8_0 2048-context KV-cache trace hook

Scope: exact `llama32_1b_instruct_q8_0` 2048-context parity blocker follow-up. This is instrumentation only; no support status changed.

Change added:

- Dense forward diagnostics now include a per-layer `kv_cache_trace` immediately after writing the current token K/V cache and before attention context reconstruction.
- The trace records `position_count`, KV layout dimensions, whole-layer weighted checksums/RMS/max-abs for keys and values, plus edge sampled position summaries (`key_first_values`, `value_first_values`, per-position checksum/RMS/max-abs).
- `scripts/extract-forward-trace.mjs` emits `layers.N.kv_cache_trace` stages before `layers.N.attention_trace`, so chunked-vs-sequential or backend-vs-reference trace comparisons can identify a KV-state divergence before attention probabilities/context.
- `scripts/check-forward-trace-invariants.mjs` validates the new KV trace shape/index/finite-number invariants, sampled position ordering, sample width bounds, and stage/trace layer alignment.

Local validation:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh clippy --lib -- -D warnings`
- `./scripts/with-rustup-cargo.sh clippy --all-targets --all-features -- -D warnings`
- `cargo test -q single_token_forward_diagnostics_follow_llama_stage_order --lib`
- `cargo test -q chunked_prefill_matches_sequential_prefill_outputs_and_cache --lib`
- `cargo test -q kv_cache --lib`
- `./scripts/with-rustup-cargo.sh test -q output_projection_diagnostics_support_q8_0_file_backed_token_major_rows --lib`
- `./scripts/with-rustup-cargo.sh test --all-targets --all-features -- --test-threads=1`
- `node --check scripts/extract-forward-trace.mjs`
- `node --check scripts/check-forward-trace-invariants.mjs`
- `node scripts/test-extract-forward-trace.mjs`
- `node scripts/test-check-forward-trace-invariants.mjs`
- `node scripts/test-compare-forward-traces.mjs`

The chunked-prefill unit now covers a longer seven-token prompt split into three prefill chunks, so the toy invariant exercises chunk boundaries before comparing logits, hidden state, and KV cache against sequential prefill.

Current evidence boundary:

- Prior output-projection diagnostics showed reconstructed Q8 output logits match reported backend logits for selected/reference/top tokens.
- This hook targets the next suspected region: final prompt-position state before output projection, especially attention/KV/chunked-prefill behavior.
- `llama32_1b_instruct_q8_0` at 2048 context remains red until a fresh row-specific PASS exists. 8B long-context remains red.
