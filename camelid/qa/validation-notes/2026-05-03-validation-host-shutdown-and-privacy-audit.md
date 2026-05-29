# Validation note — operator-paused validation lane and evidence-bundle privacy audit

Date: 2026-05-03
Repo head oriented: `7f1f565b4e3c`

## Operating constraint

This is a historical note for an operator-paused Ubuntu validation lane on 2026-05-03. Do not treat it as current host-access evidence.

Until Tim explicitly authorizes a validation-lane rerun:

- do **not** SSH into the validation host or any substitute remote validation box
- treat promotion-grade exact-row runtime reruns as waiting on operator authorization
- do **not** try to substitute local Mac llama-server or reference-runtime runs for that lane unless Tim explicitly authorizes it

That means current-head 1B/3B/8B parity, API, WebUI, and memory/perf reruns needed fresh operator-approved validation before promotion, even though the docs/frontend/API normalization work could continue locally.

## Safe local work that should continue

During that operator pause, the useful lane was local/repo-safe progress only:

- keep `README.md`, `STATUS.md`, `COMPATIBILITY.md`, `/api/capabilities`, and frontend readiness copy aligned on exact-row validation wording
- keep the normalized current-head bundle manifests/commands ready for the next Ubuntu rerun window
- privacy-scrub durable evidence manifests and record anything that still leaks private host/home-path details
- keep validation-lane tracking explicit so nobody overclaims broad Llama-family support without fresh runtime evidence

## Privacy audit finding and local scrub follow-up

A local audit initially found private Ubuntu home-path details in three older raw bundle roots:

- `qa/evidence-bundles/four-row-20260503T024119Z/`
- `qa/evidence-bundles/four-row-20260503T024327Z/`
- `qa/evidence-bundles/four-row-perf-portability-20260503T025639Z/`

Initial audit summary:

- `276` findings before scrub: 110 + 128 + 38 across those three ignored raw roots
- the current rerun output path is `target/evidence-bundle-privacy-audit-20260503.json`, and it now reports `0` findings after the local scrub pass

Representative leaked strings included validation-home absolute paths such as:

- `<validation-home>/work/Camelid/target/private-four-llama-e2e-20260502T212751Z-head-c5e6d7e/...`
- `<validation-home>/.nvm/versions/node/v22.22.2/bin/node`
- `<validation-home>/models/Meta-Llama-3-8B-Instruct-Q8_0.gguf`

The committed public-safe citation roots remain:

- `qa/evidence-bundles/four-row-public-20260503T024327Z/`
- `qa/evidence-bundles/four-row-perf-portability-public-20260503T025639Z/`
- `qa/evidence-bundles/four-row-current-head-20260503T052503Z-head-ab3ee79fcd20/`

Local scrubbed replacements were regenerated successfully into:

- `target/privacy-scrub/four-row-public-20260503T024119Z/`
- `target/privacy-scrub/four-row-public-20260503T024327Z/`
- `target/privacy-scrub/four-row-perf-portability-public-20260503T025639Z/`
- `target/privacy-scrub/reaudit.json` (`0` findings on the scrubbed copies)

On this watchdog pass, those scrubbed replacements were copied over the ignored raw roots locally and the public tracked manifests were normalized to self-reference the `*-public-*` bundle paths. A rerun of the repo audit now reports `0` findings under `qa/evidence-bundles/`.

Local audit helper:

```bash
node scripts/audit-evidence-bundle-privacy.mjs \
  --root qa/evidence-bundles \
  --out target/evidence-bundle-privacy-audit-20260503.json
```

## Current validation framing

For the four-row full-support push, the evidence stack was:

1. remote current-head Llama runtime reruns needed explicit operator authorization
2. local Mac runs were not substitutes for the Ubuntu validation lane
3. 8B longer-context/performance remained a separate technical constraint even after remote reruns resumed

The privacy-scrub lane was locally cleaned up and documented, but runtime-validation promotion still required a fresh operator-approved Ubuntu validation pass.

## Resume plan once operator authorization exists

When Tim explicitly re-enables the Ubuntu validation host, resume in this order:

1. rerun the normalized current-head 1B/3B/8B tracks from the checked-in bundle scaffold
2. preserve any still-blocked 8B 512-context/perf evidence side-by-side with passing short smoke
3. refresh public-safe manifests/checksums only after the raw reruns are complete and scrubbed
4. keep docs/API/frontend wording at validation-lane scope until the exact-row full-support bar is actually met
