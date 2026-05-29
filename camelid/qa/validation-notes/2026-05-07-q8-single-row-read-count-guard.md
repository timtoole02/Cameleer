# 2026-05-07 — Q8 single-row file-reader read-count guard

Scope: backend/runtime test guard only. This does not widen model support, API capabilities, frontend readiness, context support, or broader/full 8B claims.

Git/evidence posture:
- Started from clean `main` at `f794b06` (`Scrub validation note host details`) matching `origin/main`.
- Canonical Ubuntu check found an already-completed Llama 3 8B 1024/2048 run workspace at `Camelid-current-head-8b-1024-2048-20260507T1357Z-head-72fccb3e95b9`; `run.log` showed both bounded packs passed, but that was for head `72fccb3e95b9`, not this new source head.
- The same workspace left a stale `camelid serve --addr 127.0.0.1:8391` process consuming CPU with no active pack client; after confirming its cwd matched that completed run workspace, it was stopped cleanly. A stale self-matching 8B diagnostic waiter was also stopped. No duplicate long 8B run was launched during this patch.

Change:
- Extended the single-row file-backed Q8_0 accumulate test to assert exact chunked read count and bytes with the file cache disabled.
- The guard proves the low-I/O single-row path reads each configured file-backed chunk once while preserving the existing output parity check.

Validation:
- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test q8_0_file_backed_accumulate_matches_q8_block_dot_across_chunks -- --nocapture`
- `./scripts/with-rustup-cargo.sh test q8_0_file_backed -- --nocapture`
- `node scripts/check-public-evidence-claims.mjs && node scripts/test-check-public-evidence-claims.mjs`
- `./scripts/check-public-scrub.sh`
- `./scripts/with-rustup-cargo.sh clippy --all-targets -- -D warnings`
- `./scripts/with-rustup-cargo.sh test`

Claim boundary: test guard only. TinyLlama remains the live gate; Llama 3.2 1B/3B remain exact-row bounded through checked 2048 packs; Llama 3 8B remains exact-row bounded-pack support only where row-specific PASS artifacts and support-surface alignment exist. This source head needs fresh canonical PASS artifacts before any current-head green claim.
