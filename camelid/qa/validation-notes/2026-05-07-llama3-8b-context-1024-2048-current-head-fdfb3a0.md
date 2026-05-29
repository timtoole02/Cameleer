# Llama 3 8B current-head bounded 1024/2048 pass

Run: 2026-05-07T1249Z on the canonical Ubuntu validation host.

Git head: `fdfb3a0354e9d13eab55a1eb9995811ace0c9113` (`Accept Q8 byte-count suffix knobs`).

Remote repo/run path: scrubbed validation checkout `Camelid-current-8b-1024-2048-20260507T1249Z`.
Remote artifact root: `target/llama3-8b-context-1024-2048-current-head-20260507T1249Z-head-fdfb3a0354e9`.

Commands inspected:
- `cat target/llama3-8b-context-1024-2048-current-head-20260507T1249Z-head-fdfb3a0354e9/pack-1024/summary.json`
- `cat target/llama3-8b-context-1024-2048-current-head-20260507T1249Z-head-fdfb3a0354e9/pack-2048/summary.json`
- `tail -n 40 target/llama3-8b-context-1024-2048-current-head-20260507T1249Z-head-fdfb3a0354e9/pack-1024/meta-llama3-8b-q8-current-head-fdfb3a0354e9-roughly-1024-token-recall/{stderr.log,stdout.log}`
- `tail -n 40 target/llama3-8b-context-1024-2048-current-head-20260507T1249Z-head-fdfb3a0354e9/pack-2048/meta-llama3-8b-q8-current-head-fdfb3a0354e9-roughly-2048-token-recall/{stderr.log,stdout.log}`

Pass booleans:
- `pack-1024 passed=true`
- `pack-2048 passed=true`

Results:
- `llama3-context-1024-smoke-v1`: `reference_prompt_token_count=881`, `generated_text_match=true`, `generated_tokens_match=true`, generated text `CMLD-102`, prompt eval `12753.52 ms / 881 tokens`, total `13456.46 ms / 886 tokens`, host memory breakdown `model=8137 MiB context=128 MiB`.
- `llama3-context-2048-smoke-v1`: `reference_prompt_token_count=1910`, `generated_text_match=true`, `generated_tokens_match=true`, generated text `CMLD-204`, prompt eval `29268.98 ms / 1910 tokens`, total `30017.05 ms / 1915 tokens`, host memory breakdown `model=8137 MiB context=256 MiB`.

Artifact paths:
- `target/llama3-8b-context-1024-2048-current-head-20260507T1249Z-head-fdfb3a0354e9/pack-1024/summary.json`
- `target/llama3-8b-context-1024-2048-current-head-20260507T1249Z-head-fdfb3a0354e9/pack-2048/summary.json`
- `target/llama3-8b-context-1024-2048-current-head-20260507T1249Z-head-fdfb3a0354e9/pack-1024/meta-llama3-8b-q8-current-head-fdfb3a0354e9-roughly-1024-token-recall/report.json`
- `target/llama3-8b-context-1024-2048-current-head-20260507T1249Z-head-fdfb3a0354e9/pack-2048/meta-llama3-8b-q8-current-head-fdfb3a0354e9-roughly-2048-token-recall/report.json`

Boundary: this claims only the exact `llama3_8b_instruct_q8_0` bounded 1024/2048 prompt packs on the canonical Ubuntu host at commit `fdfb3a0354e9d13eab55a1eb9995811ace0c9113`. It does **not** claim model-native or larger context, arbitrary templates, throughput, portability, neighboring rows, broad 8B support, or full Llama-family support.
