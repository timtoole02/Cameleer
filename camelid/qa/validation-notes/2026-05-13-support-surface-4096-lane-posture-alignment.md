# 2026-05-13 — Support-surface 4096 evidence alignment

Scope: docs/support-contract alignment only. No remote runtime validation was run for this slice, and no support boundary is widened beyond existing row-specific PASS artifacts.

Evidence checked before edits:

- Repo was on `main` at `b822a35` (`Harden frontend capability copy normalization`).
- The working tree already had a pre-existing modified `src/inference.rs`; this docs slice did not edit or stage it.
- The latest exact Llama 3.2 1B Instruct Q8_0 bounded 4096-context public bundle is `qa/evidence-bundles/llama32-1b-context-4096-current-head-20260513T163426Z-head-470388f/manifest.json`.
- That manifest reports a clean source/runtime head `470388f8165b`, prompt-token parity at 3755 prompt tokens, generated token IDs `[34,2735,35,12,12378]`, generated text `CMLD-409`, and the claim boundary remains exact-row/current-head only.

Changes recorded:

- `README.md`, `COMPATIBILITY.md`, `docs/VALIDATION_MATRIX.md`, and `docs/CONTRIBUTOR_QUICKSTART.md` now cite the latest 1B 4096 bundle instead of the older 4096 source-head bundle where current public support language needs the freshest anchor.
- `FULL_SUPPORT_BLOCKER_MATRIX.md` now includes the Llama 3.2 1B checked 4096 pack in the four-row blocker story and replaces stale validation-lane availability wording with maintainer-controlled, privacy-preserving approved-lane language.

Claim boundary:

- This is support-surface consistency only.
- It does not promote Llama 3.2 3B or Llama 3 8B beyond their checked 512/1024/2048 packs.
- It does not promote model-native/larger context beyond checked packs, neighboring rows, arbitrary/Jinja templates, production throughput, portability, Mistral support, Mixtral API/WebUI/frontend readiness, Qwen support, Gemma support, or arbitrary GGUF support.
- Public docs continue to avoid private validation-host addresses, key paths, local home paths, and operator-only commands.
