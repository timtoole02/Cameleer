# Llama 3 8B lazy-Q8 hot-path helper validation — 2026-05-05T03:50Z

Scope: exact `llama3_8b_instruct_q8_0` row only, using `Meta-Llama-3-8B-Instruct-Q8_0.gguf` SHA256 `583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`.

This bundle validates the checked-in `scripts/bench-q8-hotpath-bundle.mjs` helper on a clean public `main` checkout at `e22307f2f90b`. It records retained-block Q8_0 microbench measurements for representative FFN tensors and `output.weight`, with per-file checksums.

Result: PASS for helper execution and sanitized bundle generation.

Claim boundary: measurement evidence only. This does not widen exact 8B support into broader Llama-family, neighboring sizes, other quantizations, larger contexts, arbitrary template behavior, production throughput, or portability support.
