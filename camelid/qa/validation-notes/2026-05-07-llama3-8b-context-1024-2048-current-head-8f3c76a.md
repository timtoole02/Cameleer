# Llama 3 8B current-head bounded 1024/2048 pass after capabilities alignment

Run: 2026-05-07T1325Z on the canonical Ubuntu validation host.

Git head: `8f3c76a87eeb1e1819c2329f3137dd875979fc93` (`Align capabilities with 8B bounded packs`).

Remote repo/run path: scrubbed validation checkout `Camelid-api-align-20260507T1320Z`.
Remote artifact root: `target/llama3-8b-context-1024-2048-current-head-20260507T1325Z-head-8f3c76a87eeb`.

Commands executed:
- `cargo build --release`
- `node scripts/run-llama3-prompt-pack.mjs --pack qa/prompt-packs/llama3-context-1024-smoke.json --out-dir target/llama3-8b-context-1024-2048-current-head-20260507T1325Z-head-8f3c76a87eeb/pack-1024 --model <validation-model-path>/Meta-Llama-3-8B-Instruct-Q8_0.gguf --model-id meta-llama3-8b-q8-current-head-8f3c76a87eeb --prefix meta-llama3-8b-q8-current-head-8f3c76a87eeb --backend http://127.0.0.1:8371 --llama-url http://127.0.0.1:8373 --wait-ms 7200000 --require-prompt-match --require-generated-match --start-llama-server --llama-server <llama.cpp-build>/bin/llama-server --llama-tokenize <llama.cpp-build>/bin/llama-tokenize`
- `node scripts/run-llama3-prompt-pack.mjs --pack qa/prompt-packs/llama3-context-2048-smoke.json --out-dir target/llama3-8b-context-1024-2048-current-head-20260507T1325Z-head-8f3c76a87eeb/pack-2048 --model <validation-model-path>/Meta-Llama-3-8B-Instruct-Q8_0.gguf --model-id meta-llama3-8b-q8-current-head-8f3c76a87eeb --prefix meta-llama3-8b-q8-current-head-8f3c76a87eeb --backend http://127.0.0.1:8371 --llama-url http://127.0.0.1:8373 --wait-ms 7200000 --require-prompt-match --require-generated-match --start-llama-server --llama-server <llama.cpp-build>/bin/llama-server --llama-tokenize <llama.cpp-build>/bin/llama-tokenize`

Pass booleans:
- `pack-1024 passed=true`, `prompt_tokens_all_match=true`, `generated_tokens_all_match=true`, `generated_text_all_match=true`
- `pack-2048 passed=true`, `prompt_tokens_all_match=true`, `generated_tokens_all_match=true`, `generated_text_all_match=true`

Results:
- `llama3-context-1024-smoke-v1`: `reference_prompt_token_count=881`, context `1024`, generated text `CMLD-102`, generated tokens `[34,2735,35,12,4278]`, llama prompt eval `12579.135 ms / 881 tokens`, backend usage `881 + 5 = 886` tokens.
- `llama3-context-2048-smoke-v1`: `reference_prompt_token_count=1910`, context `2048`, generated text `CMLD-204`, generated tokens `[34,2735,35,12,7854]`, llama prompt eval `29348.527 ms / 1910 tokens`, backend usage `1910 + 5 = 1915` tokens.

Artifact paths:
- `target/llama3-8b-context-1024-2048-current-head-20260507T1325Z-head-8f3c76a87eeb/run.log`
- `target/llama3-8b-context-1024-2048-current-head-20260507T1325Z-head-8f3c76a87eeb/backend.log`
- `target/llama3-8b-context-1024-2048-current-head-20260507T1325Z-head-8f3c76a87eeb/pack-1024/summary.json`
- `target/llama3-8b-context-1024-2048-current-head-20260507T1325Z-head-8f3c76a87eeb/pack-2048/summary.json`
- `target/llama3-8b-context-1024-2048-current-head-20260507T1325Z-head-8f3c76a87eeb/pack-1024/meta-llama3-8b-q8-current-head-8f3c76a87eeb-roughly-1024-token-recall/report.json`
- `target/llama3-8b-context-1024-2048-current-head-20260507T1325Z-head-8f3c76a87eeb/pack-2048/meta-llama3-8b-q8-current-head-8f3c76a87eeb-roughly-2048-token-recall/report.json`

Boundary: this claims only the exact `llama3_8b_instruct_q8_0` bounded 1024/2048 prompt packs on the canonical Ubuntu host at commit `8f3c76a87eeb1e1819c2329f3137dd875979fc93`. It does **not** claim model-native or larger context, arbitrary templates, throughput, portability, neighboring rows, broad 8B support, or full Llama-family support.
