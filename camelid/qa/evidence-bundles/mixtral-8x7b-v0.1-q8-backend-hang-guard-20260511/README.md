# Mixtral backend hang guard — 2026-05-11

Runtime safety hardening for `Mixtral-8x7B-Instruct-v0.1.Q8_0.gguf` only.

This bundle records a backend/API hang guard added after long-generation continuation evidence showed a `/v1/chat/completions` request could remain open during the 128-token ladder. Non-streaming generation now runs on a blocking worker with a configurable wall-clock timeout (`CAMELID_GENERATION_TIMEOUT_MS`, default 15 minutes). A timeout returns a controlled `503 generation_timeout` response instead of leaving the client waiting indefinitely.

This is not a support-claim promotion and does not fix the known long-generation parity divergence. Keep Gates 1–8 exact-row support wording unchanged.
