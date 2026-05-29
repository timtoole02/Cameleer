# Docs Ubuntu host-honesty claim guard — cron 5e4b0b83, 2026-05-18T21:18Z

Scope: docs/evidence-summary wording only; no code, support promotion, API/frontend claim, portability claim, throughput claim, or default-on behavior changed.

Remote validation: not attempted in this run. This slice intentionally makes no current remote validation-status claim.

Changes retained:
- Reworded stale Ubuntu validation-failure summaries to say only that no Ubuntu timing/profiling validation is recorded for the affected local slices.
- Kept historical artifact filenames unchanged while preventing summaries from presenting current remote validation status.
- Reworded Mixtral readiness language to not yet established, without widening support.
- Kept `CAMELID_X86_Q8_OUTPUT_PACKED_ROWS4_MATMUL` default-off and local-only; no Ubuntu throughput/support/default-on evidence was added.

Green checks:
- `node scripts/check-public-evidence-claims.mjs` — PASS (`95 manifest(s), 48 summary file(s)`).
- `node scripts/audit-evidence-bundle-privacy.mjs --root qa/evidence-bundles/llamacpp-q8-cpu-re-20260514T1200Z --strict` — PASS (`finding_count: 0`, `bundle_count_with_findings: 0`).
- Focused stale-host wording grep over README/docs/current Q8 summary — PASS (no disallowed current remote validation-status claims found).

Retain/reject: retain this docs/context slice as a support-contract honesty cleanup.

Git diff stat before commit:
```
 README.md                                          |  2 +-
 docs/CONFIGURATION.md                              |  2 +-
 docs/VALIDATION_MATRIX.md                          |  2 +-
 docs/performance/ubuntu-x86-q8.md                  | 15 ++++++-----
 .../llamacpp-q8-cpu-re-20260514T1200Z/README.md    | 30 +++++++++++-----------
 5 files changed, 26 insertions(+), 25 deletions(-)

```
