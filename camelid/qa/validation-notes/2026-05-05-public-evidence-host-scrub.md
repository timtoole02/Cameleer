# 2026-05-05 public evidence host scrub

## Scope

Watchdog privacy/evidence-normalization pass for the public `qa/evidence-bundles` tree.

## Changes

- Redacted the local Mac hostname in the three `four-row-current-head-*` top-level manifests to `redacted-local-docs-host`.
- Recomputed the corresponding bundle `SHA256SUMS` entries for each changed `manifest.json`.
- Refreshed `FULL_SUPPORT_BLOCKER_MATRIX.md` so the current public checkout base is `23ccc6d` and the local-only privacy audit references are current.
- Clarified `QA_LLAMA32_3B_Q8_ACCEPTANCE.md` so the exact 3B row is described as accepted **short local-chat smoke** only, with longer context, broader template acceptance, stronger memory/perf, and portability still blocking broader/full support.

## Validation

Local validation passed:

```text
node -e JSON.parse(...) for the three edited manifests
(cd each edited current-head bundle && shasum -a 256 -c SHA256SUMS)
node scripts/audit-evidence-bundle-privacy.mjs --strict --out target/evidence-bundle-privacy-audit-watchdog-20260505T0305Z.json
bash scripts/check-public-scrub.sh
git diff --check
```

The strict public evidence privacy audit reported `finding_count: 0`.

Remote clean-clone validation on the canonical Ubuntu validation host also passed after push at `3ee2bc7`:

```text
remote_head=3ee2bc7
sha256sum_bundle_files_checked=14
privacy_findings=0
public_scrub_guard=ok
```

## Claim boundary

This pass advances privacy scrub and evidence citation hygiene only. It does **not** add new runtime parity, longer-context, performance, portability, or broad Llama-family support evidence.
