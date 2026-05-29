# 2026-05-14 — Frontend README template/throughput boundary wording

Scope: frontend documentation/support-contract wording only. No remote runtime validation was needed or run because this slice does not strengthen a model, API, WebUI, frontend, throughput, portability, or template-support claim.

Evidence checked before edits:

- Repo was clean on `main` at `7ac1446` (`Fail closed exact Llama 3.2 Jinja templates`).
- Recent metadata-Jinja, frontend support-boundary, throughput-readiness, and privacy-guard notes were reviewed.
- The current supported-row boundary remains exact-row only: the Llama 3.2 1B metadata-Jinja row-template path is scoped to the recognized exact row/template shape, while broad arbitrary/Jinja-template readiness and production-throughput readiness remain unpromoted.

Changes recorded:

- Updated `frontend/README.md` so the 1B frontend row mentions the checked 4096/8192 context packs and the exact-row metadata-Jinja row-template path without treating either as broad support.
- Replaced stale frontend wording that presented arbitrary/Jinja-template readiness and production-throughput readiness as supported lanes with row-scoped evidence wording.
- Rephrased the frontend smoke evidence paragraph so template-shape and lazy-Q8/perf measurements remain bounded exact-row evidence only, not arbitrary-template, production-throughput, portability, neighboring-row, or broad-family support.

Validated commands:

- `git diff --check`
- `bash scripts/check-public-scrub.sh`
- `node scripts/test-check-public-evidence-claims.mjs`
- `node frontend/scripts/model-state-smoke.mjs`

Claim boundary:

- This is docs/support-contract hygiene only.
- It does not promote Llama, Mistral, Mixtral, Qwen, Gemma, arbitrary/Jinja-template behavior, production throughput, portability, neighboring rows, model-native/larger contexts, or broader/full support.
- Public docs continue to avoid private validation-host addresses, key paths, local home paths, and operator-only commands.
