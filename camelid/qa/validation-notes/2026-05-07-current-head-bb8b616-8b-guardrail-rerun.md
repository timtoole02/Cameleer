# Llama 3 8B exact bounded 1024/2048 current-head rerun

Date: 2026-05-07
Git head: `bb8b616a09d6cdde00d157a586722b1688e87eff`
Canonical lane: approved Ubuntu validation lane
Committed artifact root: `qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T185917Z-head-bb8b616a09d6`

## Claim boundary

This evidence covers only the exact tracked row `llama3_8b_instruct_q8_0` on the bounded 1024/2048 smoke prompt packs at the git head above. It does not claim model-native/larger context, arbitrary templates, neighboring rows, broad 8B support, full Llama-family support, portability, or production throughput.

## Pre-run duplicate check

Before launching the canonical rerun, current local `main` was clean at `bb8b616a09d6cdde00d157a586722b1688e87eff`, and the canonical host showed no active long Llama 3 8B 1024/2048 runner to duplicate.

## Results

`manifest.json` reports `passed: true`.

| pack | prompt id | prompt tokens | generated tokens | generated text | output | max RSS KiB | Q8 file reads |
| --- | --- | --- | --- | --- | --- | ---: | ---: |
| 1024 | `roughly-1024-token-recall` | PASS | PASS | PASS | `CMLD-102` | 922252 | 3210 calls / 54703408384 bytes |
| 2048 | `roughly-2048-token-recall` | PASS | PASS | PASS | `CMLD-204` | 1582312 | 4879 calls / 69538945536 bytes |

Model SHA-256: `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`

## Gates

Full local guardrail log before adding this bundle: `target/cron-faad534f-current-head-guardrails-20260507T185841Z.log`.

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`: PASS
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q q8_file_cache --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q prefill --lib`: PASS
- `./scripts/with-rustup-cargo.sh test -q capabilities_report`: PASS
- `./scripts/check-evidence-bundle-checksums.sh`: PASS
- `node scripts/audit-evidence-bundle-privacy.mjs`: PASS (non-strict; existing older bundle findings only)
- `node scripts/check-public-evidence-claims.mjs`: PASS
- `node scripts/test-check-public-evidence-claims.mjs`: PASS
- `(cd frontend && npm run smoke:model-state)`: PASS

Post-copy bundle gates:

- `node scripts/check-public-evidence-claims.mjs --root qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T185917Z-head-bb8b616a09d6`: PASS
- `./scripts/check-evidence-bundle-checksums.sh qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T185917Z-head-bb8b616a09d6`: PASS
- `node scripts/audit-evidence-bundle-privacy.mjs --root qa/evidence-bundles/llama3-8b-context-1024-2048-current-head-20260507T185917Z-head-bb8b616a09d6 --strict`: PASS
