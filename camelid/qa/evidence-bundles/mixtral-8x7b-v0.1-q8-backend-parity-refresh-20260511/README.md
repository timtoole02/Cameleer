# Mixtral 8x7B Instruct Q8_0 Backend Parity Refresh — 2026-05-11

Scope: exact-row backend parity refresh for `Mixtral-8x7B-Instruct-v0.1.Q8_0.gguf`.

This bundle records six short Mistral-instruct chat prompts against Camelid and the pinned split-tensor llama.cpp reference. Each run required prompt-token and generated-token equality.

Result: all six prompts matched prompt tokens, generated tokens, and generated text.

This is backend parity evidence only. It does not by itself claim API smoke, WebUI readiness, RSS/timing envelope, manifest/checksum refresh, or broad Mixtral-family support.
