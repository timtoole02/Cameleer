# TinyLlama broader/template/context/perf RSS evidence

Exact row: `tinyllama_1_1b_chat_q8_0` (TinyLlama 1.1B Chat Q8_0).

This current-head bundle closes the TinyLlama durable normalization slice for the exact row only:

- broader five-prompt 50-token marker-template parity: PASS
- marker chat-template-shapes parity: PASS
- bounded 512-context parity: PASS
- backend RSS/perf envelope from these non-smoke runs: PASS, max backend RSS 105120 KiB

Scope: exact TinyLlama Q8_0 marker-template evidence only. It does not claim neighboring rows, other quantizations, arbitrary GGUF/Jinja templates, or broader contexts beyond the checked prompt pack.
