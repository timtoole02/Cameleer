# Four-row normalized evidence bundles

Generated: 2026-05-03T02:43:28Z

Public head target: `9d091ce4d2f1d911f684333eda6575f28e1e9adf`

Ubuntu target: `canonical-private-ubuntu-validation-host`

Bundle files:
- `manifest.json`
- `tinyllama_1_1b_chat_q8_0.bundle.json`
- `llama32_1b_instruct_q8_0.bundle.json`
- `llama32_3b_instruct_q8_0.bundle.json`
- `llama3_8b_instruct_q8_0.bundle.json`
- `SHA256SUMS`

Source evidence:
- Four-row API/WebUI smoke root: `target/private-four-llama-e2e-20260502T212751Z-head-c5e6d7e`
- Source smoke commit: `c5e6d7ee26a9aec6e7c8025ad2029a3904c38670`
- Additional parity/current-head slices are cited per-row inside each bundle JSON.

Current-head rerun status:
- Attempted a clean Ubuntu rerun from exported public head `9d091ce4d2f1d911f684333eda6575f28e1e9adf`.
- Current-head rerun stopped at build time because the historical Ubuntu environment had `cargo 1.75.0`, which cannot parse `Cargo.lock` v4.
- Failed rerun root: `target/full-support-20260503T023129Z`

Support-claim guardrail:
- These bundles are exact-row evidence only.
- Do not broaden claims beyond the named rows or beyond the status captured in each bundle.
