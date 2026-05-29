# 2026-05-06 — Layer-major prefill hidden-buffer reuse

Scope: diagnostic/performance structural headroom only. This does not promote 8B 1024/2048 support and does not widen docs/API/frontend claims.

Starting state:

- Current main/head at start of this slice: `f3aa2b8c2c35` (`Add current-head 8B context evidence`).
- Local active-run check found no existing long 8B benchmark process; only an idle local backend and frontend preview were present.
- Canonical Ubuntu lane check found no active long 8B validation process to duplicate; only older idle servers/previews and a stale watcher for a completed diagnostic remained visible.

Change:

- Reused the layer-major prefill hidden/output buffer across transformer layers with a double-buffer swap.
- This removes one full hidden-state `Vec<f32>` allocation/zero-fill per layer in the lazy Q8 layer-major prefill path while preserving chunking, Q8 file reads/cache policy, KV writes, tensor shape, output layout, and exact support boundaries.
- No docs, API, capabilities, frontend support claims, or model rows were widened.

Local evidence artifact:

- `target/overnight-all-models-fixer-20260506T222007Z-head-f3aa2b8c2c35/`
  - `preflight.log`
  - `gates.command.txt`
  - `gates.log`
  - `gates.status` = `PASS`
  - `SHA256SUMS`

Local gates:

- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh test -q prefill --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_batch_matmul_reuses_chunk_reads_across_input_rows --lib`
- `./scripts/with-rustup-cargo.sh test -q q8_0_file_backed_borrowed_batch_matmul_reuses_chunk_reads_across_input_rows --lib`
- `./scripts/with-rustup-cargo.sh test -q`
- `./scripts/with-rustup-cargo.sh clippy -q --all-targets -- -D warnings`
- `bash scripts/check-public-scrub.sh`
- `./scripts/with-rustup-cargo.sh test -q capabilities_report_support_contract_and_planned_lanes --test api_vertical_slice`
- `(cd frontend && npm run smoke:model-state)`

Claim boundary: allocation-reuse only. 8B 1024/2048 remain bounded exact-row pack claims only where current-head PASS artifacts and docs/API/frontend agreement exist; this patch adds no new support claim.
