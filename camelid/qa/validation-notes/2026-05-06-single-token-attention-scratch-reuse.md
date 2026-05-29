# 2026-05-06 — Single-token attention score scratch reuse

Scope: diagnostic/performance structural headroom only. This does not promote 8B context support and does not widen docs/API/frontend claims.

Change:

- The single-token causal attention context path now reuses the existing per-head attention softmax scratch helper instead of allocating separate raw-score and probability vectors for every attention head.
- This aligns the decode/final-token attention path with the batched prefill attention helper that already reuses a score buffer while keeping the same GQA mapping, score scaling, softmax validation, output layout, and diagnostic trace behavior.
- Diagnostic traces still compute their sampled/reconstructed attention evidence separately when requested; this patch only removes avoidable allocation from the non-trace context computation.

Why:

- The 8B long-context performance lane is dominated by Q8 file-backed matmuls, but attention/prefill remains an explicit structural headroom target.
- Avoiding per-head probability-vector materialization is a low-risk cleanup for first-token/decode attention and the final prompt token after chunked prefill.

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q causal_attention_context --lib`
- `./scripts/with-rustup-cargo.sh test -q attention_context --lib`
- `./scripts/with-rustup-cargo.sh test -q prefill --lib`
- `./scripts/with-rustup-cargo.sh test -q`
- `./scripts/with-rustup-cargo.sh clippy -q --lib -- -D warnings`
- `./scripts/with-rustup-cargo.sh clippy -q --all-targets -- -D warnings`
- `bash scripts/check-public-scrub.sh`
- `./scripts/with-rustup-cargo.sh build -q --release --bin camelid`

Result: all passed locally.

Claim boundary: performance-only. Exact support remains bounded by existing row-specific PASS artifacts; broader/full 8B support still needs reviewed row-specific performance, portability, and docs/API/frontend alignment artifacts.
