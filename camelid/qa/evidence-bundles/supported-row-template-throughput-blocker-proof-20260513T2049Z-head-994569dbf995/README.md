# Supported-row arbitrary-template / production-throughput blocker proof — 2026-05-13

Scope: exact current supported rows only: TinyLlama 1.1B Chat Q8_0, Llama 3.2 1B Instruct Q8_0, Llama 3.2 3B Instruct Q8_0, and Llama 3 8B Instruct Q8_0.

Result: blocker proof, not support promotion. This bundle records guardrails proving Camelid does not execute arbitrary/Jinja chat templates as a supported path and does not expose production-throughput evidence for the supported rows.

Validated guardrails:

- `cargo fmt --all -- --check` — PASS
- `cargo test -q arbitrary_jinja_template_is_not_executed_as_supported_renderer` — PASS
- `cargo test -q capabilities_report_current_rows_with_fail_closed_full_support_bar` — PASS
- `bash scripts/check-evidence-bundle-checksums.sh qa/evidence-bundles/supported-row-template-throughput-blocker-proof-20260513T2049Z-head-994569dbf995` — PASS

Shortest closeout path is in `blocker-proof.txt`.
