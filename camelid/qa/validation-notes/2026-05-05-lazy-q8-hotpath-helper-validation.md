# 2026-05-05 — Llama 3 8B lazy-Q8 hot-path helper validation

Scope: exact `llama3_8b_instruct_q8_0` row only.

A clean public `main` checkout at `e22307f2f90b` ran the checked-in `scripts/bench-q8-hotpath-bundle.mjs` helper on the approved Ubuntu validation lane against `Meta-Llama-3-8B-Instruct-Q8_0.gguf`.

Result: PASS.

Validated steps:

- clean public clone with dirty tree `false`
- release `camelid` build via the pinned Rust wrapper
- helper execution with `--skip-build --repeats 20 --warmup 3`
- sanitized `manifest.json`, per-tensor JSON, and `SHA256SUMS` generation
- exact model SHA256 `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`

Key observations from this helper rerun:

- `blk.0.ffn_down.weight` logical `[14336,4096]` all-row retained-Q8 dot averaged `35.78 ms`.
- `blk.0.ffn_gate.weight` with swapped rank-2 logical shape `[14336,4096]` averaged `35.73 ms`.
- `output.weight` with swapped rank-2 logical shape `[128256,4096]` averaged `320.24 ms` while avoiding `2004.0 MiB` of f32 materialization.
- deterministic metadata remains `serial_only_q8_0_block_rows`, with no default parallel Q8 kernel.

Public sanitized evidence:

- `qa/evidence-bundles/llama3-8b-lazy-q8-hotpath-helper-validated-20260505T0350Z-head-e22307f2f90b/manifest.json`
- `qa/evidence-bundles/llama3-8b-lazy-q8-hotpath-helper-validated-20260505T0350Z-head-e22307f2f90b/SHA256SUMS`

Claim boundary: this validates the helper and repeats measurement-only retained-block Q8 hot-path evidence for the exact measured 8B model/tensors. It does **not** promote broad Llama-family support, neighboring rows, other quantizations, larger contexts, arbitrary template behavior, production throughput, or portability support.
