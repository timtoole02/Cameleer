# 2026-05-06 — 8B 1024 full-prompt prefill diagnostic probe

Scope: exact tracked Llama 3 8B Instruct Q8_0 diagnostic only. This does not promote 8B 1024/2048 support and does not widen docs/API/frontend claims.

Change under probe:

- Current head `86effbf219bf294e19d19f8bece72bb26de07cb9` includes `CAMELID_PREFILL_CHUNK_TOKENS=full|all|prompt|unbounded`, which runs the prefill portion as one layer-major prompt chunk instead of the default 128-token chunks.
- The run kept lazy file-backed Q8 enabled, retained Q8 blocks disabled, and Q8 file cache disabled.

Canonical remote diagnostic:

- Host: canonical Ubuntu validation lane; private SSH host, key path, and address intentionally omitted.
- Remote isolated worktree: `<validation-worktree>/`.
- Remote artifact root: `<validation-worktree>/target/llama3-8b-context-1024-fullprompt-diag-20260506T103900Z-head-86effbf/`.
- Local copied summary/tails: `target/remote-llama3-8b-context-1024-fullprompt-86effbf-20260506T103900Z/`.
- Prompt pack: `qa/prompt-packs/llama3-context-1024-smoke.json` (`roughly-1024-token-recall`).
- Model: `$CAMELID_MODEL_DIR/Meta-Llama-3-8B-Instruct-Q8_0.gguf`.
- Env: `CAMELID_LAZY_Q8_0_LINEAR=1`, `CAMELID_RETAIN_Q8_0_BLOCKS=0`, `CAMELID_PREFILL_CHUNK_TOKENS=full`, `CAMELID_Q8_0_FILE_CACHE_BYTES=0`, `CAMELID_FORWARD_MEMORY_TRACE=1`, `CAMELID_FORWARD_RSS_TIMINGS=1`, `RAYON_NUM_THREADS=4`.

Result:

- Diagnostic PASS: `prompt_tokens_match=true`, `generated_tokens_match=true`, `generated_text_match=true`.
- Reference prompt tokens/context: `881` / `1024`.
- `pack.stderr.log` elapsed wall time: `4:23.03`, exit status `0`.
- Backend final trace at `logits_done`: `q8_file_read_bytes=47287878912` (`45097.24 MiB`), cache hits/bytes `0`, backend RSS `1050748 KiB`.
- Compared with the prior default chunk-128 1024 diagnostic (`target/remote-llama3-8b-context-1024-4c30c53-20260506T051812Z/`), this current-head full-prompt probe reduced final traced Q8 file reads from `91781055744` bytes (`87529.24 MiB`) to `47287878912` bytes (`45097.24 MiB`) and elapsed from `32:43.10` to `4:23.03`, with higher backend RSS at logits (~`1050748 KiB` vs ~`890068 KiB`).

Remote SHA256s:

- `run.env.txt`: `5eccbdb0fac6797174719e08e5f49a12aed3de0280b2d59ac2a6a9d42251fef1`
- `pack/summary.json`: `d90b519c367b05bec7a0f6791839a32eff56d7f1d7c8e2f2435b8c96c12c0143`
- `backend.log`: `cfc1ffabb4d7111e324e472c88e0fd5b753038ad523f2ec91bc831317e301fc9`
- `pack.stdout.log`: `349918ffb1f06408e7d66e8d19f84d19cc5b259efa72f92c7c6905bc87ba8d5c`
- `pack.stderr.log`: `ad61aea2920a9257a36e0cb202a71dfb746e37f963ea425f3db096e9f55b27f2`

Claim boundary: this is performance/correctness diagnostic evidence for one exact 8B 1024 prompt pack on current head. 8B 1024/2048 remain red in public support surfaces until promotion artifacts are deliberately reviewed and docs/API/frontend are aligned in the same change window.
