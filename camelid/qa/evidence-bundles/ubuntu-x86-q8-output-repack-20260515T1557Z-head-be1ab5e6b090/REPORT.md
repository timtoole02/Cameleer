# Ubuntu x86_64 Q8 output projection runtime-pack slice evidence

## Scope
- Dense Llama Q8_0, Ubuntu x86_64 only.
- Default-off gate: CAMELID_X86_Q8_REPACK.
- Slice: include output.weight in backend-owned Q8_0 runtime-packed rows4 storage, with file-backed fallback when flag is off.

## Camelid changes
- src/tensor/mod.rs:q8_repack_tensor_enabled keeps non-x86 paths constrained while allowing x86-gated families.
- src/tensor/mod.rs:q8_repack_x86_tensor_enabled now includes output.weight alongside dense blk.* attention/FFN families.
- src/tensor/mod.rs:q8_repack_linear_shape maps output.weight [hidden, vocab] to runtime rows [vocab, hidden].
- tests/tensor_store.rs:x86_q8_repack_loads_output_projection_as_token_major_packed_runtime verifies fallback off, runtime storage on.

## llama.cpp source inspection anchors
- ggml/src/ggml-cpu/arch/x86/quants.c:ggml_vec_dot_q8_0_q8_0 uses AVX2 int8 pair multiply + hsum with scalar fallback.
- ggml/src/ggml-cpu/arch/x86/repack.cpp:block_q8_0x4 paths show x86 packed Q8 block layout/dot loops.
- ggml/src/ggml-cpu/ggml-cpu.c:ggml_compute_forward_mul_mat and ggml_get_n_tasks schedule MUL_MAT across n_threads/OpenMP/threadpool.
- ggml/src/CMakeLists.txt and ggml/src/ggml-cpu/CMakeLists.txt enumerate AVX2/AVX512/VNNI and OpenMP CPU backend variants.

## Ubuntu validation
- Host: ubuntu@<validation-host> via <operator-key-path>
- Remote worktree: <ubuntu-workdir>/camelid-ubuntu-x86-q8-output-repack-20260515T1557Z-head-be1ab5e6b090
- rustc: 1.95.0; cargo: 1.95.0
- cargo test -q q8_x86_repack: PASS (2 tests)
- cargo test -q x86_q8_repack_loads_output_projection_as_token_major_packed_runtime: PASS (1 integration test)

## Notes
- No Mac/Apple/Metal/Mixtral evidence used.
- Pre-existing staged src/inference.rs changes were left untouched and are not part of this slice.
