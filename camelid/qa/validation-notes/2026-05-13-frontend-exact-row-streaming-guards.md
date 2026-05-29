# 2026-05-13 — Frontend exact-row streaming guards

Scope: frontend support-contract and streaming-state guardrail documentation only. This note records validation for frontend integration and streaming-parser smokes from source head `dcd9c85` through later frontend-only guard refreshes including `4cf0eb8`; it does not add model parity, API readiness, RSS/timing, context, portability, production-throughput, or support-promotion evidence for any row.

Current-head evidence checked before this note:
- `main` at `dcd9c85` (`Harden frontend SSE stream parsing`), extending the earlier `c59d4b3`, `caf6f07`, and `096c5f4` exact-row streaming guard passes.
- Existing public evidence checks passed before editing: `bash scripts/check-public-scrub.sh` and `node scripts/check-public-evidence-claims.mjs`.
- Untracked local-only evidence bundle directories were present in the working tree and were not cited here.

Frontend guardrails covered by the smokes:
- Active streaming assistant rows expose an active streaming state, busy semantics, and an incomplete-code warning for open streaming fences.
- Active sends with already-visible streamed assistant content keep exactly one active assistant row and the live generation badge instead of showing the pre-token pending loader.
- Pre-token assistant rows remain visibly active while the backend is generating, without rendering a duplicate pending loader during an active send.
- JSON fallback responses notify the streaming reader, keep response-header progress visible, preserve backend completion-token usage when provided, and still deliver one visible content update.
- SSE parser coverage now includes spec-style multi-line `data:` payload joining, preservation of usage from joined payloads, and continued acceptance of backend batches that send multiple complete JSON payloads inside one event.
- Completed replies with unclosed fenced code render as safe completed code cards, not as still-generating output.
- The API contract view turns green only when runtime readiness and the selected exact supported compatibility row match.
- Broad family/quant lists and planned exact rows stay informational; they do not unlock selected-row chat or become support evidence.

Validation run on this checkout:
- `cd frontend && npm run smoke:integration` — PASS
- `cd frontend && npm run smoke:streaming` — PASS
- `cd frontend && npm run smoke:ui` — PASS

Follow-up clean-head refresh:
- `main` at `2a72f75` (`Keep frontend streaming visibly active`) is a frontend presentation/test follow-up to this streaming guardrail lane.
- Clean-head frontend smokes passed: `cd frontend && npm run smoke:integration`, `npm run smoke:streaming`, and `npm run smoke:ui`.
- The refresh is UI reliability evidence only; it does not add row-specific parity, API/WebUI/RSS readiness, context, production-throughput, portability, or support-promotion evidence.

API evidence-rendering follow-up:
- `main` at `4cf0eb8` (`Tighten frontend API feature evidence rendering`) keeps the API contract view scoped to exact compatibility rows. The view displays selected-row evidence, latest checked output, and neutral API feature labels from `/api/capabilities`, while refusing to treat broad family/quant lists, provider-specific feature names, planned rows, or runtime health alone as support evidence.
- This follow-up is frontend display/guardrail evidence only. It does not add row-specific parity, API/WebUI/RSS readiness, context, production-throughput, portability, or support-promotion evidence, and it does not widen Llama, Mistral, Mixtral, Qwen, Gemma, or arbitrary-GGUF support.

Claim boundary:
- This is frontend/UI reliability evidence for exact-row gating and streaming presentation.
- It does not widen Llama, Mistral, Mixtral, Qwen, Gemma, or arbitrary-GGUF support.
- It does not supersede row-specific parity/API/WebUI/RSS evidence requirements in `COMPATIBILITY.md`.
