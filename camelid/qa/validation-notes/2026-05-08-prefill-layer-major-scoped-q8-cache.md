# 2026-05-08 — Layer-major scoped Q8 file cache reuse

## Scope

Added a bounded, layer-major-only Q8_0 file-cache capacity override for lazy file-backed Q8_0 prefill. The global Q8_0 file cache remains disabled by default outside explicit/scoped reuse.

## Repo state before change

- Branch: `main`
- Base HEAD: `a90a36becbd730e98c3aa2a2703b696daf102c62` (`Guard q8 output diagnostic file reads`)
- Latest committed 8B 1024/2048 evidence bundle found locally: `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260508T040523Z-head-e203d3cf3ea5`

Because this change touches runtime/source code after that bundle, it does **not** make current HEAD 8B-green. Fresh canonical 8B PASS evidence is required before calling the new HEAD green for bounded 8B 512/1024/2048.

## Change

- Added `with_q8_file_cache_capacity_override(...)` around the layer-major prefill path.
- Default scoped capacity for lazy file-backed layer-major prefill: `CAMELID_PREFILL_LAYER_MAJOR_Q8_0_FILE_CACHE_BYTES=268435456` (256 MiB) when the global `CAMELID_Q8_0_FILE_CACHE_BYTES` is unset.
- Setting `CAMELID_Q8_0_FILE_CACHE_BYTES` explicitly preserves the existing global cache behavior.
- Setting `CAMELID_PREFILL_LAYER_MAJOR_Q8_0_FILE_CACHE_BYTES=0` disables the scoped layer-major cache.
- The scoped override is restored after the prefill call, and the global cache is trimmed back to the restored capacity.

This is a bounded read-reuse/RSS tuning change only; it is not support evidence for broader 8B, larger-context, model-native, throughput, portability, neighboring rows, or full Llama-family claims.

## Local validation

PASS:

```text
cargo test scoped_q8 -- --nocapture
cargo test capacity_override -- --nocapture
cargo test layer_major_q8_cache -- --nocapture
cargo test -q
```

`cargo test -q` summary:

```text
151 passed; 12 passed; 53 passed; 4 passed; 22 passed; 10 passed; 10 passed; 17 passed; 19 passed; 0 doctests
```

## Not run

- No canonical remote 8B 512/1024/2048 run was launched in this slice, to avoid duplicate long 8B validation during structural/headroom work.
