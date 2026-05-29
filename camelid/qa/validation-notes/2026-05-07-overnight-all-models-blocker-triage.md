# Overnight all-models blocker triage — 2026-05-07

Git head checked locally: `8eb8f033d13d792e52bfe8ee0e484d643b723524` (`Restore README chat screenshot`) on `main`, clean before this note.

Canonical validation lane check: the approved Ubuntu lane was reachable. I did **not** launch a duplicate long Llama 3 8B 1024/2048 run. The lane still had existing backend servers from the earlier normalized-pack sweep, but no new long 8B context validation was started in this slice.

## Existing source-head-bounded sweep evidence

Artifact root on the validation lane:

`target/four-row-current-head-normalized-pack-sweep-20260507T155303Z-head-ba9a7a1eff74/`

Sweep git head: `ba9a7a1eff7412be91e59a2e921e8bccdd53f430`.

Aggregate summary: `target/four-row-current-head-normalized-pack-sweep-20260507T155303Z-head-ba9a7a1eff74/aggregate-summary.json`.

Result: `passed: false`.

Passing rows in that source-head-bounded sweep:

- TinyLlama compact, broader 5-prompt/50-token, template-shapes, and context-512 rows all passed.
- Llama 3.2 1B template-shapes and context-512 passed.
- Llama 3.2 3B template-shapes and context-512 passed.
- Llama 3 8B template-shapes and context-512 passed.

Failing rows in that source-head-bounded sweep:

- `llama32-1b-broader-3prompt-50tok`: p1/p2 passed; p3 generated-token/text mismatch while prompt tokens matched.
  - Report: `target/four-row-current-head-normalized-pack-sweep-20260507T155303Z-head-ba9a7a1eff74/llama32-1b-broader-3prompt-50tok/llama32-1b-q8-current-head-ba9a7a1eff74-p3/report.json`
  - p3 message: `answer with valid JSON for {"ok":true,"value":2}`
  - First generated token diff index recorded by report: `8`; backend generated token sequence begins `[8586, 374, 279, 4823, 13340, 315, 279, 2728, 1665, 1473, ...]`; llama.cpp begins `[8586, 374, 279, 4823, 13340, 315, 279, 2728, 907, 1473, ...]`.
- `llama32-3b-broader-3prompt-50tok`: p1/p2 passed; p3 generated-token/text mismatch while prompt tokens matched.
  - Report: `target/four-row-current-head-normalized-pack-sweep-20260507T155303Z-head-ba9a7a1eff74/llama32-3b-broader-3prompt-50tok/llama32-3b-q8-current-head-ba9a7a1eff74-p3/report.json`
  - First generated token diff index: `0`; backend chose token `14196`, llama.cpp chose token `63`; report margin disagreement: `0.0778508527832038`.
- `llama3-8b-broader-3prompt-50tok`: p1/p2 passed; p3 generated-token/text mismatch while prompt tokens matched.
  - Report: `target/four-row-current-head-normalized-pack-sweep-20260507T155303Z-head-ba9a7a1eff74/llama3-8b-broader-3prompt-50tok/llama3-8b-q8-current-head-ba9a7a1eff74-p3/report.json`
  - First generated token diff index recorded by report: `6`; backend generated token sequence begins `[8586, 374, 279, 2764, 4823, 1473, 63, 5018, ...]`; llama.cpp begins `[8586, 374, 279, 2764, 4823, 1473, 74694, 2285, ...]`.

## Lazy-Q8/dense diagnostic evidence already present on host

The same canonical worktree contains p3 diagnostics showing this is not obviously isolated to lazy Q8 file backing:

- Llama 3.2 3B p3 `max_tokens=1` dense and lazy-off both produced the same first-token mismatch (`backend=14196`, `llama=63`, margin disagreement `0.0778508527832038`):
  - `target/debug-llama32-3b-p3-max1-dense/report.json`
  - `target/debug-llama32-3b-p3-max1-lazyoff/report.json`
- Llama 3 8B p3 diagnostics still diverged under the checked probes:
  - `target/debug-llama3-8b-p3-50tok-llama-faoff/report.json`
  - `target/debug-llama3-8b-p3-max7-f64/report.json`
  - `target/debug-llama3-8b-p3-max7-lazyoff/report.json`

## Claim boundary / blocker

This note is triage evidence only. It does **not** promote any support surface and does not call current `main` green for later commits.

Concrete blocker for "all exact tracked models working" in this slice: the normalized broader JSON p3 prompt still fails generated-token/text parity for Llama 3.2 1B, Llama 3.2 3B, and Llama 3 8B in the source-head-bounded sweep above, while prompt tokenization matches. The next safe fixer slice should focus on that exact p3 generation divergence with row-specific diagnostics before widening docs/API/frontend claims.
