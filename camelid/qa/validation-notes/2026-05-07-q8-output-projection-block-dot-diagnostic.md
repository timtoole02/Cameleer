# Q8 output projection block-dot diagnostic alignment — 2026-05-07

Head before this slice: `ac1e2a3cba16351533dc20be5df35e1707550cd2` (`Exercise opt-in Q8 file reader block dot`) on local `main`, matching `origin/main`.

## Scope

Structural Q8/file-backed output-projection diagnostic alignment only. This does not add a new config flag, does not change the default dequantized-f32 parity path, does not widen support rows, and does not refresh or claim current-head Llama 3 8B green evidence.

Existing evidence check: the latest committed bounded Llama 3 8B 1024/2048 artifact visible locally is `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T194559Z-head-ab8e465b50c3`, which predates current `ac1e2a3` runtime/source changes. No duplicate long 8B run was launched in this slice.

## Change

`output_projection_q8_0_reconstructed_logit` now mirrors the existing opt-in `CAMELID_Q8_0_BLOCK_DOT` probe when reconstructing a Q8_0 file-backed output row for diagnostics:

- default/unset flag: unchanged decoded Q8 row × f32 input reconstruction;
- opt-in flag enabled: quantize the output-norm row once and reconstruct with encoded Q8 row × quantized-input block dot, matching the file-reader runtime probe.

This keeps the known-good default path stable while making diagnostic `q8_direct_reconstructed_logit` line up with the existing opt-in Q8 block-dot output-projection hot path.

## Validation

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q output_projection_diagnostics_match_q8_0_file_backed_block_dot_probe --lib`
- `./scripts/with-rustup-cargo.sh test -q output_projection_diagnostics_support_q8_0_file_backed_token_major_rows --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_file_reader --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_file_cache --lib`
- `./scripts/with-rustup-cargo.sh test -q`
- `git diff --check`

All passed locally.

## Boundary

A broader/default-on file-reader block-dot experiment was not committed: making the file-reader block-dot path default changed existing Q8 file-backed parity expectations by small numeric deltas in local targeted tests. The committed change remains strictly behind the existing opt-in probe and only aligns diagnostics under that probe.
