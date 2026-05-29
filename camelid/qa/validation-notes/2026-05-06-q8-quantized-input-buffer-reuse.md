# 2026-05-06 — Q8 quantized-input buffer reuse

Scope: backend/runtime structural headroom only. This does not promote 8B 1024/2048 support, does not change compatibility rows, and does not widen docs/API/frontend claims.

Starting state:

- Current local `main` at start of this slice: `4d661ae` (`Document layer-major attribution knob`).
- No duplicate long 8B validation run was started in this slice; work stayed local and bounded to code/tests plus this blocker note.

Change:

- Reused the file-backed Q8 reader's quantized-input `Vec<Q8_0Block>` through a thread-local buffer.
- The multi-row lazy-Q8 block-reader path now quantizes prompt rows into that reusable buffer instead of allocating a fresh vector for every file-backed Q8 matmul.
- The borrowed single-row file-backed Q8 path uses the same reusable buffer for the activation row.
- This keeps Q8 file bytes read, cache policy, scale decode, dot products, output layout, and support status unchanged; it removes avoidable allocator pressure from the same hot path exercised by attention/FFN/output projection.

Hypothesis evidence:

- Current source-`f8c2d66` 8B/2048 no-cache diagnostic evidence copied at `target/remote-llama3-8b-context-2048-f8c2d66-20260506T061807Z/` measured `q8_file_read_bytes=151109769728` (`144109.51 MiB`) with cache hit bytes `0` and backend RSS trace around `1415552 KiB` at logits for the 1910-token prompt.
- The read-only 8B/2048 320 MiB cache audit on the canonical Ubuntu lane measured physical Q8 file reads dropping to `47285433088` bytes (`45094.90 MiB`) while serving `103824336640` bytes (`99014.60 MiB`) from cache and raising logits-time RSS to about `1997468 KiB`; remote checksums are recorded in `qa/validation-notes/2026-05-06-q8-scale-buffer-reuse-and-8b-2048-chain.md`.
- That refines Tim's working hypothesis for current main: with chunked/batched reuse, measured 8B/2048 traffic is in the high-100-GiB logical Q8 class rather than a fresh 400+ GiB physical-read result; bounded cache can materially lower physical I/O, but only by carrying visible RAM/cache-residency cost. Retained Q8 blocks push the same tradeoff further toward lower file I/O and heavier resident Q8 payload.

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_reader_quantized_input_buffer_reuses_capacity --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`
- `./scripts/with-rustup-cargo.sh clippy -q --all-targets -- -D warnings`
- `./scripts/with-rustup-cargo.sh test -q`
- `bash scripts/check-public-scrub.sh`
- `./scripts/with-rustup-cargo.sh build -q --release --bin camelid`

Claim boundary: performance/diagnostic-only. Exact supported generation remains TinyLlama, Llama 3.2 1B/3B bounded 2048, and Llama 3 8B bounded 512; 8B 1024/2048 remain red/diagnostic until current-head artifacts are reviewed and support surfaces are deliberately aligned.
