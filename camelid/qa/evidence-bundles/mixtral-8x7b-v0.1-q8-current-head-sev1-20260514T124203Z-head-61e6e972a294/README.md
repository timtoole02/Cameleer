# Mixtral current-head SEV-1 validation lane — 20260514T124203Z

Exact row: `Mixtral-8x7B-Instruct-v0.1.Q8_0.gguf` on Camelid current main head `61e6e972a294`.

This bundle treats Mixtral as a first-class **active validation lane**, but it **does not promote Mixtral support**.

## Readiness

- Ubuntu host disk/readiness was adequate: `/dev/root` had 193G total / 88G available / 55% used, inodes 1% used, and 121GiB memory available (`host-readiness.txt`).
- Model checksum: `cdca4a8c09dfd722702f781d479695cda0d45e1bd1cd602ba1b6085ad921fc5f` (`model-sha256.txt`).
- Metadata confirms sparse MoE shape: `llama.expert_count=8`, `llama.expert_used_count=2`, 32 blocks, Q8_0 expert tensors and F16 router tensors (`metadata-summary.json`).

## Fresh current-head evidence

- Tokenizer/template fixture check passed: `mixtral_reference_pack_records_required_prompt_shapes_and_tokens`.
- Real tokenizer parity check failed: `encodes_mixtral_real_prompts_like_llama_cpp_when_available` exited 101 with `raw_hello` mismatch: Camelid `[1, 22557]` vs expected llama.cpp `[1, 16230]` (`tests/tokenizer-real-llama-cpp.log`).
- MoE/router/expert-loading checks passed: `softmax_top_k_preserves_full_router_softmax_weights`, `mixtral_moe_ffn_routes_top_k_experts`, and `binds_mixtral_moe_metadata_and_expert_tensors`.
- API smoke and short/medium/long generation returned HTTP 200 (`generation/*.response`), with RSS/timing in `rss-samples.tsv` and `generation/*.time`.
- WebUI readiness is not promoted: `model-state-smoke` passed, but `npm run build` and `frontend-integration-smoke` failed on Ubuntu Node v18.19.1 because Vite/Rolldown require Node >=20.19 / >=22.12 (`frontend/`).
- llama.cpp generation reference did not run: current llama.cpp exited 1 with `missing tensor 'blk.0.ffn_down_exps.weight'` for this sparse-expert GGUF naming (`reference/*.time`).

## Support boundary

Failure-case rule: tokenizer parity failure, llama.cpp reference-load failure, frontend runtime failure, or lack of generated-token parity keeps this exact row at **active validation / blocked** only. No broad Mixtral, neighboring-row, API/WebUI/frontend readiness, long-context, production-throughput, portability, or full-support claim is made by this artifact.

See `summary.json` for machine-readable findings and `SHA256SUMS` for file integrity.
