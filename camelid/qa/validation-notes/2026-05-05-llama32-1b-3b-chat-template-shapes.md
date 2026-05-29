# Validation note — Llama 3.2 1B/3B chat-template-shapes rerun

Date: 2026-05-05
Repo head validated: `e9f28572e090e8c564e7ebbf36a4475c345da2b8`

## Result

The approved Ubuntu validation lane ran `qa/prompt-packs/llama3-chat-template-shapes.json` from a clean public `main` checkout against the exact `llama32_1b_instruct_q8_0` and `llama32_3b_instruct_q8_0` rows.

Outcome:

- 1B model SHA256 matched `432f310a77f4650a88d0fd59ecdd7cebed8d684bafea53cbff0473542964f0c3`
- 3B model SHA256 matched `b5607b5090a8280063fff2d706bb3408ca6542341b06aab39c3eca0a28575921`
- release backend build passed before the pack runs
- both row runs exited `0` with a `600000 ms` client wait budget
- all 4 compact prompt shapes matched prompt tokens on both rows
- all 4 compact prompt shapes matched generated token IDs on both rows
- all 4 compact prompt shapes matched generated text on both rows
- checked prompts: `single-system-user`, `multi-turn-user-assistant-user`, `assistant-final-no-generation-header`, and `multiline-whitespace-preservation`

Public sanitized bundle:

- `qa/evidence-bundles/llama32-1b-3b-chat-template-shapes-20260505T060036Z-head-e9f28572e090/manifest.json`
- `qa/evidence-bundles/llama32-1b-3b-chat-template-shapes-20260505T060036Z-head-e9f28572e090/summary.json`
- `qa/evidence-bundles/llama32-1b-3b-chat-template-shapes-20260505T060036Z-head-e9f28572e090/SHA256SUMS`

Bundle checksum verification passed with `shasum -a 256 -c SHA256SUMS` from inside the bundle directory.

## Claim boundary

This validates only the exact Llama 3.2 1B/3B Instruct Q8_0 rows for this bounded compact chat-template-shapes pack. It does **not** promote broad/full Llama-family support, neighboring rows, other quantizations, arbitrary GGUF/Jinja template execution, larger context buckets, production performance, or portability.

Full-support expansion still requires larger/broader context coverage, stronger memory/performance evidence, portability evidence, and synchronized docs/API/frontend wording for each exact row.
