# Docs support-contract and host-reporting audit — 2026-05-20T16:57Z

## Scope

Docs/context-only retained audit for support-contract honesty and canonical Ubuntu host reporting.

Remote validation was not attempted in this run. No host-access failure is claimed.

## Feedback loop

Commands run from the docs worktree:

```bash
rg -n -S '(Ubuntu|ubuntu|canonical).*?(blocked|down|unavailable|Permission denied \(publickey\))|(blocked|down|unavailable|Permission denied \(publickey\)).*?(Ubuntu|ubuntu|canonical)' CONTEXT.md docs README* qa/evidence-bundles/*/README.md qa/evidence-bundles/*/summary.json
rg -n -S 'Permission denied \(publickey\)|Ubuntu (is )?(blocked|down|unavailable)|ubuntu (is )?(blocked|down|unavailable)|canonical Ubuntu host (is )?(blocked|down|unavailable)|canonical host (is )?(blocked|down|unavailable)' CONTEXT.md docs README* qa/evidence-bundles/*/README.md qa/evidence-bundles/*/summary.json
rg -n -S '<private-host-reference-patterns>' CONTEXT.md docs README*
rg -n -S 'production-ready|fully supported|support-contract supported|default-on|throughput claim|RSS claim' docs README* CONTEXT.md
```

Raw outputs are preserved in `scan.txt` and `narrow-scan.txt`; exact private host/key strings are intentionally not repeated in this artifact.

## Result

- The narrow stale-host-failure scan returned no matches.
- Public docs/context still mention the canonical SSH probe only in the host-reporting rule; this is intentional rule text, not a host-state claim.
- Support-contract wording found in public docs is scoped as negative/guarded wording: default-off experiments, evidence-needed timing/profiling, or not-production-ready claims.

## Retain/reject

Retained as a safe docs/context audit slice. No support rows, API behavior, frontend behavior, or performance claims were widened.
