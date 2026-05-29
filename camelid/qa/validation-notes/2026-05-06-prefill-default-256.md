# 2026-05-06 — Prefill chunk default follows 8B bounded PASS lane

Scope: runtime/performance default only. This does not widen model support, does not promote neighboring rows, and does not change docs/API/frontend support claims without row-specific PASS artifacts.

Change:

- Raised the default `CAMELID_PREFILL_CHUNK_TOKENS` from `128` to `256`.
- Explicit overrides still win, including `full|all|prompt|unbounded` diagnostic probes and `1` for the older sequential prefill path.
- Invalid or zero values continue to fall back to the default.

Evidence basis:

- Current public 8B bounded-context PASS artifacts used lazy Q8 with retained Q8 blocks off, Q8 file cache `0`, Q8 file reader chunk bytes `67108864`, parallel linear enabled, and `CAMELID_PREFILL_CHUNK_TOKENS=256`:
  - `qa/evidence-bundles/llama3-8b-context-1024-20260506T182100Z-head-e146d3b335d8/summary.json` — prompt/generated tokens/text matched, generated `CMLD-102`, wall `2:06.07`, timed max RSS `17372872 KiB`.
  - `qa/evidence-bundles/llama3-8b-context-2048-20260506T182534Z-head-e146d3b335d8/summary.json` — prompt/generated tokens/text matched, generated `CMLD-204`, wall `4:33.81`, timed max RSS `17506972 KiB`.
- Earlier 8B 1024 default-128 diagnostic remained much slower (`32:43.10`) with larger traced lazy-Q8 read volume (`91781055744` bytes) before the current Q8/prefill reuse stack, so leaving the runtime default at 128 no longer matched the validated fast bounded lane.

Guardrail:

- This is not standalone support evidence. Exact support remains limited to rows and context buckets that already have scrubbed PASS bundles plus aligned docs/API/frontend wording.
