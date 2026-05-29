# 2026-05-13 — Supported-row template/throughput blocker proof

Scope: current supported exact rows only: TinyLlama 1.1B Chat Q8_0, Llama 3.2 1B Instruct Q8_0, Llama 3.2 3B Instruct Q8_0, and Llama 3 8B Instruct Q8_0.

Result: blocker proof, not a support promotion.

What closed this run:

- Added a runtime guardrail test proving an arbitrary Jinja loop/expression chat template is not executed as a supported renderer; Camelid falls back to the role-colon renderer unless a recognized row-specific renderer/subset applies.
- Added API capability guardrails requiring every current supported row to keep explicit arbitrary/Jinja-template and production-throughput blockers, and to keep bounded perf/RSS evidence distinct from a production-throughput label.
- Published the scrubbed proof bundle at `qa/evidence-bundles/supported-row-template-throughput-blocker-proof-20260513T2049Z-head-994569dbf995/manifest.json`.

Validated commands:

- `cargo fmt --all -- --check`
- `cargo test -q arbitrary_jinja_template_is_not_executed_as_supported_renderer`
- `cargo test -q capabilities_report_current_rows_with_fail_closed_full_support_bar`

Shortest path to clear the blockers:

1. Add a row-specific broad/metadata template renderer or real template execution path, with llama.cpp prompt-token parity for the agreed template pack and fail-closed behavior for unsupported templates.
2. Add production-throughput evidence for each row being promoted: fixed host class, exact GGUF SHA, prompt/output budgets, concurrency/warmup policy, latency/tokens-per-second summaries, RSS/swap/page-in/storage-pressure telemetry, and deterministic parity guardrails.
3. Publish scrubbed manifests/checksums and synchronize `/api/capabilities`, frontend readiness copy, README, COMPATIBILITY, and STATUS in the promotion commit.
