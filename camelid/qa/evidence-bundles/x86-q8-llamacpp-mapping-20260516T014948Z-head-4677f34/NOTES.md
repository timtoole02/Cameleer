# x86 Q8 llama.cpp ↔ Camelid mapping notes

## Scope
Read-only mapping lane for next Rust-native x86 Q8 ownership slice. Focus: `ffn_down`, then attention projection (Q/K/V/O), scheduler/context-switch overhead, and `CpuTensor::clone` evidence. Rejected: row-dot wrappers / lower-level row GEMM lookalikes.

## Canonical sources
- Camelid local head: `4677f34`
- llama.cpp remote Ubuntu host `<validation-host>`
- llama.cpp head: `3e037f313`

## Major path maps

### 1) Generic mul_mat / CPU dispatch
- **llama.cpp**: `ggml/src/ggml-cpu/ggml-cpu.c`
  - `ggml_compute_forward_mul_mat_one_chunk()` ~1155
  - `ggml_compute_forward_mul_mat()` ~1245
- **Camelid equivalent**:
  - generic f32 fallback: `src/tensor/mod.rs::CpuTensor::matmul()` / `matmul_rhs_transposed()`
  - runtime dispatch: `src/inference.rs::matmul_descriptor_with_precision_with_plan()` and `matmul_rhs_transposed_with_precision_with_plan()`
- **llama.cpp does better**:
  - central backend dispatch on `vec_dot_type`, `from_float`, and `nrows`
  - converts activations to `vec_dot_type` once into thread-local/shared `wdata`
  - chunk scheduler (`current_chunk`) reduces idle threads; adapts chunking for NUMA / poor chunk geometry
  - optional `llamafile_sgemm()` fast path before generic ggml loop
- **Camelid does worse**:
  - no unified GEMM owner for x86 Q8; per-role special cases sit above generic matmul
  - decode consumers re-quantize the input row for each projection cluster instead of using a common matmul owner
  - prefill fused gate+up exists, but `ffn_down` and attention projection stay as separate bespoke paths
- **Port conceptually**:
  - one x86 Q8 matmul owner for `Q8_0 x Q8_0 -> f32`, with a single input quantization/repack and shared work scheduler
  - centralized feature/shape gating near runtime plan instead of role-local duplication
- **Do NOT port**:
  - direct row-dot wrapper strategy or one-projection-at-a-time special cases as the long-term architecture

### 2) Q8_0 tensor handling / block layout / repack
- **llama.cpp**:
  - block layout: `ggml/src/ggml-quants.c` (`Q8_0`, 32 values + fp16 scale)
  - x86 q8 dot: `ggml/src/ggml-cpu/arch/x86/quants.c::ggml_vec_dot_q8_0_q8_0()` ~1170
  - CPU type traits hook: `ggml/src/ggml-cpu/ggml-cpu.c` (q8 vec-dot registration)
  - tinyBLAS q8 GEMM entry: `ggml/src/ggml-cpu/llamafile/sgemm.cpp` ~3932
- **Camelid equivalent**:
  - GGUF/storage layout: `src/gguf/reader.rs`
  - q8 blocks + runtime-packed rows4 sidecar: `src/tensor/mod.rs`
    - `q8_repack_linear_shape()`
    - `q8_0_runtime_packed_rows4_for_tensor()`
    - `CpuTensor::q8_0_runtime_packed_rows4_linear()`
- **llama.cpp does better**:
  - keeps the quantized kernel contract backend-owned: type traits choose vec_dot, activation quantization, and kernel dispatch together
  - tinyBLAS uses tile-aware kernels and threadpool job splitting at GEMM level
- **Camelid does worse**:
  - runtime-packed rows4 exists, but ownership is fragmented across call sites
  - I8 interleave-only packed format is fine for current AVX2 slice, but there is no central GEMM entrypoint that all FFN/attention projections use
