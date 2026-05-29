# Mixtral Gate 9A 50-token ladder — 2026-05-11

Initial long-output hardening evidence for `Mixtral-8x7B-Instruct-v0.1.Q8_0.gguf` only. This is a new hardening gate and does not broaden support claims or replace completed Gates 1-8.

Result: Gate 9A stopped on the first 50-token prompt (`Hello`) because Camelid and the pinned llama.cpp reference diverged at generated token index 9 after matching the first 9 generated tokens. The run completed without a backend crash or observed panic/OOM, but the user-defined stop condition prevents continuing to the 128/256/512+ ladder or Gates 9B-9E until this long-generation parity gap is investigated.

See `summary.json`, `Hello.json`, and `process-summary.json` for compact scrub-safe evidence.
