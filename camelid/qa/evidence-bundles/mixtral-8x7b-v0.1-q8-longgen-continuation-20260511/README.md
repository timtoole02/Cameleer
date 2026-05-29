# Mixtral long-generation continuation — 2026-05-11

Continuation evidence for `Mixtral-8x7B-Instruct-v0.1.Q8_0.gguf` exact row only.

Status: partial failure.

What completed:
- `01-9A-128-hello.json`: backend vs llama.cpp comparison at `max_tokens=128`.

What failed:
- Run 2 (`9A`, `max_tokens=128`, prompt `What is 2+2?`) completed on llama.cpp, then the backend `/v1/chat/completions` request remained hung for hours and never produced repo-safe result JSON.
- The runner was terminated to preserve partial evidence and avoid indefinite host burn.

Notes:
- This bundle does not justify any support-claim expansion.
- Raw logs and private host paths are intentionally omitted from evidence files.
