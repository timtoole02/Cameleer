# Llama 3.2 1B/3B chat-template-shapes evidence — 2026-05-05

Public, sanitized summary for the bounded compact `llama3-chat-template-shapes-v1` pack on the exact Llama 3.2 1B Instruct Q8_0 and Llama 3.2 3B Instruct Q8_0 rows.

Result: both rows passed all four checked compact-header shape prompts with prompt-token, generated-token, and generated-text parity against the reference runtime.

Boundary: this closes only the bounded compact chat-template-shapes box for these exact rows. It does not promote broad/full Llama-family support, neighboring rows, other quantizations, arbitrary GGUF/Jinja template execution, larger context buckets, production performance, or portability.
