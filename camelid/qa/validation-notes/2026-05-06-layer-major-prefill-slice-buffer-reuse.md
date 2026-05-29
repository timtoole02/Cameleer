# 2026-05-06 — Layer-major prefill row-slice buffer reuse

Scope: diagnostic/performance structural headroom only. This does not promote 8B 1024/2048 support and does not widen docs/API claims.

Change:

- Layer-major prefill now reuses a per-layer chunk input `Vec<f32>` while slicing hidden rows for each chunk.
- This removes repeated fresh allocation from `tensor_row_slice(...).to_vec()` in the long-context chunk loop while keeping the owned `CpuTensor` interface used by the existing layer code.
- The chunk still copies rows by design; this is a low-risk allocation-reuse step, not a borrowed-view API change.

Why:

- 8B 1024/2048 diagnostic traces spend most time in Q8 file-backed matmuls, but the layer-major loop also performs repeated large row-slice materializations across every layer/chunk.
- Reusing the chunk buffer is a small structural cleanup that reduces allocator churn without changing tensor math, cache policy, or support status.

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q prefill --lib`
- `./scripts/with-rustup-cargo.sh test -q`
- `./scripts/with-rustup-cargo.sh clippy -q --all-targets -- -D warnings`
- `bash scripts/check-public-scrub.sh`
- `./scripts/with-rustup-cargo.sh build -q --release --bin camelid`

Claim boundary: performance-only. 8B 1024/2048 remain red/timeout-blocked until fresh PASS artifacts exist.
