CAMELID SLICE:
- Target: support-contract honesty and documentation accuracy for canonical Ubuntu host reporting.
- Domain terms used/updated: support contract, evidence bundle, same-host guard, canonical Ubuntu host report.
- Feedback loop: local docs grep guard for stale Ubuntu host-failure status wording plus `git diff --check`.
- Files changed: `docs/performance/ubuntu-x86-q8.md`, prior host-reporting evidence text/command quoting cleanup, and this evidence bundle.
- Gate/env: local macOS docs-only gate; remote validation was not attempted in this run.
- Baseline: public docs already contained the canonical host-reporting rule; one prior docs evidence command/summary still quoted stale example phrases directly.
- Results: `git diff --check` passed; public docs scan passed with no stale Ubuntu host-failure status phrases found.
- Retain/reject: retained as a safe docs/context slice; no support, throughput, portability, RSS, default-on, or remote-host reachability claim is made.
- Next tracer bullet: if remote validation is needed, run the canonical SSH command in that same run and cite exact stderr on failure; otherwise state remote validation was not attempted.
