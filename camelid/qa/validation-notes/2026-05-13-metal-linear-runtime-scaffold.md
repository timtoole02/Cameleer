# Metal linear runtime scaffold — 2026-05-13

Status: code/runtime scaffold only. This note does **not** promote any model row, context bucket, production-throughput claim, portability claim, or frontend/API support state.

## What changed

- Added macOS Metal device discovery and startup logging for acceleration state.
- Added `camelid serve` runtime knobs for Rayon worker count, parallel-linear threshold, Apple Accelerate minimum matrix size, and an explicit opt-in `--metal-linear` / `CAMELID_METAL_LINEAR=1` switch.
- Added experimental macOS Metal dense `f32` descriptor and transposed linear-row kernels with reusable Metal buffers. They are disabled by default, exclude Q8_0/file-backed weights, and fall back to existing CPU/Accelerate paths when unavailable.
- Kept the existing Apple Accelerate default threshold at `262144` elements unless explicitly overridden.

## Validation artifacts

Local macOS validation on source head `9630e359bf858b108eab62791dec87a8d1c5ff7a` plus dirty runtime patch:

- `target/cron-0719640b-20260513T1827Z-tpm-metal-runtime-final-local/cargo-fmt.status` = `0`
- `target/cron-0719640b-20260513T1827Z-tpm-metal-runtime-final-local/cargo-test-all.status` = `0`
- `target/cron-0719640b-20260513T1827Z-tpm-metal-runtime-final-local/cargo-clippy.status` = `0`
- `target/cron-0719640b-20260513T1827Z-tpm-metal-runtime-final-local/cargo-test-all.log` includes passing macOS Metal descriptor and transposed kernel unit tests against this Mac's Metal device.

Canonical Ubuntu validation host (redacted SSH endpoint) on the same dirty patch:

- Remote artifact: `target/cron-0719640b-20260513T1827Z-tpm-metal-runtime-final-ubuntu/`
- `ssh-mkdir.status` = `0`
- `rsync.status` = `0`
- `ubuntu-rust-gates.status` = `0`
- Remote gate command covered `cargo fmt --all -- --check`, `cargo test metal::tests --all-targets` (non-macOS stub), `cargo test capabilities --all-targets`, and `cargo clippy --all-targets --all-features -- -D warnings`.

## Claim boundary

This closes only a guarded runtime-scaffold step. It does not change Llama 3.2 1B Instruct Q8_0 support beyond the already documented checked 512/1024/2048/4096 bounded packs, and it does not add model-native context, arbitrary-template, production-throughput, portability, frontend, or API promotion evidence.
