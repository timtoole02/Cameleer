# 2026-05-08 — Q8 file-backed output-projection diagnostic guards

Scope: backend Q8_0 file-backed output-projection diagnostics only. This does not widen model support, API capabilities, frontend readiness, context support, or broader/full 8B claims.

Git/evidence posture:
- Started from clean `main` at `8a8f45d947adfaa8129f50b1cb834625b0230055` (`Promote exact 8B bounded 1024/2048 evidence`) matching `origin/main`.
- Latest committed bounded Llama 3 8B 1024/2048 evidence bundle is `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260508T040523Z-head-e203d3cf3ea5`; it was captured at `e203d3cf3ea5`, so this runtime/source change still requires fresh canonical PASS artifacts before any current-head 8B-green claim.
- No duplicate long Llama 3 8B run was launched for this structural guard slice.

Change:
- Fail Q8_0 file-backed output-projection diagnostics before any file read when the hidden width is not 32-value Q8 block aligned.
- Validate the lazy output row count and backing block count before reading token-row bytes, preventing malformed or mismatched file-backed diagnostic tensors from reading truncated/unrelated GGUF bytes.
- Added focused guards proving both malformed cases report a runtime-shape error with zero Q8 file-read calls/bytes.

Validation:
- `rustfmt --check src/inference.rs`: PASS
- `./scripts/with-rustup-cargo.sh test -q output_projection_diagnostics_reject_q8_0_file_backed_unaligned_rows_before_read --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q output_projection_diagnostics_reject_q8_0_file_backing_block_mismatch_before_read --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q output_projection_diagnostics_support_q8_0_file_backed_token_major_rows --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q output_projection_diagnostics_match_q8_0_file_backed_block_dot_probe --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q q8_file_cache --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q`: PASS
- `node scripts/check-public-evidence-claims.mjs`: PASS
- `node scripts/test-check-public-evidence-claims.mjs`: PASS
- `./scripts/with-rustup-cargo.sh clippy --all-targets -- -D warnings`: PASS
- `git diff --check`: PASS

Formatter note: the repository-wide `./scripts/with-rustup-cargo.sh fmt --all -- --check` currently reports unrelated pre-existing formatting diffs in `src/api/mod.rs` and `tests/api_vertical_slice.rs` from the starting head. This slice avoided broad support/API formatting churn and checked the touched Rust file directly.

Claim boundary: structural diagnostics/read-guard only. TinyLlama remains the current gate; Llama 3.2 1B/3B remain exact-row bounded through checked 2048 packs; Llama 3 8B remains exact-row bounded-pack support only where row-specific PASS artifacts and support-surface alignment exist.
