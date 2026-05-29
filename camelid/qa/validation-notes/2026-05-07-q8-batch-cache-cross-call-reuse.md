# Q8 batch cache cross-call reuse guard — 2026-05-07

Head before commit: `ea7a91e05876bb3a6f5f9b1ed82cc0ec348816b8`.

Scope: local structural runtime guard only. This does not promote any model row or change public support claims.

Change: added a focused unit guard for file-backed Q8_0 batch matmul with the bounded byte cache enabled. The first call reads two Q8 chunks; the second identical call must be served from cache with zero additional file reads while preserving logits against the Q8 block-dot reference.

Artifact: `target/cron-0971ade9-20260507T2144Z-head-ea7a91e05876-q8-file-reader-diagnostics/post-change-q8-cache-reuse.log`.

Validation:

- `cargo test q8_0_file_backed_batch_matmul_reuses_cached_chunks_across_calls -- --nocapture`
- `cargo test q8_0_file_backed -- --nocapture`
- `cargo test q8_file_cache -- --nocapture`
