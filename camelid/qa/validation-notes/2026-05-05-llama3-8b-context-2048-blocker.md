# 2026-05-05 — Llama 3 8B bounded 2048-context blocker

Scope: exact `llama3_8b_instruct_q8_0` row only; third bounded 2048-context parity pack.

Target box attempted: Llama 3 8B Instruct Q8_0 → parity artifacts → bounded `qa/prompt-packs/llama3-context-2048-smoke.json` / 2048-context pack.

Result: BLOCKED, not green.

An isolated clean checkout at `3ac87bf34a70baa2194f8084efd743d59a19fadd` ran the bounded 2048-context pack on the approved Ubuntu validation lane against the exact Llama 3 8B Instruct Q8_0 GGUF. The run used the freshly built backend binary from that checkout, the existing validated llama.cpp reference binaries, and required both prompt-token and generated-token parity.

Observed outcome:

- Prompt pack: `llama3-context-2048-smoke-v1`
- Reference context: `2048`
- Reference prompt tokens accepted by llama.cpp: `1910`
- Max tokens: `5`
- llama.cpp reference completion: generated tokens `[34,2735,35,12,7854]`, text `CMLD-204`
- llama.cpp reference timing: `1910` prompt tokens in `28077.67 ms`, `5` predicted tokens in `725.24 ms`, total `28802.90 ms`
- Camelid backend result: no parity report was produced because `/v1/chat/completions` timed out after the configured `900000 ms` wait
- Summary outcome: `prompt_tokens_all_match=false`, `generated_tokens_all_match=false`, `generated_text_all_match=false`, prompt exit code `1`
- Remote isolated work dir: scrubbed private temp checkout path
- Model SHA256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958  Meta-Llama-3-8B-Instruct-Q8_0.gguf`
- `summary.json` SHA256: `9fd7ecdfb8065ee8dd2cea5c76398a7a6c3e749c046497b68f723e2c4714c94d`
- `command.txt` SHA256: `c6efdcffa266c729955e2fefb490639d11bb84b666c16b2c8a5bbb08eb5ac833`
- `stderr.log` SHA256: `46cf507aecd2149ae789c2d7c07de01c88d9d987a7a377061a5525299f26eb57`

Claim boundary: this does **not** close the Llama 3 8B third bounded 2048-context parity box. The exact blocker is backend non-completion within the 900-second parity harness timeout for the 1910-token bounded prompt. The existing exact-row 8B smoke, broader 50-token, first 512-context, compact template-shapes, API/WebUI/RSS, and measurement-only lazy-Q8 evidence remain intact, but 8B 1024/2048-context support is still not promoted.
