# 2026-05-05 — lazy Q8 hot-path cost probe

Scope: exact `llama3_8b_instruct_q8_0` only; measurement evidence, not a support promotion.

A clean public `origin/main` worktree at `723a665` was used on the Ubuntu validation lane with a small uncommitted measurement-only CLI patch: `bench-q8-blocks --swap-rank2-shape`. The flag lets the retained-block Q8 bench reinterpret rank-2 rows/cols without transposing bytes, matching Camelid's guarded rectangular lazy Q8 runtime layout for tensors such as `blk.0.ffn_gate.weight` and `output.weight`.

Checks:

- `cargo fmt --check` on the patched worktree passed
- `cargo test -q q8_0 --lib` passed: 12 passed
- Local repo after adding the same measurement patch: `cargo fmt` and `cargo test -q q8_0 --lib` passed
- Follow-up clean public rerun on the current Ubuntu validation host checked out `723a665`, applied only the measurement patch, selected the rustup toolchain, passed `cargo fmt --check`, passed `cargo test -q q8_0 --lib` (12 passed), and re-ran the release-mode hot-path probes against the same 8B model SHA. Release probe timings were consistent with the public bundle: FFN all-row dots ~36.7-37.1 ms and swapped `output.weight` all-row dot ~330.1 ms. The first release command's process elapsed/RSS included release build overhead, so use the JSON benchmark timings rather than that shell timing for performance interpretation.

Key observations from the 8B Q8_0 GGUF (`583c616da14b82930f887f991ab446711da0b029166200b67892d7c9f8f45958`):

| tensor | storage shape | logical bench shape | Q8 payload | avoided f32 materialization | avg all-row Q8 dot |
| --- | ---: | ---: | ---: | ---: | ---: |
| `blk.0.ffn_down.weight` | `[14336,4096]` | `[14336,4096]` | 59.5 MiB | 224.0 MiB | 36.73 ms |
| `blk.0.ffn_gate.weight` | `[4096,14336]` | `[14336,4096]` swapped | 59.5 MiB | 224.0 MiB | 36.69 ms |
| `output.weight` | `[4096,128256]` | `[128256,4096]` swapped | 532.3 MiB | 2004.0 MiB | 328.12 ms |

Interpretation:

- The FFN projection hot path is roughly symmetric under the swapped logical layout in this retained-block serial bench (~36.7 ms per logical `[14336,4096]` all-row dot).
- The logits/output projection remains a material single-token bottleneck: the swapped logical `[128256,4096]` Q8 dot is ~328 ms even before broader runtime/file-backed-reader overheads.
- Existing clean-main API/WebUI timing evidence still shows end-to-end 8B first-token work dominated by layer linear hot paths (`avg_linear_hot_path_ms` ~11.65 s across completion + chat responses in the clean API/WebUI/RSS manifest). This microbench narrows which Q8 surfaces deserve optimization, but does not prove portability or full support.

Public sanitized bundle:

- `qa/evidence-bundles/llama3-8b-lazy-q8-hotpath-20260505T021411Z-head-723a665/manifest.json`
- `qa/evidence-bundles/llama3-8b-lazy-q8-hotpath-20260505T021411Z-head-723a665/SHA256SUMS`

Claim boundary: exact 8B Q8_0 lazy hot-path cost evidence only. Do not broaden to Llama-family support, neighboring model rows, other quantizations, arbitrary GGUF/Jinja templates, larger contexts, or performance portability.
