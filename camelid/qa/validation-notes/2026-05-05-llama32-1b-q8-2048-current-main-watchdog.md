# 2026-05-05 — Llama 3.2 1B Q8_0 2048-context current-main watchdog rerun

Scope: exact `llama32_1b_instruct_q8_0` row only; bounded `qa/prompt-packs/llama3-context-2048-smoke.json` on the canonical Ubuntu host.

Checkout/host: clean isolated temp checkout on the approved private Ubuntu validation lane from local `main` head `7efa98bd6b3e7b4468177b0ff5aca1dd1634bc67`. The standing validation checkout was inspected first and left untouched because it is stale and dirty.

Local guardrail before remote:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh clippy --all-targets --all-features -- -D warnings`
- `./scripts/with-rustup-cargo.sh test --all-targets --all-features`
- targeted Q8/output-projection/forward-trace tests plus `node scripts/test-run-llama3-prompt-pack.mjs`

Remote guardrail before repro:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backing_cache_reuses_exact_chunk_reads --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows --lib`
- `./scripts/with-rustup-cargo.sh test -q output_projection --lib`
- `node scripts/test-extract-forward-trace.mjs`
- `node scripts/test-compare-forward-traces.mjs`
- `./scripts/with-rustup-cargo.sh build --release`

Current-main 2048-context blocker confirmation:

- Artifact dir: `target/current-main-llama32-1b-2048-watchdog-20260505T231735Z/`
- Report: `target/current-main-llama32-1b-2048-watchdog-20260505T231735Z/pack/llama32-1b-q8-watchdog-roughly-2048-token-recall/report.json`
- Summary: `target/current-main-llama32-1b-2048-watchdog-20260505T231735Z/pack/summary.json`
- Prompt-token parity: PASS (`1910` reference prompt tokens)
- Generated-token/text parity: FAIL at generated token index `0`
- Backend generated tokens/text: `[11, 11, 11, 315, 315]` / `",,, of of"`
- Reference generated tokens/text: `[34, 2735, 35, 12, 7854]` / `"CMLD-204"`
- First-token comparison: backend picks token `11` (`,`) while llama.cpp picks token `34` (`C`); backend ranks token `34` at `1996`, with backend logit `6.4547954` for token `11` vs `2.5268857` for token `34`.
- Q8 file-backed read stats with `CAMELID_FORWARD_RSS_TIMINGS=on` and default Q8 cache capacity `0`:
  - total generation: `24089` reads / `68,602,825,984` bytes, cache `0` hits / `0` bytes / capacity `0`
  - prefill: `22069` reads / `62,037,910,144` bytes, cache `0` hits / `0` bytes / capacity `0`
  - first generated token: `404` reads / `1,312,983,168` bytes, cache `0` hits / `0` bytes / capacity `0`
- `/usr/bin/time -v` for the prompt-pack command: wall `5:46.11`, max RSS `2,929,772 KiB` including the reference `llama-server`; backend structured peak RSS `605,464 KiB`, peak phase `layers.0.kv_cache_write_done`.

Claim boundary: this is a red-box confirmation only. It does **not** close the Llama 3.2 1B 2048-context parity box, does not promote 8B long-context, and does not widen broad Llama-family support. It preserves the current path forward: keep 1B/2048 first-token divergence primary, continue upstream layer/KV correctness tracing and structural Q8 I/O/read-reduction work, and require a fresh row-specific PASS before changing any green row/box.
