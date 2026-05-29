# 2026-05-05 — Llama 3.2 1B Q8_0 2048-context Q8 cache probe

Scope: exact `llama32_1b_instruct_q8_0` row only; bounded `qa/prompt-packs/llama3-context-2048-smoke.json` content on an isolated validation checkout. This is red-box correctness/I/O tracing only.

Checkout: isolated validation checkout from clean public `main` head `a15682205c6fd0d3fe6a9b7d941a3c0d446ab836`.

Local guardrail before remote:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q kv_cache --lib`
- `node scripts/test-check-forward-trace-invariants.mjs`
- `node scripts/test-compare-forward-traces.mjs`

Remote guardrail before probe:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q kv_cache --lib`
- `node scripts/test-check-forward-trace-invariants.mjs`
- `node scripts/test-compare-forward-traces.mjs`
- `./scripts/with-rustup-cargo.sh build --release`

Probe shape:

- Same 1910-token 2048-context prompt content, capped to `max_tokens=1` so the run isolates the first generated-token red box.
- `CAMELID_FORWARD_RSS_TIMINGS=on`
- `CAMELID_PREFILL_CHUNK_TOKENS=32`
- Compared default memory-safe Q8 file cache capacity `0` against an explicit `CAMELID_Q8_0_FILE_CACHE_BYTES=268435456` diagnostic run.

Results:

| Q8 file cache capacity | Prompt tokens | Backend first token/text | llama.cpp first token/text | Backend rank/logit for reference token `34` | Q8 reads | Cache hits | Backend peak RSS | Wall time |
| --- | ---: | --- | --- | --- | ---: | ---: | ---: | ---: |
| `0` | `1910` | `[11]` / `","` | `[34]` / `"C"` | rank `1996`, logit `2.5268857` vs token `11` logit `6.4547954` | `22473` calls / `63,350,893,312` bytes | `0` | `464,468 KiB` | `5:47.17` |
| `268435456` | `1910` | `[11]` / `","` | `[34]` / `"C"` | rank `1996`, logit `2.5268857` vs token `11` logit `6.4547954` | `21957` calls / `63,349,770,496` bytes | `516` | `817,512 KiB` | `5:55.61` |

Trace conclusion:

- The exact first-token divergence is unchanged by the diagnostic 256 MiB Q8 file cache: backend still selects token `11` while llama.cpp selects token `34`, and the reference token remains ranked `1996` by backend logits.
- The bounded cache records some hits, but it does not materially reduce byte traffic for this 1B/2048 path and increases backend RSS by roughly `353 MiB` in this probe. This is not a support or performance promotion.
- The useful structural path remains batched/read-reuse work that avoids repeated file-backed Q8 reads by construction, plus upstream layer/KV/attention correctness tracing. Opportunistic chunk caching at this size is diagnostic-only and should not be treated as the 1B/2048 fix.

Claim boundary: this does **not** close the Llama 3.2 1B 2048-context parity box, does not promote 8B long-context, and does not widen broad Llama-family support. The row remains red until a fresh row-specific PASS artifact exists.
