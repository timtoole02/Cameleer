# cron-95495a91 backend tracer: ffn gate-up single-owner env guard

## Target
Sharpen the Ubuntu/Linux x86_64 Q8 execution-plan feedback loop for active Q8 performance/parity lanes by preventing stale FFN gate-up single-owner env state from leaking into a retained/rejected run.

## Hypotheses
1. `CAMELID_X86_Q8_FFN_GATE_UP_SINGLE_OWNER` is consumed by the Rust runtime but was not managed by the execution planner, so a stale shell env could accidentally activate it outside the current retained baseline envelope.
2. Adding it to managed planner keys and explicitly setting it `off` in the x86 experimental baseline keeps the slice default-off without widening support claims.
3. The existing execution-plan tests plus the gate-up owner default-off test are enough feedback loop for this control-plane guard; no throughput retain claim is made.

## Change
- `src/execution_plan.rs`
  - Added `CAMELID_X86_Q8_FFN_GATE_UP_SINGLE_OWNER` to `MANAGED_ENV_KEYS`.
  - The x86 experimental AVX2 plan now explicitly writes it as `off` with the other default-off Q8 consumer experiments.
  - Tests now assert the env is cleared/applied and reset between cases; also filled missing GEMM4 env cleanup in the fixture helper.

## Gates
- Local: `cargo fmt --check && cargo test execution_plan --lib` — pass.
- Local: `cargo test q8_ffn_gate_up_single_owner_is_default_off_and_requires_runtime_storage --lib` — pass.
- Ubuntu access: SSH worked with the requested exact shape. Host Rust toolchain is `rustc 1.75.0` / `cargo 1.75.0`, below repo `rust-version = 1.87`, so Rust gates were not run on Ubuntu without changing the host toolchain.

## Retain/reject
Retain as a default-off backend control-plane guard. This is parity/performance-lane hygiene only: it prevents accidental gate leakage and does not claim throughput, parity-envelope expansion, frontend/API support, or public support widening.
