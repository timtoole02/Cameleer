# cron 5e4b0b83 — docs claim guard, 2026-05-18T15:26Z

Scope: Ubuntu x86_64 dense Llama Q8_0 docs/context only. No Mac, Apple Silicon, Metal, Mixtral, frontend/API readiness, support-contract, portability, production-throughput, or default-on acceleration promotion.

## Inputs reviewed

- `CONTEXT.md` project glossary and `docs/adr/0001-agentic-engineering-discipline.md` operating ADR from the active Camelid worktree.
- Current branch head `cdd557f`, whose code adds a default-off `CAMELID_X86_Q8_FFN_DOWN_GEMM4_AVX2` experiment gate.
- Fresh sanitized status evidence from 2026-05-18T15:22Z: canonical-host execution-plan tests passed on an older remote checkout, the latest same-host guard rejected any new Camelid performance promotion, and the proposed `output.weight` route resolver remains implementation guidance only.
- Fresh output-route research scout from 2026-05-18T15:12Z: `resolve_q8_output_route(...)` is the recommended next tracer bullet, but support/API/frontend/docs claims must remain unchanged until local and canonical gates land.

## Docs retained

- Added the shared glossary and ADR as repo-visible navigation so agents can use the same terms: support contract, evidence bundle, retained/rejected slice, current retained baseline, same-host guard, tracer bullet, deep module, backend-owned packed runtime storage, Q8 projection route resolver, and parity envelope.
- Updated Ubuntu x86 Q8 docs to list `CAMELID_X86_Q8_FFN_DOWN_GEMM4_AVX2` as a default-off developer experiment with explicit no-throughput/support/default-on boundaries.
- Added evidence-needed notes for the current same-host guard and the next output-route resolver tracer bullet instead of promoting unsupported claims.
- Fixed the status pointer to the actual Ubuntu Q8 performance doc path.

## Scrub / claim boundary

- Public docs use `<validation-host>`/sanitized wording only and omit private IPs, private hostnames, credential file paths, remote worktree paths, and local absolute checkout paths.
- The same-host guard numbers are retained only as a rejection/no-promotion note: Camelid avg TTFT `2349.10 ms` / total `2349.46 ms`; llama.cpp avg TTFT `186.84 ms` / total `381.04 ms`; retain current baseline only.
- The canonical-host execution-plan probe is not cited as proof for local route-resolver work because the host checkout was older than the local tree.
- No README support-matrix change, support-contract promotion, API/frontend readiness claim, broad model-family claim, portability claim, or default-on acceleration claim was added.
