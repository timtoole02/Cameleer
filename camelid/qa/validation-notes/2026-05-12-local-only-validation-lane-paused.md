# Validation note — local-only validation lane paused

Date: 2026-05-12

Supersession note (2026-05-13): this file remains historical evidence for the 2026-05-12 local-only pause. Current maintainer validation-lane availability is operator-controlled and should come from Tim's latest direction, not from this historical note; public docs and artifacts still must not include private host addresses, key paths, local home paths, or operator-only commands.

The Ubuntu validation lane was operator-paused for Camelid promotion-grade runtime evidence on 2026-05-12. During that pause:

- do not substitute local-only or substitute-remote runs for promotion-grade Ubuntu validation evidence;
- treat promotion-grade runtime reruns as waiting on explicit operator authorization, not as locally reproducible on a Mac by default;
- if regenerating scaffolds today, use the current `evidence_needed` status unless a Tim-authorized validation/runtime lane is available; do not reuse historical pause wording as current host-access evidence;
- keep local work to docs, frontend/readiness logic, evidence normalization, privacy scrub, lightweight guardrails, and code changes that have local tests;
- keep support language exact-row only and fail closed unless docs, API/frontend surfaces, and row-specific passing artifacts all agree.

This note does not change any existing support row. It only updates the execution posture: historical Ubuntu evidence remains historical evidence for the exact row, source head, context bucket, and prompt pack it names; a paused validation lane is not new evidence and cannot promote neighboring rows, broader families, larger contexts, production throughput, portability, or arbitrary-template behavior.

When an approved validation lane is explicitly reopened, regenerate affected scaffolds with the operator-approved validation status, run only on that approved validation/runtime lane, and publish only scrubbed manifests/checksums whose exact rows passed their tracks.
