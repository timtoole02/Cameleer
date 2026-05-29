# 2026-05-13 — Backend local exact-row guardrail

Scope: local-only backend/API support-surface guardrail documentation. This note records a current-head guardrail pass at source head `b4d2d3a`; it does not add model parity, remote runtime validation, API/WebUI/RSS promotion evidence, context expansion, portability evidence, production-throughput evidence, or a support-promotion claim for any row.

Current-head evidence:
- The committed scrubbed bundle named `backend-local-current-head-exact-row-guardrail-20260513T0812Z-head-b4d2d3a54fc7` includes a manifest and bundle-local checksums.
- The public scrub guard intentionally prevents public docs from citing local-only bundle paths as support anchors.

Validated commands captured in the bundle:
- `./scripts/with-rustup-cargo.sh test capabilities --all-targets` — PASS
- `node scripts/check-public-evidence-claims.mjs` — PASS
- `scripts/check-public-scrub.sh` — PASS
- `git diff --check` — PASS

Claim boundary:
- Local only: no SSH, Ubuntu validation host, model server promotion rerun, saturation workload, or remote runtime claim was used.
- Mixtral remains unsupported beyond bounded one-token backend MoE runtime evidence; later promotion-candidate artifacts remain superseded by Gate 9A later-generation divergence plus the long-continuation hang.
- The Llama rows remain exact-row bounded only where row-specific evidence exists.
- No neighboring-row, arbitrary-template, frontend/API/WebUI/RSS, long-context, production-throughput, portability, broader-family, or full-support promotion is claimed.
