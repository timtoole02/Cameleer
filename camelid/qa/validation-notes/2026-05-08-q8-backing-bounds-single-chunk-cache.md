# 2026-05-08 — Q8 backing bounds and single-chunk scoped cache guard

## Scope

Small Q8/file-backed guardrail slice from the overnight all-models fixer. This is a runtime safety/RSS/read-reuse tuning change only; it does not widen model, context, API, frontend, or family support claims.

## Repo/process guardrails

- Started from `main` at `a328710594aeb83d0c09010612f5ce8ca9677356` with a clean worktree.
- Local and canonical remote process scans found no active duplicate long Llama 3 8B 1024/2048 validation run.
- Canonical remote scan did show unrelated long Q8 bench jobs for Qwen/Mixtral/Gemma, so this slice stayed local and bounded.
- Start/process artifacts: `target/cron-faad534f-20260508T0719Z-q8-slice/`.

## Change

- `Q8_0FileBacking::read_exact_at_cached` now rejects reads before the declared backing offset or beyond the declared Q8_0 tensor slice before file I/O/cache lookup.
- Layer-major lazy-Q8 scoped cache default now applies only to multi-chunk prefill, where file-backed Q8_0 weights can be reused across chunks. Single-chunk prefill skips the 256 MiB default scoped cache unless `CAMELID_PREFILL_LAYER_MAJOR_Q8_0_FILE_CACHE_BYTES` is set explicitly.
- `docs/CONFIGURATION.md` documents the single-chunk behavior.

## Local validation

PASS artifacts under `target/cron-faad534f-20260508T0719Z-q8-slice/`:

```text
./scripts/with-rustup-cargo.sh test q8_file_backing_rejects_reads_outside_declared_storage_before_file_io --lib -- --nocapture
./scripts/with-rustup-cargo.sh test q8_file_cache_file_read_reuses_partial_overlap_and_reads_gaps --lib -- --nocapture
./scripts/with-rustup-cargo.sh test prefill_layer_major_q8_cache_uses_scoped_default_only_for_lazy_q8 --lib -- --nocapture
./scripts/with-rustup-cargo.sh test prefill_layer_major_scoped_q8_cache_reuses_file_reads_across_chunks --lib -- --nocapture
./scripts/with-rustup-cargo.sh test q8_file_cache --lib -- --nocapture
./scripts/with-rustup-cargo.sh test q8_0_file_backed --lib -- --nocapture
./scripts/with-rustup-cargo.sh fmt --all -- --check
./scripts/with-rustup-cargo.sh test -q
./scripts/with-rustup-cargo.sh clippy --all-targets -- -D warnings
node scripts/check-public-evidence-claims.mjs
node scripts/test-check-public-evidence-claims.mjs
git diff --check
```

Final `cargo test -q` summary:

```text
152 passed; 12 passed; 53 passed; 4 passed; 22 passed; 10 passed; 10 passed; 17 passed; 19 passed; 0 doctests
```

## Support boundary

Because this changes runtime/source after the latest canonical Llama 3 8B PASS bundle (`qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260508T062823Z-head-86081876d01e`, head `86081876d01e`), the new HEAD must not be called current-head 8B green until a fresh canonical 8B 1024/2048 PASS exists for this commit.

TinyLlama remains the current gate. Llama 3.2 1B/3B remain exact-row bounded through checked 2048 packs. Llama 3 8B remains exact bounded-pack support only at rows/heads with matching PASS artifacts.
