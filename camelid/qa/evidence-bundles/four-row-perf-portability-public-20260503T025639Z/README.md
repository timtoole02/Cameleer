# Four-row compact perf/portability envelope

Generated: 2026-05-03T02:56:39Z

Ubuntu target: `canonical-private-ubuntu-validation-host`
Artifact source commit: `c5e6d7ee26a9aec6e7c8025ad2029a3904c38670`
Public head target: `9d091ce4d2f1d911f684333eda6575f28e1e9adf`
Current-head rebuild: **not rerun on current head** — the historical Ubuntu environment had cargo 1.75.0, which could not parse Cargo.lock v4 (`cargo build --release --bin backendinference` failed before rerun).

Host facts:
- `uname -a`: `Linux canonical-private-ubuntu-validation-host 6.17.0-1012-aws #12~24.04.1-Ubuntu SMP Mon Apr  6 17:36:28 UTC 2026 x86_64 x86_64 x86_64 GNU/Linux`
- current host git HEAD at capture time: `04de8105ec2e440e557068b174725c4d1c83b3c0`
- cargo: `cargo 1.75.0`; node: `v18.19.1`
- memory: `Mem:           123Gi       1.9Gi       100Gi       3.0Mi        22Gi       121Gi`
- swap: `Swap:             0B          0B          0B`
- disk `/`: `/dev/root       193G   30G  164G  16% /`

| Row | Model SHA256 | Runtime (chat ms) | Max RSS KiB | RSS trend KiB (load→1tok→5tok→post-smoke) | Timeout setting | No OOM/runaway |
| --- | --- | ---: | ---: | --- | --- | --- |
| TinyLlama 1.1B Chat Q8_0 | `a4c9bb1dbaa3…` | 40558 | 136588 | `27032→89568→136588→135864` | none explicit | yes |
| Llama 3.2 1B Instruct Q8_0 | `432f310a77f4…` | 20973 | 347316 | `161620→273552→274876→347316` | 120000 ms parity wait | yes |
| Llama 3.2 3B Instruct Q8_0 | `b5607b5090a8…` | 45138 | 559572 | `311932→309048→454396→559572` | 120000 ms parity wait | yes |
| Llama 3 8B Instruct Q8_0 | `583c616da14b…` | 81086 | 566980 | `454396→454396→454396→566980` | 1200000 ms parity wait | yes |

Notes:
- Runtime durations are the Ubuntu API/WebUI smoke `hello` runs with `max_tokens=1`, `temperature=0`, and `chat-repeats=1`.
- RSS trend uses the Ubuntu validation-run checkpoints (`load`, `1tok`, `5tok`) plus the API/WebUI smoke `backend-ps-after` snapshot.
- Smoke bundle fetches have no explicit timeout in `scripts/model-promotion-smoke-bundle.mjs`; parity wait defaults come from the saved harness configuration/artifacts.
- All rows kept empty smoke stderr logs, passed health-after checks, and showed no OOM/kill/runaway signature in the captured bounded runs.
- Guardrail: exact-row evidence only. Do not broaden support claims from this envelope.
