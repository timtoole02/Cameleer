# Llama 3 8B chat-template-shapes evidence — 2026-05-05

Public, sanitized summary for a reopened Ubuntu validation-lane run of the exact `llama3_8b_instruct_q8_0` row.

Result: the bounded `llama3-chat-template-shapes-v1` pack passed on clean public `main` at `d13541ad8d7e87426cddd0d0a13e292f39c73f31`: prompt tokens, generated token IDs, and generated text all matched the known-good reference for all four compact chat-template shape prompts.

Boundary: this validates only the exact 8B Instruct Q8_0 row for the checked compact chat-template shape pack. It does not promote broad/full support, neighboring model rows, other quantizations, arbitrary GGUF template execution, larger context buckets, or performance portability.
