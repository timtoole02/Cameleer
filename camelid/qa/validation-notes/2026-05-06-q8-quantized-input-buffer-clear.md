# 2026-05-06 — Q8 quantized-input scratch clear

Scope: backend/runtime hygiene only. This does not promote 8B 1024/2048 support, does not change compatibility rows, and does not widen docs/API/frontend claims.

Starting state:

- Current local `main` at start of this slice: `64a0173` (`Reuse Q8 quantized input buffer`).
- Remote checked before edits: `origin` uses `https://github.com/timtoole02/Camelid.git` for fetch/push; no stale SSH host or alternate remote was used.

Change:

- Clear the file-backed Q8 reader's thread-local quantized-input `Vec<Q8_0Block>` after each helper use.
- Preserve the retained allocation capacity so the prior allocation-reuse behavior stays intact.
- Add a unit assertion that the next helper borrow starts with an empty logical buffer while retaining capacity from the prior quantization.

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_reader_quantized_input_buffer_reuses_capacity --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`

Claim boundary: performance/hygiene-only. Exact supported generation remains TinyLlama Q8 gate, Llama 3.2 1B/3B Q8_0 bounded 2048, and Llama 3 8B Q8_0 bounded 512; 8B 1024/2048 remain red until fresh PASS artifacts and synchronized docs/API/frontend alignment land.
