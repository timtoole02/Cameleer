# 2026-05-05 — Llama 3.2 1B Q8_0 2048-context instrumented trace

Scope: exact `llama32_1b_instruct_q8_0` row only; bounded `qa/prompt-packs/llama3-context-2048-smoke.json` on the canonical Ubuntu host.

Checkout/host: isolated temp checkout on the approved private Ubuntu validation lane from the local current `main` worktree with the Q8 read/cache instrumentation patch applied. The standing validation checkout was not used.

Local guardrail before remote:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh clippy --all-targets --all-features -- -D warnings`
- `./scripts/with-rustup-cargo.sh test --all-targets --all-features`
- targeted Q8/cache/chunked-prefill tests and `node scripts/test-run-llama3-prompt-pack.mjs`

Remote smoke before trace:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backing_cache_reuses_exact_chunk_reads --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows --lib`
- `./scripts/with-rustup-cargo.sh build --release`

Clean 2048-context reproduction (no dense diagnostics):

- Command artifact: `target/llama32-1b-context-2048-clean-repro-20260505T225933Z/pack/llama32-1b-q8-roughly-2048-token-recall/command.txt`
- Summary: `target/llama32-1b-context-2048-clean-repro-20260505T225933Z/pack/summary.json`
- Prompt-token parity: PASS (`1910` reference prompt tokens)
- Generated-token parity: FAIL at token index `0`
- Backend generated tokens/text: `[11, 11, 11, 315, 315]` / `",,, of of"`
- Reference generated tokens/text: `[34, 2735, 35, 12, 7854]` / `"CMLD-204"`
- First-token comparison: backend picks token `11` (`,`), reference picks token `34` (`C`); backend ranks token `34` at `1996` with logit `2.5268857` vs token `11` logit `6.4547954`.
- Q8 file-backed read stats (structured timings, RSS tracing enabled):
  - total generation: `24089` reads / `68,602,825,984` bytes, cache `0` hits / `0` bytes / capacity `0`
  - prefill: `22069` reads / `62,037,910,144` bytes, cache `0` hits / `0` bytes / capacity `0`
  - first generated token: `404` reads / `1,312,983,168` bytes, cache `0` hits / `0` bytes / capacity `0`
- `/usr/bin/time -v`: wall `5:42.04`, max RSS `2,930,036 KiB` (includes reference `llama-server`). Backend structured peak RSS: `550,248 KiB`, peak phase `layers.0.kv_cache_write_done`.

Dense output-projection trace:

- Command artifact: `target/llama32-1b-context-2048-dense-trace-20260505T225314Z/pack/llama32-1b-q8-roughly-2048-token-recall/command.txt`
- Summary: `target/llama32-1b-context-2048-dense-trace-20260505T225314Z/pack/summary.json`
- Prompt-token parity: PASS (`1910` reference prompt tokens)
- Generated-token parity: FAIL with the same backend/reference token sequence as the clean reproduction.
- Dense diagnostics present: yes; output projection diagnostics count `24`.
- Output projection reconstruction matched reported backend logits exactly for selected/reference/top diagnostic tokens (`absolute_delta = 0`), including token `11` and reference token `34`.
- Dense trace conclusion: the first-token red box is upstream of final output projection row decode/dot reconstruction. Next trace should compare backend-vs-llama.cpp layer checkpoints for the final prefill/first-token path, especially attention/KV state across chunked prefill; Q8 read/cache instrumentation now shows that the default path has no chunk cache hits and streams ~62 GB during prefill.

Claim boundary: this does **not** close the Llama 3.2 1B 2048-context parity box. It adds bounded Q8 read/cache telemetry and a prompt-pack dense-diagnostics switch, preserves local guardrails, and narrows the next correctness trace away from output projection math toward upstream layer/KV state.
