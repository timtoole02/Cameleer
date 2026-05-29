# cron-58d09b5e CI guard: local + Ubuntu Rustup PATH validation

## Target
Guard the Build/QA branch `buildqa/clippy-needless-range-loop-58d09b5e-20260518T2100Z` after the clippy/evidence privacy fixes, using local macOS gates plus fresh Ubuntu x86_64 validation.

## Feedback loop
- Local macOS: `cargo fmt --check`, `cargo check --all-targets --all-features`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test --all-targets --all-features`.
- Ubuntu x86_64: same gate set on `<ubuntu-worktree>`, with `PATH="$HOME/.cargo/bin:$PATH"` so the repo `rust-toolchain.toml` resolves to Rust/Cargo 1.95.0.

## Results
- Local gates passed on HEAD `7e4709ffbb737434f68035a39f07c5f1302c274d`.
- Ubuntu SSH succeeded using the requested identity/host, and final Ubuntu gates passed on HEAD `7e4709ffbb737434f68035a39f07c5f1302c274d` with `rustc 1.95.0` / `cargo 1.95.0`.
- Initial Ubuntu system PATH probe exposed `/usr/bin/cargo 1.75.0`, which cannot parse Cargo.lock v4 (`lock file version 4 requires -Znext-lockfile-bump`). This was not retained as the gate environment; the rustup PATH gate is the retained CI signal.

## Retain/reject
Retain: Build/QA branch remains green locally and on Ubuntu when using the repo toolchain. No support-contract, parity-envelope, or throughput claim is made.
