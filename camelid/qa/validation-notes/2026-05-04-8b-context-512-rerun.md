# Validation note — Llama 3 8B 512-context rerun

Date: 2026-05-04
Repo head validated: `58acf592345c69c1b684544124cd23804e2899f1`

## Result

The approved Ubuntu validation lane reran `qa/prompt-packs/llama3-context-512-smoke.json` from a clean public `main` checkout against the exact `llama3_8b_instruct_q8_0` row.

Outcome:

- model SHA256 matched `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`
- `./scripts/with-rustup-cargo.sh build --release --bin camelid` passed
- the context pack exited `0` with a `600000 ms` client wait budget
- prompt tokens matched the known-good reference
- generated token IDs matched
- generated text matched
- actual reference prompt token count was `245` with `reference_context=512`
- wall clock was `7:35.65`; timed process maximum RSS was `17262740 KiB`; no swap was reported

Public sanitized bundle:

- `qa/evidence-bundles/llama3-8b-context-512-20260504T234625Z-head-58acf592345c/manifest.json`
- `qa/evidence-bundles/llama3-8b-context-512-20260504T234625Z-head-58acf592345c/summary.json`
- `qa/evidence-bundles/llama3-8b-context-512-20260504T234625Z-head-58acf592345c/SHA256SUMS`

Privacy audit:

- `node scripts/audit-evidence-bundle-privacy.mjs qa/evidence-bundles/llama3-8b-context-512-20260504T234625Z-head-58acf592345c` reported `finding_count: 0` for committed evidence bundles.

## Claim boundary

This closes the previously observed exact-row 8B 512-context timeout for this one bounded pack only. It does **not** promote broad/full support, neighboring model rows, other quantizations, larger context buckets, broader chat-template behavior, or performance portability.

Full-support expansion still requires normalized current-head broader parity, repeated API/WebUI recency, stronger memory/performance evidence, portability evidence, and synchronized docs/API/frontend wording for the exact row.
