# Llama 3 8B checkmark current-main API/WebUI/RSS smoke — 2026-05-05

This public bundle preserves the exact Llama 3 8B Instruct Q8_0 checkmark after `origin/main` advanced to `15bfc41d15d5aaf4b8b0244bc38989a2d096f922`.

Result: PASS for `/api/models/load`, `/v1/models`, `/api/capabilities`, `/v1/completions`, `/v1/chat/completions`, generation timing summary, and frontend smoke with `contract_supported=true` and `webui_chat=enabled`. Frontend smoke required generation and produced `Hello`; sampled backend RSS after smoke was `286148 KiB`.

Scope: exact-row smoke only for `Meta-Llama-3-8B-Instruct-Q8_0.gguf` with SHA256 `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`. This does not widen support to broad/full Llama-family behavior, neighboring rows, other quantizations, larger contexts, arbitrary chat-template behavior, or performance portability.
Public-scrub note: `api-webui/load.response.json` and `api-webui/current-model.json` retain model/config/tensor details but elide the large tokenizer token/type/merge tables with original counts preserved.
