# Frontend 3B WebUI closure slice — 2026-05-19T2316Z

Scope: Llama 3.2 3B Instruct Q8_0 frontend/WebUI closure only.

Retained slice:
- Live chat now keeps runtime readiness, exact-row support, and row-scoped capability lanes visible after messages exist.
- TopBar support-contract detail prefers active/selected exact-row hints before falling back to the first current-gate row, so active 3B does not display TinyLlama as the row detail.
- Tracked Models cards use the shared chat gate for loaded_now, generation_ready, active_model_id, exact row, and quant checks before saying chat is unlockable.
- Regression smokes cover 3B quant mismatch, live-chat readiness strip, TopBar exact-row priority, 512/1024/2048 context boundary rendering, and stale runtime gating.

Live backend note: the canonical validation host API port was not listening during this local frontend slice, so no fresh live API/WebUI promotion evidence is claimed here. The retained evidence is the exact local CI-equivalent frontend/support-contract gate set recorded in logs.
