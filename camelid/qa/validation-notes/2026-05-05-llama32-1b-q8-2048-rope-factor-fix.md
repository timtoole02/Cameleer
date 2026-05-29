# Llama 3.2 1B Q8_0 2048 RoPE factor fix — 2026-05-05

Scope: exact Llama 3.2 1B Instruct Q8_0 bounded 2048-context first-token divergence. This note records the fix evidence only for that row/context bucket; it does not broaden Llama-family or full-context support claims.

Root cause: Camelid loaded GGUF `rope_freqs.weight` but treated each entry as an absolute RoPE frequency. llama.cpp treats the tensor as `freq_factors`: the metadata-derived RoPE frequency for a pair is divided by the stored factor. At the 2048-context bucket this made Q/K RoPE drift while tokenizer parity and later output-projection reconstruction stayed internally self-consistent.

Fix: interpret optional `rope_freqs.weight` entries as finite positive frequency factors and apply them as `derived_theta / factor` before existing RoPE scaling behavior.

Focused remote proof:
- Prompt pack: `llama3-context-2048-smoke-v1`, `roughly-2048-token-recall`
- Context: 2048
- Max generated tokens: 1
- Result: prompt tokens matched, generated tokens matched, generated text matched
- Backend generated token/text: `[34]` / `C`
- Reference generated token/text: `[34]` / `C`
- Wall time: 5m51s
- Max RSS: ~2.9 GiB

Local gates:
- `./scripts/with-rustup-cargo.sh fmt -- --check`
- `./scripts/with-rustup-cargo.sh test apply_rope -- --nocapture`
- `./scripts/with-rustup-cargo.sh clippy --all-targets --all-features -- -D warnings`
- `./scripts/with-rustup-cargo.sh test --all-targets --all-features`

Follow-up still required before any broader support claim: rerun the normal 5-token bounded 2048 pack and update API/frontend/docs evidence if promoting beyond the first-token red-box closure.
