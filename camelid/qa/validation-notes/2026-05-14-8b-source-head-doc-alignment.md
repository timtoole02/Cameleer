# 2026-05-14 — 8B source-head support wording alignment

Scope: docs/support-contract wording only. No remote runtime validation was run for this slice, and no support boundary is widened.

Evidence checked before edits:

- Repo was clean on `main` at `4c6fb3b` (`Reflect exact-row template throughput readiness`).
- The Llama 3 8B 1024/2048 PASS anchor remains `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260509T041451Z-head-8e26be0a73c0/manifest.json` for source/runtime head `8e26be0a73c0`.
- Llama 3.2 1B 4096/8192 PASS anchors remain `qa/evidence-bundles/llama32-1b-context-4096-current-head-20260513T163426Z-head-470388f/manifest.json` and `qa/evidence-bundles/llama32-1b-context-8192-current-head-20260513T183501Z-head-aaf9207d1669/manifest.json`.

Changes recorded:

- Replaced stale public wording that described the 8B 1024/2048 bounded pack as passing on current `main` with source/runtime-head-scoped wording tied to the cited bundle.
- Refreshed `PARITY.md` so the 1B proof surface includes the checked 4096/8192 context packs and keeps the claim exact-row bounded.
- Tightened README wording around the active Mistral and Mixtral rows so unsupported next-family language stays exact-row.

Claim boundary:

- This is documentation alignment only.
- It does not promote Llama 3 8B beyond cited source/runtime-head bounded packs.
- It does not promote Mistral, Mixtral, Qwen, Gemma, neighboring Llama rows, arbitrary/Jinja templates, production throughput, portability, or model-native/larger context beyond checked packs.
