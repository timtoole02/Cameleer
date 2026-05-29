# ADR 0001: Agentic engineering discipline

## Status

Accepted

## Context

Camelid is being advanced by multiple AI worker lanes across performance, parity, docs, QA, and product integration. Prior coordination drift produced too much status noise and too little durable engineering leverage. The project needs a workflow that keeps agents aligned, preserves hard-won evidence, and prevents repeated failed experiments.

## Decision

Camelid uses a small-skills operating model inspired by Matt Pocock's engineering-skills pattern:

1. Maintain a project glossary in `CONTEXT.md` and use those terms in code, tests, docs, issues, and agent updates.
2. Record hard-to-reverse, surprising engineering trade-offs as ADRs in `docs/adr/`.
3. Require a feedback loop before major hypotheses: test, API script, same-host guard, benchmark, or profiler loop.
4. Prefer tracer-bullet vertical slices over broad horizontal rewrites.
5. Preserve retained and rejected slices as evidence bundles.
6. Compare performance work against the current retained baseline, not stale baselines.
7. Keep support claims gated by the support contract: parity evidence, API behavior, frontend behavior, and docs must agree.
8. Separate worker output from user-facing status. Workers produce evidence; a consolidated digest summarizes decisions and next actions.

## Consequences

- Agents must update or reference `CONTEXT.md` when terminology becomes ambiguous.
- Performance work without a reproducible loop is not ready for implementation.
- Failed experiments should leave a rejected-slice note instead of vanishing.
- Documentation may lag code only when explicitly marked as not promotion-ready.
- User-facing updates should be fewer, sharper, and evidence-backed.

## Alternatives considered

- Keep status-driven cron updates only. Rejected because it creates apparent activity without enough engineering pressure.
- Centralize all work in one long-lived agent. Rejected because specialized lanes are useful, but only when each lane has a durable feedback loop and evidence discipline.
