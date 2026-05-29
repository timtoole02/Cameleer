# x86 Q8 FFN-down GEMM4 AVX2 default-off planner guard

CAMELID SLICE:
- Target: Ubuntu/Linux x86_64 Q8 execution plan feedback loop for the FFN-down GEMM4 AVX2 gate.
- Domain terms used: tracer bullet, feedback loop, Q8 projection route resolver, backend-owned packed runtime storage, retained slice.
- Feedback loop: `cargo test execution_plan::tests:: -- --nocapture`, with full CI-equivalent gates required before push.
- Files changed: `src/execution_plan.rs`, `src/inference.rs`; privacy-only scrubs in older frontend evidence bundles so public scrub can run green.
- Gate/env: Rust-native local planner tests; no support-contract or frontend claim widened.
- Baseline: origin branch already inserted `CAMELID_X86_Q8_FFN_DOWN_GEMM4_AVX2=off` into experimental env updates, but the regression assertions and stale-env cleanup loop did not cover that gate, and macOS clippy saw x86-only helpers as unused.
- Results: targeted execution-plan tests passed (13 planner tests); clippy blockers fixed by cfg-gating x86-only helpers.
- Retain/reject: retain as a feedback-loop hardening slice, not throughput evidence.
- Next tracer bullet: run same-host Ubuntu benchmark/parity before claiming AVX2 FFN-down performance impact.

Artifacts:
- `targeted-rust-gate.command.txt`
- `logs/targeted-rust-gate.log`
- `head.txt`
- `dirty-diff.stat`
- `dirty-diff.patch`
