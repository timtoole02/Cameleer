# 2026-05-14 — Throughput host readiness recheck

Scope: follow-up hygiene for the same-host throughput harness on current `main`.

## Host readiness

Initial SSH contact timed out before any remote command ran, so this pass made no host-state claim from that first contact attempt.

A later live retry on the approved canonical Ubuntu validation lane completed a read-only readiness probe at 2026-05-14T08:12:23Z. The probe showed the lane reachable and root storage no longer full (`91G` available, `53%` used). No source checkout was created, no build was started, and no benchmark or support-promotion validation was run from this readiness probe.

A fresh read-only probe at 2026-05-14T11:26:30Z reconfirmed that disk is not the immediate blocker: root storage showed `89G` available and `54%` used, with `121GiB` memory available. Current-head Camelid work directories were present, but this probe still did not create or modify a checkout, start a build, or run a same-host benchmark.

The last local ignored throughput blocker artifact found during this pass recorded the previous exact blocker as a full root filesystem during a current-head release build attempt (`No space left on device` while writing a Rust release artifact). That ignored local artifact was removed after inspection so it would not remain as silent local WIP; the committed support path continues to rely only on tracked notes and evidence.

## Harness state

The throughput harness is tracked at `scripts/bench-llama3-same-host.mjs`, with non-network plan/help coverage at `scripts/test-bench-llama3-same-host.mjs` and the support boundary documented in `BENCHMARKS.md` plus `qa/validation-notes/2026-05-14-throughput-harness-cleanup.md`.

The harness is a bounded exact-row timing tool only. It does not promote production-throughput, Llama 3.2 1B, Mixtral, neighboring-row, portability, or broad-family support without separate row-specific evidence captured under those exact conditions.

## Measurement status

No retained measurement: the lane readiness probes completed, but this pass deliberately did not start a long-running same-host benchmark or capture a scrubbed evidence bundle. The same-host throughput comparison remains unpublished until a fresh source/runtime lane captures scrubbed row-specific parity and timing evidence.
