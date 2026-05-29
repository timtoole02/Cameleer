# Output token-major Q8 runtime route guard

- Target: default-off backend-owned packed runtime storage route for `output.weight`, preserving token-major output projection shape without broad support claims.
- Domain terms: tracer bullet, feedback loop, backend-owned packed runtime storage, Q8 projection route resolver, retained slice.
- Baseline SHA: 1dd576a71171
- Change: factor `q8_repack_tensor_enabled_for_flags`; include `output.weight` in default-off Mac runtime repack family; add Rust unit feedback loop for default-off/family scope and token-major output route shape.
- Public/support claims: none widened.

## Gates

```sh
cargo fmt --check
cargo test q8_runtime_repack -- --nocapture
cargo test q8_repack -- --nocapture
cargo test --lib -- --nocapture
```

## Results

- `cargo fmt --check`: PASS
- `cargo test q8_runtime_repack -- --nocapture`: PASS, 2 tests passed.
- `cargo test q8_repack -- --nocapture`: PASS, includes 5 tensor_store q8_repack tests passed.
- `cargo test --lib -- --nocapture`: PASS, 286 tests passed.
- Warnings: incremental hard-link copy warning only; no test failures.

## Retain/reject

Retain as a safe Rust-native default-off route/feedback-loop slice. This is not throughput, same-host parity, frontend/API support, or default-on evidence.
