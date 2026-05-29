# 2026-05-06 — Q8 scale-buffer reuse and 8B 2048 diagnostic chain

Scope: diagnostic/performance structural headroom only. This does not promote 8B 1024/2048 support and does not widen docs/API claims.

Change:

- Reused the file-backed Q8 row-chunk scale decode buffer with a thread-local `Vec<f32>`, mirroring the existing row-byte chunk reuse.
- This removes a per-matmul allocation in both the batch block-reader path and the borrowed single-row file-reader path while keeping the same Q8 bytes, scales, dot products, cache policy, and output layout.
- Follow-up local test hardening serializes test-only Q8 file-read/cache state assertions with a reentrant guard so global Q8 counters/cache/env-sensitive tests remain deterministic after the wide Q8 file-backed reader became parallel-capable. This guard is `#[cfg(test)]` only and does not change release runtime behavior.

Remote diagnostics:

- The canonical Ubuntu validation lane produced a diagnostic 8B 1024 compact-context parity PASS from a sanitized diagnostic worktree at source head `4c30c53`:
  - artifact copied locally: `target/remote-llama3-8b-context-1024-4c30c53-20260506T051812Z/`
  - prompt/generated parity: `prompt_tokens_all_match=true`, `generated_tokens_all_match=true`, `generated_text_all_match=true`
  - reference prompt tokens: 881
  - lazy Q8, prefill chunk 128, Q8 file cache disabled
  - backend trace final: `q8_file_read_bytes=91781055744` (`87529.24 MiB`), cache hit bytes 0, backend RSS trace ~890068 KiB at logits
  - local copied-artifact SHA256s:
    - `summary.json`: `18ab757f10d582f33dfbf4ce0f516048b15b0ac1ae8b24f511b81d597810d30b`
    - `run.env.txt`: `453f2dc1d9473d237f27b58baa569561b7089d025020081a214397444a74c303`
    - `backend-tail.log`: `f7101cad680b8fcd5051dbc4275a9c384b92e45b439072a528b66b9be0d0b729`
    - `pack.stdout.log`: `696b2e7d1b966d87c09807e488cbe458af2de977c8718d4bf49bf7ad8105a217`
    - `pack.stderr.log`: `67e9b8c7e7b3044bed43a69c98ec0bab3abdb4c932dd298e67399c4166c58ab8`
- The source-`f8c2d66` 8B 2048 no-cache diagnostic completed on the canonical Ubuntu validation lane from a sanitized archived worktree:
  - sanitized remote artifact root: `target/llama3-8b-context-2048-diag-20260506T061807Z-source-f8c2d66/` inside the archived validation worktree
  - copied local summary/tails: `target/remote-llama3-8b-context-2048-f8c2d66-20260506T061807Z/`
  - prompt/generated parity: `prompt_tokens_match=true`, `generated_tokens_match=true`, `generated_text_match=true`
  - generated token IDs: Camelid `[34,2735,35,12,7854]`; llama.cpp `[34,2735,35,12,7854]`
  - env: lazy Q8 on, retained Q8 blocks off, chunk tokens 128, Q8 file cache bytes 0
  - backend trace final: `q8_file_read_bytes=151109769728` (`144109.51 MiB`), cache hit bytes 0, backend RSS trace ~1415552 KiB at logits
  - local copied-artifact SHA256s:
    - `summary.json`: `ae3781e6fcbb782d4f85ad9221fc07403666bdcbe3ceae9008d8643404a16a2b`
    - `run.env.txt`: `355b5ecc263a1fe11778f8a3737d5e4111cacfd6224a829d17ec6aa03911216b`
    - `backend-tail.log`: `ef68a0662d5919c495ec0b34a644570dc3be4a0bc96abd2fde339dac842c56a1`
    - `pack.stdout.log`: `9301fa14eeccd6dccfdb1909b7c770552582a7a7a51deb73846351b249197325`
    - `pack.stderr.log`: `1a7b59e9bd7f28692be0785874ab37d778003760c6e8998aebb62bb0de81c7b7`
- Read-only follow-up audit of the source-`f8c2d66` 8B 2048 cache hypothesis run on the canonical Ubuntu validation lane; no duplicate long run was started:
  - sanitized remote artifact root: `target/llama3-8b-context-2048-cache320m-diag-20260506T073251Z-source-f8c2d66/` inside the archived validation worktree
  - env delta: `CAMELID_Q8_0_FILE_CACHE_BYTES=335544320` (320 MiB)
  - prompt/generated parity remained diagnostic PASS for the same 1910-token prompt (`prompt_tokens_match=true`, `generated_tokens_match=true`, `generated_text_match=true`)
  - backend trace final: `q8_file_read_bytes=47285433088` (`45094.90 MiB`) plus `q8_file_cache_hit_bytes=103824336640` (`99014.60 MiB`) with cache residency `323292672` bytes (`308.32 MiB`) and RSS trace `1997468 KiB` at logits
  - compared with the no-cache source-`f8c2d66` diagnostic above, the 320 MiB cache reduced physical Q8 file reads from `151109769728` bytes to `47285433088` bytes, while cache-hit telemetry accounts for another `103824336640` bytes served from RAM; RSS at logits increased from ~`1415552 KiB` to ~`1997468 KiB`
  - this refines the working hypothesis: current lazy Q8 with chunked/batched reuse is measured here in the high-100-GiB logical Q8 traffic class rather than a fresh 400+ GiB physical-read result, and bounded cache reuse can materially lower file I/O only by carrying a visible RSS/cache-residency cost. Retained Q8 blocks would push that tradeoff further toward lower file I/O and heavier resident Q8 payload.
  - remote SHA256s captured during audit: `pack/summary.json` `0a489a0c7af130d6aa6b01ebeeb611efb21808533fec331899044b39af7a099c`; `run.env.txt` `55254922889e8ece794bc246e9aa5cee213f0dd073b247a160ab8b99f2699a7c`; `backend.log` `0b09eb92b693bce93b74a68249b603aa8105f1aeaa82603b8f3f9f378a385d05`; `pack.stdout.log` `72a88069cbe9892ece7c83c9ff18685c044bd417472442fdf47ec3a9af5da25e`; `pack.stderr.log` `9b451bbc27009ca08257d421f06b6a0bad60d3f46fe8d7478b2dbb05e2b959e8`

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_accumulate_matches_q8_block_dot_across_chunks --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_file_cache --lib`
- `./scripts/with-rustup-cargo.sh test -q prefill --lib`
- `./scripts/with-rustup-cargo.sh clippy -q --all-targets -- -D warnings`
- Overnight current-main audit at `981b21b` (`Coalesce overlapping Q8 file cache chunks`):
  - `cargo fmt --check`
  - `cargo test q8_file_cache -- --nocapture` (4 passed)
  - `cargo test q8_0_file_backing_cache -- --nocapture` (1 passed)
  - `cargo test q8_0_block_reader_linear -- --nocapture` (2 passed)
  - `cargo test` (all local tests/doc-tests passed)

Claim boundary: performance-only. 8B 1024/2048 have diagnostic row-specific PASS artifacts above, but remain blocked from support-promotion/docs/API widening until current-head artifacts are reviewed and docs/API/frontend are explicitly aligned.
