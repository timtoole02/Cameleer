# Llama 3 8B context-512 evidence — 2026-05-04

Public, sanitized summary for a reopened Ubuntu validation-lane rerun of the exact `llama3_8b_instruct_q8_0` row.

Result: the bounded 512-context prompt pack passed on clean public `main` at `58acf592345c69c1b684544124cd23804e2899f1`: prompt tokens, generated token IDs, and generated text all matched the known-good reference for the one checked prompt.

Boundary: this closes only the previously observed 8B 512-context timeout for this pack. It does not promote broad/full support, neighboring model rows, other quantizations, larger context buckets, or performance portability.