- **Port conceptually**:
  - preserve Camelid’s Rust-native packed rows4 storage, but move its consumption behind a single x86 Q8 matmul helper
- **Do NOT port**:
  - direct copy of llama.cpp tinyBLAS code; that would create high-maintenance C++ parity debt

### 3) FFN down
- **llama.cpp**: same `ggml_mul_mat` stack; no role-specific `ffn_down` special case
- **Camelid equivalent**:
  - role dispatch: `src/inference.rs::linear_for_role_runtime_with_plan()`
  - x86 decode consumer: `try_x86_q8_ffn_down_decode_consumer_path()` (~7470)
- **llama.cpp does better**:
  - `ffn_down` is not special; it benefits automatically from the same mul_mat / scheduling / kernel choices as other projections
- **Camelid does worse**:
  - `ffn_down` decode path is another isolated single-row projection using `quantize_q8_0_row()` + `q8_0_packed_rows4_dot()` over 4-row groups
  - duplicates shape checks / output-width derivation / packed-layout validation already present elsewhere
- **Port conceptually**:
  - make `ffn_down` the first consumer of a shared `matmul_rhs_transposed_q8_0_runtime_packed_x86()` helper
  - allow decode and later bounded prefill to share the same input quantization scratch and output-group loop
- **Do NOT port**:
  - more `ffn_down`-specific fast paths layered beside the existing one

### 4) Attention projection (Q/K/V then O)
- **llama.cpp**: same mul_mat stack
- **Camelid equivalent**:
  - Q/K/V fused-ish decode entry: `try_x86_q8_attention_qkv_decode_consumer_path()`
  - per-projection role path: `try_x86_q8_attention_projection_decode_consumer_path()`
  - shared helper: `q8_0_runtime_packed_projection()` and `q8_0_packed_rows4_single_input_projection()`
- **llama.cpp does better**:
  - uses one backend abstraction instead of role strings (`"attention_q"`, etc.)
- **Camelid does worse**:
  - role-string dispatch and per-projection wrappers add branching and duplicate shape logic
  - Q/K/V and O are not yet unified with `ffn_down` under one x86 packed-Q8 owner
- **Port conceptually**:
  - after `ffn_down`, widen the same owner to `attention_projection` roles by passing output shape + packed storage only
- **Do NOT port**:
  - stringly-typed role expansion as the permanent design

### 5) Scheduler / context-switch overhead
- **llama.cpp**:
  - chunk scheduler in `ggml_compute_forward_mul_mat()` uses `current_chunk` atomic work-stealing-ish assignment
  - chunk geometry changes if `nchunk0 * nchunk1 < nth * 4` or NUMA
  - `llamafile` tinyBLAS also uses threadpool jobs (`ggml_threadpool_chunk_set`, barrier, per-job tile ranges)
- **Camelid equivalent**:
  - generic f32 matmul relies on Rayon in `CpuTensor::matmul()` / `matmul_rhs_transposed()`
  - Q8 telemetry counters in `src/inference.rs` (`Q8_SCHED_*`); notable fanout counters near ~9826/~9893
  - decode consumers are serial for one-row projections; prefill fused gate+up packs input then runs dedicated kernel
- **llama.cpp does better**:
  - scheduling is inside the kernel owner, not above it
  - fewer framework/context boundaries once inside CPU backend
- **Camelid does worse**:
  - role-level decode helpers quantize, dispatch, and write back independently; that multiplies call overhead even when arithmetic is similar
  - mixed ownership (Rayon for generic f32, bespoke loops for Q8, telemetry outside kernel) likely increases context-switch / cache churn
- **Port conceptually**:
  - keep one-row decode serial, but share quantized input + output loop across projections inside one owner
  - for bounded prefill, reuse one packed-input scratch and one kernel call per projection family where possible

### 6) Input quantization / reuse / accumulator / writeback
- **llama.cpp**:
  - converts `src1` to `vec_dot_type` once with `from_float(...)` into `params->wdata` when needed
  - q8 vec-dot accumulates int8 products then applies block scale product into f32 accumulator
  - tinyBLAS writes directly into destination tile buffers
