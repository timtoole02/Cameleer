# 2026-05-07 — Q8 cache zero-capacity release and local gate

Head at start of lane: `ea1b7c4842540a9a954731ffb6777f7974ec46d2` (`Polish guarded Gemini-style chat landing`), local `main` was ahead of `origin/main` by one commit before this runtime/test change.

## Change

- Tightened the bounded lazy Q8_0 file-byte cache so `CAMELID_Q8_0_FILE_CACHE_BYTES=0` clears any retained cache entries immediately on the next cache get/insert path, not only when a later stats snapshot applies capacity.
- Added a regression test proving bytes inserted under a nonzero cap cannot be served after the cap is toggled to zero and then back to nonzero.
- Aligned the API capability test with the current fail-closed Mistral row status (`active_validation_unsupported`) and explicitly guards that no Mistral support claim is present.

## Local evidence

- `cargo test q8_file_cache -- --nocapture` — PASS (10 Q8 cache tests).
- `cargo test` — PASS (137 lib tests, all integration/doc tests passing).

## Claim boundary

No canonical Ubuntu 8B long-context PASS was run in this lane, deliberately avoiding duplicate long 8B runs. Because this is a runtime/source change after the newest committed 8B evidence bundle, do **not** call current head 8B 512/1024/2048 green from this note. The 8B long-context buckets remain bounded-pack/support claims only where exact committed PASS artifacts, docs/API/frontend alignment, and a fresh canonical current-head PASS exist.
