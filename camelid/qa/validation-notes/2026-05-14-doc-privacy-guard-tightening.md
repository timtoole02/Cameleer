# 2026-05-14 — Docs privacy guard tightening

Scope: documentation/support-surface privacy hygiene only. No remote runtime validation was run for this slice, and no model/API/frontend support boundary is widened.

Evidence checked before edits:

- Repo was clean on `main` at `331bb27` (`Reflect row-scoped template throughput support`).
- Recent throughput/docs notes and benchmark examples were reviewed for support-claim scope and private operator-detail exposure.

Changes recorded:

- Replaced concrete Ubuntu model/check-out paths in benchmark examples and recent validation notes with scrubbed placeholders.
- Replaced a concrete validation-lane address in a recent validation note with lane-level wording.
- Tightened `scripts/check-public-scrub.sh` so future tracked files fail the public scrub guard on absolute Ubuntu home paths and the recently used validation-lane addresses.

Claim boundary:

- This is privacy/support-contract hygiene only.
- It does not promote Llama, Mistral, Mixtral, Qwen, Gemma, arbitrary-template behavior, production throughput, portability, neighboring rows, or broader/full support.
- Public docs continue to keep third-party reference credit intact and avoid private validation-host addresses, key paths, local home paths, and operator-only commands.
