# 2026-05-08 — Q8 file-cache partial decoded-scale reuse

Scope: backend Q8_0 file-backed cache/read-reuse micro-optimization only. This does not widen model support, API capabilities, frontend readiness, context support, or broader/full 8B claims.

Git/evidence posture:
- Started from `main` at `13e53aca43ad25c5aafa945a57353517ee3ccdc3` (`Scrub legacy backend branding`) matching `origin/main`.
- The working tree already contained unrelated unstaged frontend/API edits before this slice; this slice only touches `src/tensor/mod.rs` and this validation note.
- Latest committed bounded Llama 3 8B 1024/2048 PASS artifact found locally is `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260508T122749Z-head-9f8588bb4a4e`, captured at `9f8588bb4a4e787304d9b0a1b4d65351c3001bb1` with `passed=true` for exact checked 1024/2048 packs.
- Because current source HEAD is later than that artifact after this runtime change, do not call this HEAD Llama 3 8B green without fresh canonical PASS evidence.
- No canonical long 8B run was launched for this structural slice.

Change:
- `Q8_0FileBacking::read_exact_at_cached_with_q8_0_scales` now distinguishes whether decoded scales are already populated from whether those scales were fully/partially reused from cache.
- On cache misses with scale decoding requested, the lower-level read path decodes scales once into the caller buffer and inserts the same decoded scales into the Q8 file cache, avoiding a redundant caller-side decode/store pass.
- On block-aligned partial cache hits where cached decoded scales cover the overlap, only missing block scales are decoded; cached overlap scales are preserved and the call reports decoded-scale reuse.
- Added a focused guard proving a seeded two-block decoded-scale cache entry lets a later overlapping three-block read reuse the cached scale for the overlap, read only missing bytes, produce correct scales, and serve the same range as a full decoded-scale cache hit afterward.

Validation:
- `rustfmt --check src/tensor/mod.rs`: PASS
- `./scripts/with-rustup-cargo.sh test -q q8_file_cache_reuses_decoded_scales_on_partial_block_hits --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q q8_file_cache --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_reader --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q --lib`: PASS (`159 passed`)
- `./scripts/with-rustup-cargo.sh clippy --lib -- -D warnings`: PASS
- `./scripts/with-rustup-cargo.sh test -q`: PASS
- `node scripts/check-public-evidence-claims.mjs`: PASS
- `git diff --check`: PASS

Claim boundary: Q8 file-backed decoded-scale reuse/cache CPU work only. TinyLlama remains the current gate; Llama 3.2 1B/3B remain exact-row bounded through checked 2048 packs; Llama 3 8B remains exact-row bounded-pack support only where row-specific PASS artifacts and support-surface alignment exist.
