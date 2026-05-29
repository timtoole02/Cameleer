# Docs evidence-needed validation status cleanup

Date: 2026-05-19T20:20Z
Owner lane: DOCS CAMELID / cron `5e4b0b83-312c-4949-b085-21cf457183b9`

## Scope

Retained docs/context slice to keep support-contract and host-reporting language honest. This slice does not change runtime support, frontend readiness, model parity, or Ubuntu x86 Q8 performance claims.

## Changes

- Updated `scripts/prepare-full-support-bundle.mjs` default generated status from host-state wording to `evidence_needed` when runtime validation has not been attempted.
- Renamed generated manifest/readme fields from host-status/blocker wording to validation-evidence wording.
- Updated the scaffold test to assert the new evidence-needed contract.
- Refreshed historical validation notes so they do not reuse stale host-access wording as current evidence.
- Reframed 3B throughput notes as evidence-needed until a Tim-authorized Ubuntu validation lane records fresh same-host artifacts.

## Validation

```bash
node scripts/test-prepare-full-support-bundle.mjs
```

PASS.

Stale host-state/status-token audit over public docs, status notes, validation notes, and the full-support scaffold script/test passed with no matches.

## Ubuntu host reporting

Remote validation was not attempted in this run. No host failure, outage, or SSH error is claimed.
