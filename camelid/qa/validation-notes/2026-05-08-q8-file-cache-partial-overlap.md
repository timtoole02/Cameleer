# 2026-05-08 — Q8 file-cache partial-overlap reuse

Scope: backend Q8_0 file-backed cache/read-reuse guard only. This does not widen model support, API capabilities, frontend readiness, context support, or broader/full 8B claims.

Git/evidence posture:
- Started from `main` at `adc1a47cf339d6e364cc1d400b6218432dec844a` (`Coalesce near-two-chunk Q8 reader bursts`) matching `origin/main`.
- Latest committed bounded 8B artifact found remains `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T194559Z-head-ab8e465b50c3`; it predates later runtime/source commits, so this source head still needs fresh canonical PASS artifacts before any current-head Llama 3 8B green claim.
- Local and canonical Ubuntu process scans found stale frontend/backend serves and an already-active Llama 3 8B broader prompt-pack run on the canonical host. No duplicate long 8B run was launched for this slice.

Change:
- `Q8_0FileBacking::read_exact_at_cached` now reuses cached overlap bytes and reads only missing gaps before reinserting the assembled contiguous range.
- Partial cache reads record both hit bytes and miss bytes, preserving full-cache-hit behavior as a zero-file-read path and keeping cache disabled by default.
- Added a focused file-backed test proving a seeded `[0, 8)` cache entry lets a later `[4, 20)` read reuse 4 cached bytes, read only 12 bytes from disk, then serve the same 16-byte span entirely from cache.
- Kept lazy/file-backed Q8 block-dot behind reader-specific `CAMELID_Q8_0_FILE_READER_BLOCK_DOT`, separate from the broader `CAMELID_Q8_0_BLOCK_DOT` diagnostic flag.

Validation:
- `./scripts/with-rustup-cargo.sh fmt --all -- --check`: PASS
- `./scripts/with-rustup-cargo.sh test q8_file_cache_file_read_reuses_partial_overlap_and_reads_gaps --lib -- --nocapture`: PASS
- `./scripts/with-rustup-cargo.sh test q8_file_cache --lib -- --nocapture`: PASS
- `./scripts/with-rustup-cargo.sh test q8_0_file_backed --lib -- --nocapture`: PASS
- `./scripts/with-rustup-cargo.sh test q8_0_file_reader --lib -- --nocapture`: PASS
- `./scripts/with-rustup-cargo.sh clippy --all-targets -- -D warnings`: PASS
- `./scripts/with-rustup-cargo.sh test`: PASS
- `node scripts/test-check-public-evidence-claims.mjs`: PASS
- `node scripts/check-public-evidence-claims.mjs`: PASS
- `git diff --check`: PASS

Claim boundary: Q8 file-backed read reuse/cache instrumentation only. This is not an 8B support promotion and does not make current HEAD 8B-green without a fresh canonical PASS artifact and support-surface alignment.
