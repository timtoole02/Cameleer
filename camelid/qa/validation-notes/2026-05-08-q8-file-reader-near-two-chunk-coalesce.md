# 2026-05-08 — Q8 file-reader near-two-chunk coalescing

Scope: backend Q8_0 file-backed read-call/perf guard only. This does not widen model support, API capabilities, frontend readiness, context support, or broader/full 8B claims.

Git/evidence posture:
- Started from clean `main` at `051bebf01307` (`Align q8 output projection diagnostics`) matching `origin/main`.
- Local process scan found only stale frontend/headless-browser work and no long Llama 3 8B run.
- Canonical Ubuntu validation-host scan found stale backend/frontend serves and active Qwen2.5/Mixtral/Gemma Q8 hotpath benches, but no active Llama 3 8B long-context pack. No duplicate long 8B run was launched.
- Latest committed bounded 8B artifact remains `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T194559Z-head-ab8e465b50c3`; it predates later runtime/source commits, so this source head still needs fresh canonical PASS artifacts before any current-head 8B green claim.

Change:
- Coalesced Q8_0 file-reader chunks only when a tensor fits under two configured chunk budgets, preserving exact values and keeping the global Q8 file cache opt-in/disabled by default.
- Added a synthetic 8B-shape guard showing default chunking reads Llama 3 8B Q8 FFN gate/up (`4096 -> 14336`) and down (`14336 -> 4096`) tensor shapes as one bounded burst instead of two read phases.
- Added a file-backed read-count guard proving a near-two-chunk Q8 tensor now reads once with cache disabled while matching the existing dequantized Q8 path.

Validation:
- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test q8_file_reader_default_coalesces_llama3_8b_ffn_q8_shapes --lib -- --nocapture`
- `./scripts/with-rustup-cargo.sh test q8_0_file_backed --lib -- --nocapture`
- `./scripts/with-rustup-cargo.sh test`
- `./scripts/with-rustup-cargo.sh clippy --all-targets -- -D warnings`

Claim boundary: read-call/perf guard only. TinyLlama remains the live gate; Llama 3.2 1B/3B remain exact-row bounded through checked 2048 packs; Llama 3 8B remains exact-row bounded-pack support only where row-specific PASS artifacts and support-surface alignment exist. This source head needs fresh canonical PASS artifacts before any current-head green claim.
