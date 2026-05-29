# 2026-05-05 — Llama 3.2 1B bounded 2048-context blocker

Scope: exact `llama32_1b_instruct_q8_0` row only; third bounded 2048-context parity pack.

Target box attempted: Llama 3.2 1B Instruct Q8_0 → parity artifacts → bounded `qa/prompt-packs/llama3-context-2048-smoke.json` / 2048-context pack.

Result: BLOCKED, not green.

A rebuilt isolated checkout at `f153c79b6c51` ran the bounded 2048-context pack on the approved Ubuntu validation lane against the exact Llama 3.2 1B Instruct Q8_0 GGUF. The run used the freshly built backend binary from that checkout and required both prompt-token and generated-token parity.

Observed outcome:

- Prompt pack: `llama3-context-2048-smoke-v1`
- Reference context: `2048`
- Actual reference prompt tokens: `1910` (beyond the checked 1024-context pack while still bounded to the 2048 bucket)
- Max tokens: `5`
- Prompt-token parity: PASS
- Generated token parity: FAIL at generated token index `0`
- Generated text parity: FAIL at text index `0`
- Backend generated tokens/text: `[791,13454,11381,374,356]` / `The repeat marker is C`
- Reference generated tokens/text: `[34,2735,35,12,7854]` / `CMLD-204`
- Backend usage: `1910` prompt tokens + `5` completion tokens
- Reference timing: `1910` prompt tokens in `3202.239 ms`, `5` predicted tokens in `222.643 ms`
- Timed process max RSS: `2929908 KiB`
- Wall clock: `9:42.48`

Workaround attempted: an earlier attempt was stopped because it had selected a preexisting shared backend binary instead of the freshly built isolated-checkout binary. The pack was then rerun with the correct isolated-checkout backend binary, long timeout, and `--require-prompt-match --require-generated-match`; the prompt-token side stayed green, but deterministic generation still diverged on the first generated token.

Claim boundary: this does **not** close the Llama 3.2 1B third bounded 2048-context parity box. The exact blocker is first-token generation divergence at the 2048-context prompt length despite prompt-token parity being exact.
