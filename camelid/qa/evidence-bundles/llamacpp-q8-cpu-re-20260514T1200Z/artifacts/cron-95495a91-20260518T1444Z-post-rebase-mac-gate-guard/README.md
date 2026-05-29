# Post-rebase Mac gate guard evidence

Tracer: preserve the retained default-off token-major output runtime repack route after rebasing onto newer Q8/frontend commits.

Change: narrow x86-only AVX2/single-owner tests behind x86 cfg and keep the shared FFN gate/up plan helper available to Mac-only tests. This does not widen support claims or enable any Q8 runtime path by default.

Retain/reject: retained as a Rust-native gate hygiene fix required for green Mac gates after the output.weight repack slice.

Gates (Mac worktree at HEAD plus this patch):
- cargo fmt --check: pass
- cargo test q8_runtime_repack -- --nocapture: pass
- cargo test q8_repack -- --nocapture: pass
- cargo test --lib -- --nocapture: pass (273 passed)

Limits: no throughput evidence, no same-host parity claim, no frontend/API support change, no default-on behavior.
