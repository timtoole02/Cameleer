# 2026-05-06 — Prefill chunk trace labels for long-context Q8 diagnostics

Scope: diagnostic/performance structural headroom only. This does not promote 8B 1024/2048 support and does not widen docs/API claims.

Change:

- `CAMELID_FORWARD_MEMORY_TRACE=1` layer prefill phase labels now include chunk-local context:
  - `chunk_start`
  - `rows`
  - `base` KV-cache position
- Example phase shape: `layer_0_prefill_chunk_start_128_rows_128_base_128_attention_q_done`.

Why:

- Long-context 8B lazy Q8 traces repeat the same layer/phase labels across chunked prefill, making timeout-era stderr difficult to interpret without a completed structured report.
- The first 8B/1024 diagnostic on head `4c30c53` immediately showed repeated `layer_0_prefill_*` phases with cumulative Q8 read bytes but no chunk identity. This label-only change keeps the stderr artifact self-contained.

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`

Claim boundary: diagnostics only. 8B 1024/2048 remain red/timeout-blocked until fresh PASS artifacts exist.
