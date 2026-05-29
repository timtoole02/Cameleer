# Llama 3.2 1B long-context RoPE frequency runtime slice — 2026-05-05

Scope: code/runtime investigation slice for the exact Llama 3.2 1B Instruct Q8_0 2048-context first-token divergence. This does not promote a fresh 2048 parity pass by itself.

Finding: the stored Llama 3.2 1B Q8_0 evidence bundle includes a GGUF `rope_freqs.weight` tensor with 32 F32 RoPE frequency factors for the 64-dimension RoPE path. The first runtime slice bound the tensor, but a follow-up parity proof showed Camelid must interpret those entries like llama.cpp `freq_factors`: divide the metadata-derived RoPE frequency by the stored factor, not replace the derived frequency with the tensor value.

Runtime change: bind/load optional `rope_freqs.weight`, validate its `[rope_dim / 2]` shape and finite positive frequency factors, apply those factors during Q/K RoPE, and expose the frequency source in dense RoPE diagnostics. Metadata-based llama3 scaling remains covered as fallback for GGUFs that carry scaling keys instead of a frequency-factor tensor.

Gates:
- `./scripts/with-rustup-cargo.sh fmt --all -- --check`
- `./scripts/with-rustup-cargo.sh clippy --all-targets --all-features -- -D warnings`
- `./scripts/with-rustup-cargo.sh test --all-targets --all-features`

Targeted coverage:
- `inference::tests::apply_rope_uses_gguf_rope_frequency_factors`
- `inference::tests::apply_rope_uses_llama3_frequency_scaling_metadata`
- `accepts_llama3_style_gqa_metadata_and_rope_theta`
