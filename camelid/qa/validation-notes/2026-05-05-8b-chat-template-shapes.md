# Validation note — Llama 3 8B chat-template-shapes rerun

Date: 2026-05-05
Repo head validated: `d13541ad8d7e87426cddd0d0a13e292f39c73f31`

## Result

The approved Ubuntu validation lane ran `qa/prompt-packs/llama3-chat-template-shapes.json` from a clean public `main` checkout against the exact `llama3_8b_instruct_q8_0` row.

Outcome:

- model SHA256 matched `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`
- `./scripts/with-rustup-cargo.sh build --release --bin camelid` passed
- the chat-template-shapes pack exited `0` with a `600000 ms` client wait budget
- all 4 compact prompt shapes matched prompt tokens
- all 4 compact prompt shapes matched generated token IDs
- all 4 compact prompt shapes matched generated text
- checked prompts: `single-system-user`, `multi-turn-user-assistant-user`, `assistant-final-no-generation-header`, and `multiline-whitespace-preservation`

Public sanitized bundle:

- `qa/evidence-bundles/llama3-8b-chat-template-shapes-20260505T003821Z-head-d13541ad8d7e/manifest.json`
- `qa/evidence-bundles/llama3-8b-chat-template-shapes-20260505T003821Z-head-d13541ad8d7e/summary.json`
- `qa/evidence-bundles/llama3-8b-chat-template-shapes-20260505T003821Z-head-d13541ad8d7e/SHA256SUMS`

## Claim boundary

This validates only the exact 8B Instruct Q8_0 row for this bounded compact chat-template-shapes pack. It does **not** promote broad/full support, neighboring model rows, other quantizations, arbitrary GGUF/Jinja chat-template execution, larger context buckets, or performance portability.

Full-support expansion still requires normalized current-head broader parity, stronger memory/performance evidence, portability evidence, broader context coverage, and synchronized docs/API/frontend wording for the exact row.