- **Camelid equivalent**:
  - decode paths call `quantize_q8_0_row()` per input row
  - prefill fused gate+up path packs all rows once using `quantize_pack_q8_0_rows4_i8_direct_into()` and reuses scratch
  - writeback is scalar copy of 4-result groups into `Vec<f32>` output
- **llama.cpp does better**:
  - activation conversion ownership is centralized and reused by the selected backend path
- **Camelid does worse**:
  - decode Q/K/V/O/FFN-down still quantize independently rather than reusing a row-level packed/quantized input across all same-input projections
- **Port conceptually**:
  - one quantized-input object per source row/chunk, reused across `ffn_down` first, then attention projections

### 7) CpuTensor::clone evidence
- **Camelid evidence**:
  - `CpuTensor` derives `Clone` in `src/tensor/mod.rs`, so cloning copies `data`, block sidecars, runtime storage handles, and file-backing metadata
  - I did **not** find hot-path `weight.clone()`/`hidden.clone()` use around x86 Q8 projection execution
  - notable clones found were diagnostics / metadata (`gate.clone()`, `up.clone()`, dims clone, memory sample option clones)
- **Conclusion**:
  - `CpuTensor::clone` does not look like the first-order blocker for next x86 Q8 slice
  - biggest overhead signal is ownership fragmentation + repeated quantize/dispatch, not obvious tensor cloning in projection hot loops

## Smallest Rust-native default-off slice after 2688bf4 / f23c3f4 evidence
- **Gate name**: `CAMELID_X86_Q8_MATMUL_OWNER=ffn_down`
- **Why this gate**:
  - default-off
  - explicit ownership experiment, not a support claim
  - narrowest slice that removes duplication without reopening rejected row-dot work
- **Files/functions to touch**:
  - `src/inference.rs`
    - add shared helper: `matmul_rhs_transposed_q8_0_runtime_packed_x86_single_input(...)`
    - route `try_x86_q8_ffn_down_decode_consumer_path()` through it first
    - optionally reuse existing `q8_0_runtime_packed_projection()` / `q8_0_packed_rows4_single_input_projection()` instead of bespoke local logic
  - maybe `src/execution_plan.rs`
    - add capability/reason string for the new owner gate if runtime-plan visibility is needed
  - **Do not touch** generic fallback math or public support docs for this slice
- **Implementation shape**:
  - input: one `[1, hidden]` f32 row + runtime-packed Q8 weight
  - quantize input once via existing `quantize_q8_0_row()`
  - iterate packed 4-row groups with existing `q8_0_packed_rows4_dot()`
  - return `CpuTensor::from_f32([1, output_width])`
  - only swap ownership; no new tile format, no lower-level wrapper, no row-dot public surface

## Validation plan
1. unit test: helper output matches current `try_x86_q8_ffn_down_decode_consumer_path()` path for representative widths
2. exact-row parity on Ubuntu x86 for a known Q8 row where `ffn_down` participates in canonical path
3. timing telemetry: compare old/new on single-token decode; require no regression beyond noise or show measurable reduction in per-projection overhead
4. confirm no support-contract drift: gate remains off by default, no README/API/frontend changes

## Retain / reject criteria
- **Retain if**:
  - exact-row parity holds
  - code deletes duplication or clearly centralizes it
  - no regression in bounded decode timing / memory behavior
- **Reject if**:
  - helper becomes another disguised row-dot wrapper family
  - requires new public claims / config surface beyond explicit default-off env gate
  - cannot generalize cleanly to attention projection next

## Licensing / notice concerns
- Concept mapping from llama.cpp is safe.
- If any llama.cpp code is adapted directly, preserve upstream copyright/license notices and record exact provenance/commit (`3e037f313`).
- Recommendation: keep this slice Rust-native and structure-only to avoid notice churn.
