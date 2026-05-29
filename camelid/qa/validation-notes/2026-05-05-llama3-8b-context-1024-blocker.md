# 2026-05-05 — Llama 3 8B bounded 1024-context blocker

Scope: exact `llama3_8b_instruct_q8_0` row only; second bounded 1024-context parity pack.

Tim's operating rule was applied before any further 8B long-context promotion: run the 8B 1024-context diagnostic first, and if it fails or times out, stop 8B long-context promotion attempts and shift to performance/memory architecture work with correctness guardrails.

Result: BLOCKED, not green.

An isolated clean checkout at `ebbe49e9b8e7ab2dd1c0a448f86e944b8a8bcc1e` ran the bounded 1024-context pack on the approved Ubuntu validation lane against the exact Llama 3 8B Instruct Q8_0 GGUF. The run used the freshly built backend binary from that checkout, the existing validated llama.cpp reference binaries, and required both prompt-token and generated-token parity.

Observed outcome:

- Prompt pack: `llama3-context-1024-smoke-v1`
- Reference context: `1024`
- Reference prompt tokens accepted by llama.cpp: `881`
- Max tokens: `5`
- llama.cpp reference timing: `881` prompt tokens in `12340.33 ms`, `5` predicted tokens in `702.43 ms`, total `13042.76 ms`
- Camelid backend result: no parity report was produced because `/v1/chat/completions` timed out after the configured `900000 ms` wait
- Summary outcome: `prompt_tokens_all_match=false`, `generated_tokens_all_match=false`, `generated_text_all_match=false`, prompt exit code `1`
- Remote isolated work dir: scrubbed private temp checkout path
- Remote artifact dir: scrubbed private temp artifact path
- Model SHA256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958  Meta-Llama-3-8B-Instruct-Q8_0.gguf`
- `summary.json` SHA256: `c7476c550699acfc7bf1771a37087ff0f29d1ee602c62cb30ca2f1ab49a15651`
- `command.txt` SHA256: `a20fda069511305b6000132e75c7d03dc21231d708ef898553c41efbddd8f948`
- `stderr.log` SHA256: `ce74eff326c1b6789f9432c8c2ff34c6507cddd32acb54b16e8f9acf98d07953`
- `result-summary.json` SHA256: `8e14fdd4f5afae1002ef3af88d31c883be19ca750d6d1480f170dd4e4249bc28`

Claim boundary: this does **not** close the Llama 3 8B second bounded 1024-context parity box. Because the 8B 1024-context diagnostic timed out before producing a parity report, 8B long-context promotion is paused under Tim's rule. The existing exact-row 8B smoke, broader 50-token, first 512-context, compact template-shapes, API/WebUI/RSS, and measurement-only lazy-Q8 evidence remain intact, but 8B 1024/2048-context support is not promoted. Follow-up work should shift to KV/cache and attention memory behavior, Q8 matmul/output-projection hot paths, avoiding dense/f32 materialization, chunked/streamed long-context prefill, and instrumentation for per-layer timing plus RSS peaks while keeping TinyLlama/1B/3B short-context correctness guardrails green.
