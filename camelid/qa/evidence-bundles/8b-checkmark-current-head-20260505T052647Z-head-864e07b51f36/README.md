# Llama 3 8B checkmark current-head smoke — 2026-05-05

This bundle refreshes the exact Llama 3 8B Instruct Q8_0 current-head API/WebUI/RSS smoke on public `main` head `864e07b51f36`.

Result: PASS for `/api/models/load`, `/v1/models`, `/api/capabilities`, `/v1/completions`, `/v1/chat/completions`, generation timing summary, and frontend smoke with `contract_supported=true` and `webui_chat=enabled`.

Observed backend RSS max during the smoke: `286056 KiB`. Model SHA256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`.

Boundary: this preserves the supported exact-row smoke checkmark only. It does not promote broad/full Llama-family support, neighboring rows, other quantizations, larger contexts, arbitrary chat-template behavior, or production performance/portability.
