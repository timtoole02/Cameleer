# Frontend 3B display + CI gate slice — 2026-05-20T1243Z

Scope: Llama 3.2 3B Instruct Q8_0 frontend/WebUI closure only.

Retained slice:
- Extracted the loaded-model display alias into a shared frontend helper so backend runtime aliases render as the canonical 3B row only from the exact GGUF filename plus Q8_0 evidence.
- Hardened regression coverage for direct GGUF `file_type 7` evidence, Q4/neighbor-row fail-closed paths, and missing `/api/capabilities` fail-closed chat gating while preserving visible runtime readiness.
- Added the 3B exact-row closure smoke and frontend integration smoke to the GitHub frontend CI job after build and model-state smoke.

Live backend note: the canonical validation host API port was not listening during this local frontend slice, so no fresh live API/WebUI promotion evidence is claimed here. The retained evidence is the exact local CI-equivalent frontend/support-contract/script gate set recorded in logs.
