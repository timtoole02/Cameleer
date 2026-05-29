# 2026-05-12 — Frontend support-status guard

Scope: frontend support-contract interpretation only. This does not add model parity, API readiness, WebUI readiness, RSS/timing, context, portability, or throughput evidence for any row.

Change:
- The frontend now treats only explicit `supported` / `supported_*` statuses as chat-supporting statuses.
- Generic evidence words such as `validated`, `validated_*`, `measured`, and `pass` can still render as positive evidence badges, but they do not unlock WebUI chat or turn an exact compatibility row into a support claim.
- `validated_*_not_promoted` and fail-closed statuses remain guarded/warm.

Claim boundary:
- This preserves the existing exact-row support contract for TinyLlama, Llama 3.2 1B/3B, and Llama 3 8B while keeping the bounded Mixtral v0.1 exact row fail-closed as unsupported validation evidence only.
- It does not promote Mixtral, Mistral, Qwen, Gemma, neighboring rows, broad model families, longer context, arbitrary templates, production throughput, or portability.

Relevant guard:
- `npm --prefix frontend run smoke:model-state`
