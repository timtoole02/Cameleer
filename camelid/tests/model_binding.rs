use std::{fs, path::Path};

use camelid::{
    gguf::read_metadata,
    inference::LlamaKvCachePlan,
    model::{LlamaFfnTensors, LlamaModelConfig, LlamaMoeExpertTensors, LlamaTensorBinding},
};

#[test]
fn extracts_dense_llama_model_config() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("llama.gguf");
    write_llama_gguf(&path, true);

    let gguf = read_metadata(&path).unwrap();
    let config = LlamaModelConfig::from_gguf(&gguf).unwrap();

    assert_eq!(config.context_length, 128);
    assert_eq!(config.embedding_length, 8);
    assert_eq!(config.block_count, 1);
    assert_eq!(config.feed_forward_length, 16);
    assert_eq!(config.attention_head_count, 2);
    assert_eq!(config.attention_head_count_kv, 1);
    assert_eq!(config.rope_dimension_count, Some(4));
    assert_eq!(config.rope_freq_base, Some(10_000.0));
    assert_eq!(config.rms_norm_epsilon, 1e-6);
    assert_eq!(config.vocab_size, Some(4));
    assert_eq!(config.file_type, Some(0));
}

#[test]
fn defaults_missing_kv_heads_to_attention_heads_for_tinyllama_style_metadata() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tinyllama-no-kv-heads.gguf");
    write_llama_gguf_without_kv_head_metadata(&path);

    let gguf = read_metadata(&path).unwrap();
    let config = LlamaModelConfig::from_gguf(&gguf).unwrap();
    let binding = LlamaTensorBinding::bind(&gguf, &config).unwrap();
    let cache_plan = LlamaKvCachePlan::from_config(&config).unwrap();

    assert_eq!(config.attention_head_count, 2);
    assert_eq!(config.attention_head_count_kv, config.attention_head_count);
    assert_eq!(config.rope_dimension_count, Some(4));
    assert_eq!(config.rope_freq_base, Some(10_000.0));
    assert_eq!(binding.layers[0].attention_k.dimensions, vec![8, 8]);
    assert_eq!(binding.layers[0].attention_v.dimensions, vec![8, 8]);
    assert_eq!(cache_plan.kv_head_count, 2);
    assert_eq!(cache_plan.head_dim, 4);
    assert_eq!(cache_plan.key_shape, vec![1, 128, 2, 4]);
}

#[test]
fn accepts_mistral_metadata_on_llama_dense_runtime() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mistral.gguf");
    write_mistral_gguf(&path);

    let gguf = read_metadata(&path).unwrap();
    let config = LlamaModelConfig::from_gguf(&gguf).unwrap();
    let binding = LlamaTensorBinding::bind(&gguf, &config).unwrap();
    let cache_plan = LlamaKvCachePlan::from_config(&config).unwrap();

    assert_eq!(gguf.architecture(), Some("mistral"));
    assert_eq!(config.context_length, 128);
    assert_eq!(config.embedding_length, 8);
    assert_eq!(config.attention_head_count, 2);
    assert_eq!(config.attention_head_count_kv, 1);
    assert_eq!(config.rope_dimension_count, Some(4));
    assert_eq!(config.rope_freq_base, Some(10_000.0));
    assert_eq!(config.rms_norm_epsilon, 1e-6);
    assert_eq!(binding.layers[0].attention_q.name, "blk.0.attn_q.weight");
    assert_eq!(binding.layers[0].attention_k.dimensions, vec![8, 4]);
    assert_eq!(cache_plan.kv_head_count, 1);
    assert_eq!(cache_plan.head_dim, 4);
}

#[test]
fn binds_mixtral_moe_metadata_and_expert_tensors() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("mixtral-moe.gguf");
    write_mixtral_moe_gguf(&path);

    let gguf = read_metadata(&path).unwrap();
    let config = LlamaModelConfig::from_gguf(&gguf).unwrap();
    let binding = LlamaTensorBinding::bind(&gguf, &config).unwrap();
    let moe = config.moe.as_ref().unwrap();

    assert_eq!(moe.family_label, "Mixtral");
    assert_eq!(moe.expert_count, 8);
    assert_eq!(moe.expert_used_count, 2);
    match &binding.layers[0].ffn {
        LlamaFfnTensors::MoE {
            router,
            gate_experts,
            up_experts,
            down_experts,
        } => {
            assert_eq!(router.name, "blk.0.ffn_gate_inp.weight");
            assert!(
                matches!(gate_experts, LlamaMoeExpertTensors::Merged(desc) if desc.name == "blk.0.ffn_gate_exps.weight")
            );
            assert!(
                matches!(up_experts, LlamaMoeExpertTensors::Merged(desc) if desc.name == "blk.0.ffn_up_exps.weight")
            );
            assert!(
                matches!(down_experts, LlamaMoeExpertTensors::Merged(desc) if desc.name == "blk.0.ffn_down_exps.weight")
            );
        }
        LlamaFfnTensors::Dense { .. } => panic!("expected Mixtral MoE FFN tensors"),
    }
}

#[test]
fn accepts_llama3_style_gqa_metadata_and_rope_theta() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("llama3-gqa.gguf");
    write_scaled_llama3_style_gqa_gguf(&path);

    let gguf = read_metadata(&path).unwrap();
    let config = LlamaModelConfig::from_gguf(&gguf).unwrap();
    let binding = LlamaTensorBinding::bind(&gguf, &config).unwrap();
    let cache_plan = LlamaKvCachePlan::from_config(&config).unwrap();

    assert_eq!(config.context_length, 8192);
    assert_eq!(config.embedding_length, 32);
    assert_eq!(config.attention_head_count, 8);
    assert_eq!(config.attention_head_count_kv, 2);
    assert_eq!(config.rope_dimension_count, Some(4));
    assert_eq!(config.rope_freq_base, Some(500_000.0));
    assert_eq!(config.rope_scaling_type.as_deref(), Some("llama3"));
    assert_eq!(config.rope_scaling_factor, Some(32.0));
    assert_eq!(config.rope_scaling_original_context_length, Some(8192));
    assert_eq!(config.rope_scaling_low_freq_factor, Some(1.0));
    assert_eq!(config.rope_scaling_high_freq_factor, Some(4.0));
    assert_eq!(
        binding.rope_freqs.as_ref().unwrap().name,
        "rope_freqs.weight"
    );
    assert_eq!(binding.rope_freqs.as_ref().unwrap().dimensions, vec![2]);
    assert_eq!(binding.layers[0].attention_q.dimensions, vec![32, 32]);
    assert_eq!(binding.layers[0].attention_k.dimensions, vec![32, 8]);
    assert_eq!(binding.layers[0].attention_v.dimensions, vec![32, 8]);
    assert_eq!(cache_plan.kv_head_count, 2);
    assert_eq!(cache_plan.head_dim, 4);
    assert_eq!(cache_plan.key_shape, vec![1, 8192, 2, 4]);
}

#[test]
fn infers_vocab_size_from_real_gguf_token_embedding_shape_when_metadata_is_absent() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("llama.gguf");
    write_llama_gguf_without_vocab_metadata(&path);

    let gguf = read_metadata(&path).unwrap();
    let config = LlamaModelConfig::from_gguf(&gguf).unwrap();
    let binding = LlamaTensorBinding::bind(&gguf, &config).unwrap();

    assert_eq!(config.vocab_size, Some(4));
    assert_eq!(binding.token_embedding.name, "token_embd.weight");
}

#[test]
fn binds_required_llama_tensors() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("llama.gguf");
    write_llama_gguf(&path, true);

    let gguf = read_metadata(&path).unwrap();
    let config = LlamaModelConfig::from_gguf(&gguf).unwrap();
    let binding = LlamaTensorBinding::bind(&gguf, &config).unwrap();

    assert_eq!(binding.token_embedding.name, "token_embd.weight");
    assert_eq!(binding.output_norm.name, "output_norm.weight");
    assert_eq!(binding.output.name, "output.weight");
    assert!(!binding.output_is_tied_embedding);
    assert_eq!(binding.layers.len(), 1);
    assert_eq!(binding.layers[0].attention_q.name, "blk.0.attn_q.weight");
    match &binding.layers[0].ffn {
        LlamaFfnTensors::Dense { down, .. } => assert_eq!(down.name, "blk.0.ffn_down.weight"),
        LlamaFfnTensors::MoE { .. } => panic!("expected dense FFN tensors"),
    }
}

#[test]
fn falls_back_to_tied_output_embedding_when_output_weight_is_absent() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("llama.gguf");
    write_llama_gguf(&path, false);

    let gguf = read_metadata(&path).unwrap();
    let config = LlamaModelConfig::from_gguf(&gguf).unwrap();
    let binding = LlamaTensorBinding::bind(&gguf, &config).unwrap();

    assert!(binding.output_is_tied_embedding);
    assert_eq!(binding.output.name, "token_embd.weight");
}

#[test]
fn reports_missing_required_tensor_by_name() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("llama.gguf");
    write_llama_gguf_missing_attention_q(&path);

    let gguf = read_metadata(&path).unwrap();
    let config = LlamaModelConfig::from_gguf(&gguf).unwrap();
    let err = LlamaTensorBinding::bind(&gguf, &config)
        .unwrap_err()
        .to_string();

    assert!(err.contains("blk.0.attn_q.weight"));
}

#[test]
fn rejects_descriptor_shape_that_cannot_feed_dense_path() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("llama.gguf");
    write_llama_gguf_with_bad_attention_k_shape(&path);

    let gguf = read_metadata(&path).unwrap();
    let config = LlamaModelConfig::from_gguf(&gguf).unwrap();
    let err = LlamaTensorBinding::bind(&gguf, &config)
        .unwrap_err()
        .to_string();

    assert!(err.contains("attention k"));
    assert!(err.contains("blk.0.attn_k.weight"));
}

#[test]
fn rejects_dense_config_when_attention_heads_do_not_divide_embedding() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("llama.gguf");
    write_llama_gguf(&path, true);

    let gguf = read_metadata(&path).unwrap();
    let mut config = LlamaModelConfig::from_gguf(&gguf).unwrap();
    config.attention_head_count = 3;
    let err = LlamaTensorBinding::bind(&gguf, &config)
        .unwrap_err()
        .to_string();

    assert!(err.contains("embedding length 8"));
    assert!(err.contains("attention head count 3"));
}

#[test]
fn rejects_dense_config_when_vocab_size_is_missing() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("llama.gguf");
    write_llama_gguf(&path, true);

    let gguf = read_metadata(&path).unwrap();
    let mut config = LlamaModelConfig::from_gguf(&gguf).unwrap();
    config.vocab_size = None;
    let err = LlamaTensorBinding::bind(&gguf, &config)
        .unwrap_err()
        .to_string();

    assert!(err.contains("llama.vocab_size"));
    assert!(err.contains("dense tensor validation"));
}

fn write_llama_gguf(path: &Path, include_output: bool) {
    write_llama_gguf_with_skip(path, include_output, None);
}

fn write_llama_gguf_without_vocab_metadata(path: &Path) {
    write_llama_gguf_with_options(path, true, None, None, false, true, true);
}

fn write_llama_gguf_without_kv_head_metadata(path: &Path) {
    write_llama_gguf_with_options(path, true, None, None, true, false, false);
}

fn write_llama_gguf_missing_attention_q(path: &Path) {
    write_llama_gguf_with_skip(path, true, Some("blk.0.attn_q.weight"));
}

fn write_llama_gguf_with_bad_attention_k_shape(path: &Path) {
    write_llama_gguf_with_shape_override(
        path,
        true,
        None,
        Some(("blk.0.attn_k.weight", vec![8, 3])),
    );
}

fn write_mistral_gguf(path: &Path) {
    write_architecture_prefixed_gguf(path, "mistral", 128, 8, 16, 2, Some(1), 4, 10_000.0, 1e-6);
}

fn write_mixtral_moe_gguf(path: &Path) {
    let tensors: Vec<(&str, Vec<i64>)> = vec![
        ("token_embd.weight", vec![8, 4]),
        ("output_norm.weight", vec![8]),
        ("blk.0.attn_norm.weight", vec![8]),
        ("blk.0.attn_q.weight", vec![8, 8]),
        ("blk.0.attn_k.weight", vec![8, 4]),
        ("blk.0.attn_v.weight", vec![8, 4]),
        ("blk.0.attn_output.weight", vec![8, 8]),
        ("blk.0.ffn_norm.weight", vec![8]),
        ("blk.0.ffn_gate_inp.weight", vec![8, 8]),
        ("blk.0.ffn_gate_exps.weight", vec![8, 16, 8]),
        ("blk.0.ffn_up_exps.weight", vec![8, 16, 8]),
        ("blk.0.ffn_down_exps.weight", vec![16, 8, 8]),
        ("output.weight", vec![8, 4]),
    ];

    let mut b = Vec::new();
    b.extend_from_slice(b"GGUF");
    push_u32(&mut b, 3);
    push_i64(&mut b, tensors.len() as i64);
    push_i64(&mut b, 15);

    push_kv_string(&mut b, "general.architecture", "llama");
    push_kv_string(&mut b, "general.name", "Mixtral 8x7B Instruct v0.1");
    push_kv_string(&mut b, "general.basename", "Mixtral");
    push_kv_u32(&mut b, "general.file_type", 7);
    push_kv_u32(&mut b, "llama.context_length", 128);
    push_kv_u32(&mut b, "llama.embedding_length", 8);
    push_kv_u32(&mut b, "llama.block_count", 1);
    push_kv_u32(&mut b, "llama.feed_forward_length", 16);
    push_kv_u32(&mut b, "llama.attention.head_count", 2);
    push_kv_u32(&mut b, "llama.attention.head_count_kv", 1);
    push_kv_u32(&mut b, "llama.rope.dimension_count", 4);
    push_kv_f32(&mut b, "llama.rope.freq_base", 10_000.0);
    push_kv_f32(&mut b, "llama.attention.layer_norm_rms_epsilon", 1e-6);
    push_kv_u32(&mut b, "llama.expert_count", 8);
    push_kv_u32(&mut b, "llama.expert_used_count", 2);

    let mut relative_offset = 0u64;
    for (name, dims) in &tensors {
        push_string(&mut b, name);
        push_u32(&mut b, dims.len() as u32);
        for dim in dims {
            push_i64(&mut b, *dim);
        }
        push_i32(&mut b, 0); // f32
        push_u64(&mut b, relative_offset);
        relative_offset += dims.iter().product::<i64>() as u64 * 4;
    }

    while !b.len().is_multiple_of(32) {
        b.push(0);
    }
    b.extend(vec![0u8; relative_offset as usize]);
    fs::write(path, b).unwrap();
}

#[allow(clippy::too_many_arguments)]
fn write_architecture_prefixed_gguf(
    path: &Path,
    architecture: &str,
    context_length: u32,
    embedding_length: u32,
    feed_forward_length: u32,
    attention_head_count: u32,
    attention_head_count_kv: Option<u32>,
    rope_dimension_count: u32,
    rope_freq_base: f32,
    rms_norm_epsilon: f32,
) {
    let kv_width = (embedding_length as usize
        * attention_head_count_kv.unwrap_or(attention_head_count) as usize)
        / attention_head_count as usize;
    let tensors: Vec<(&str, Vec<i64>)> = vec![
        ("token_embd.weight", vec![4, embedding_length as i64]),
        ("output_norm.weight", vec![embedding_length as i64]),
        ("blk.0.attn_norm.weight", vec![embedding_length as i64]),
        (
            "blk.0.attn_q.weight",
            vec![embedding_length as i64, embedding_length as i64],
        ),
        (
            "blk.0.attn_k.weight",
            vec![embedding_length as i64, kv_width as i64],
        ),
        (
            "blk.0.attn_v.weight",
            vec![embedding_length as i64, kv_width as i64],
        ),
        (
            "blk.0.attn_output.weight",
            vec![embedding_length as i64, embedding_length as i64],
        ),
        ("blk.0.ffn_norm.weight", vec![embedding_length as i64]),
        (
            "blk.0.ffn_gate.weight",
            vec![embedding_length as i64, feed_forward_length as i64],
        ),
        (
            "blk.0.ffn_up.weight",
            vec![embedding_length as i64, feed_forward_length as i64],
        ),
        (
            "blk.0.ffn_down.weight",
            vec![feed_forward_length as i64, embedding_length as i64],
        ),
        ("output.weight", vec![embedding_length as i64, 4]),
    ];

    let mut b = Vec::new();
    b.extend_from_slice(b"GGUF");
    push_u32(&mut b, 3);
    push_i64(&mut b, tensors.len() as i64);
    push_i64(&mut b, 11 + i64::from(attention_head_count_kv.is_some()));

    push_kv_string(&mut b, "general.architecture", architecture);
    push_kv_u32(&mut b, "general.file_type", 0);
    push_kv_u32(
        &mut b,
        &format!("{architecture}.context_length"),
        context_length,
    );
    push_kv_u32(
        &mut b,
        &format!("{architecture}.embedding_length"),
        embedding_length,
    );
    push_kv_u32(&mut b, &format!("{architecture}.block_count"), 1);
    push_kv_u32(
        &mut b,
        &format!("{architecture}.feed_forward_length"),
        feed_forward_length,
    );
    push_kv_u32(
        &mut b,
        &format!("{architecture}.attention.head_count"),
        attention_head_count,
    );
    if let Some(kv_heads) = attention_head_count_kv {
        push_kv_u32(
            &mut b,
            &format!("{architecture}.attention.head_count_kv"),
            kv_heads,
        );
    }
    push_kv_u32(
        &mut b,
        &format!("{architecture}.rope.dimension_count"),
        rope_dimension_count,
    );
    push_kv_f32(
        &mut b,
        &format!("{architecture}.rope.freq_base"),
        rope_freq_base,
    );
    push_kv_f32(
        &mut b,
        &format!("{architecture}.attention.layer_norm_rms_epsilon"),
        rms_norm_epsilon,
    );
    push_kv_u32(&mut b, &format!("{architecture}.vocab_size"), 4);

    let mut relative_offset = 0u64;
    for (name, dims) in &tensors {
        push_string(&mut b, name);
        push_u32(&mut b, dims.len() as u32);
        for dim in dims {
            push_i64(&mut b, *dim);
        }
        push_i32(&mut b, 0);
        push_u64(&mut b, relative_offset);
        relative_offset += dims.iter().product::<i64>() as u64 * 4;
    }

    while !b.len().is_multiple_of(32) {
        b.push(0);
    }
    b.extend(vec![0u8; relative_offset as usize]);
    fs::write(path, b).unwrap();
}

fn write_scaled_llama3_style_gqa_gguf(path: &Path) {
    let tensors: Vec<(&str, Vec<i64>)> = vec![
        ("token_embd.weight", vec![4, 32]),
        ("rope_freqs.weight", vec![2]),
        ("output_norm.weight", vec![32]),
        ("blk.0.attn_norm.weight", vec![32]),
        ("blk.0.attn_q.weight", vec![32, 32]),
        ("blk.0.attn_k.weight", vec![32, 8]),
        ("blk.0.attn_v.weight", vec![32, 8]),
        ("blk.0.attn_output.weight", vec![32, 32]),
        ("blk.0.ffn_norm.weight", vec![32]),
        ("blk.0.ffn_gate.weight", vec![32, 64]),
        ("blk.0.ffn_up.weight", vec![32, 64]),
        ("blk.0.ffn_down.weight", vec![64, 32]),
        ("output.weight", vec![32, 4]),
    ];

    let mut b = Vec::new();
    b.extend_from_slice(b"GGUF");
    push_u32(&mut b, 3);
    push_i64(&mut b, tensors.len() as i64);
    push_i64(&mut b, 17);

    push_kv_string(&mut b, "general.architecture", "llama");
    push_kv_u32(&mut b, "general.file_type", 0);
    push_kv_u32(&mut b, "llama.context_length", 8192);
    push_kv_u32(&mut b, "llama.embedding_length", 32);
    push_kv_u32(&mut b, "llama.block_count", 1);
    push_kv_u32(&mut b, "llama.feed_forward_length", 64);
    push_kv_u32(&mut b, "llama.attention.head_count", 8);
    push_kv_u32(&mut b, "llama.attention.head_count_kv", 2);
    push_kv_u32(&mut b, "llama.rope.dimension_count", 4);
    push_kv_f32(&mut b, "llama.rope.freq_base", 500_000.0);
    push_kv_string(&mut b, "llama.rope.scaling.type", "llama3");
    push_kv_f32(&mut b, "llama.rope.scaling.factor", 32.0);
    push_kv_u32(&mut b, "llama.rope.scaling.original_context_length", 8192);
    push_kv_f32(&mut b, "llama.rope.scaling.low_freq_factor", 1.0);
    push_kv_f32(&mut b, "llama.rope.scaling.high_freq_factor", 4.0);
    push_kv_f32(&mut b, "llama.attention.layer_norm_rms_epsilon", 1e-5);
    push_kv_u32(&mut b, "llama.vocab_size", 4);

    let mut relative_offset = 0u64;
    for (name, dims) in &tensors {
        push_string(&mut b, name);
        push_u32(&mut b, dims.len() as u32);
        for dim in dims {
            push_i64(&mut b, *dim);
        }
        push_i32(&mut b, 0); // f32
        push_u64(&mut b, relative_offset);
        relative_offset += dims.iter().product::<i64>() as u64 * 4;
        while !relative_offset.is_multiple_of(32) {
            relative_offset += 1;
        }
    }

    while !b.len().is_multiple_of(32) {
        b.push(0);
    }
    b.extend(vec![0u8; relative_offset as usize]);
    fs::write(path, b).unwrap();
}

fn write_llama_gguf_with_skip(path: &Path, include_output: bool, skip: Option<&str>) {
    write_llama_gguf_with_shape_override(path, include_output, skip, None);
}

fn write_llama_gguf_with_shape_override(
    path: &Path,
    include_output: bool,
    skip: Option<&str>,
    shape_override: Option<(&str, Vec<i64>)>,
) {
    write_llama_gguf_with_options(
        path,
        include_output,
        skip,
        shape_override,
        true,
        false,
        true,
    );
}

fn write_llama_gguf_with_options(
    path: &Path,
    include_output: bool,
    skip: Option<&str>,
    shape_override: Option<(&str, Vec<i64>)>,
    include_vocab_metadata: bool,
    real_gguf_embedding_order: bool,
    include_kv_head_metadata: bool,
) {
    let token_embedding_shape = if real_gguf_embedding_order {
        vec![8, 4]
    } else {
        vec![4, 8]
    };
    let mut tensors: Vec<(&str, Vec<i64>)> = vec![
        ("token_embd.weight", token_embedding_shape),
        ("output_norm.weight", vec![8]),
        ("blk.0.attn_norm.weight", vec![8]),
        ("blk.0.attn_q.weight", vec![8, 8]),
        (
            "blk.0.attn_k.weight",
            if include_kv_head_metadata {
                vec![8, 4]
            } else {
                vec![8, 8]
            },
        ),
        (
            "blk.0.attn_v.weight",
            if include_kv_head_metadata {
                vec![8, 4]
            } else {
                vec![8, 8]
            },
        ),
        ("blk.0.attn_output.weight", vec![8, 8]),
        ("blk.0.ffn_norm.weight", vec![8]),
        ("blk.0.ffn_gate.weight", vec![8, 16]),
        ("blk.0.ffn_up.weight", vec![8, 16]),
        ("blk.0.ffn_down.weight", vec![16, 8]),
    ];
    if include_output {
        tensors.push(("output.weight", vec![8, 4]));
    }
    if let Some((override_name, override_dims)) = shape_override {
        for (name, dims) in &mut tensors {
            if *name == override_name {
                *dims = override_dims.clone();
            }
        }
    }
    tensors.retain(|(name, _)| Some(*name) != skip);

    let mut b = Vec::new();
    b.extend_from_slice(b"GGUF");
    push_u32(&mut b, 3);
    push_i64(&mut b, tensors.len() as i64);
    let metadata_count =
        10 + u64::from(include_kv_head_metadata) + u64::from(include_vocab_metadata);
    push_i64(&mut b, metadata_count as i64);

    push_kv_string(&mut b, "general.architecture", "llama");
    push_kv_u32(&mut b, "general.file_type", 0);
    push_kv_u32(&mut b, "llama.context_length", 128);
    push_kv_u32(&mut b, "llama.embedding_length", 8);
    push_kv_u32(&mut b, "llama.block_count", 1);
    push_kv_u32(&mut b, "llama.feed_forward_length", 16);
    push_kv_u32(&mut b, "llama.attention.head_count", 2);
    if include_kv_head_metadata {
        push_kv_u32(&mut b, "llama.attention.head_count_kv", 1);
    }
    push_kv_u32(&mut b, "llama.rope.dimension_count", 4);
    push_kv_f32(&mut b, "llama.rope.freq_base", 10_000.0);
    push_kv_f32(&mut b, "llama.attention.layer_norm_rms_epsilon", 1e-6);
    if include_vocab_metadata {
        push_kv_u32(&mut b, "llama.vocab_size", 4);
    }

    let mut relative_offset = 0u64;
    for (name, dims) in &tensors {
        push_string(&mut b, name);
        push_u32(&mut b, dims.len() as u32);
        for dim in dims {
            push_i64(&mut b, *dim);
        }
        push_i32(&mut b, 0); // f32
        push_u64(&mut b, relative_offset);
        relative_offset += dims.iter().product::<i64>() as u64 * 4;
    }

    while !b.len().is_multiple_of(32) {
        b.push(0);
    }
    b.extend(vec![0u8; relative_offset as usize]);
    fs::write(path, b).unwrap();
}

fn push_kv_string(b: &mut Vec<u8>, key: &str, value: &str) {
    push_string(b, key);
    push_i32(b, 8);
    push_string(b, value);
}

fn push_kv_u32(b: &mut Vec<u8>, key: &str, value: u32) {
    push_string(b, key);
    push_i32(b, 4);
    push_u32(b, value);
}

fn push_kv_f32(b: &mut Vec<u8>, key: &str, value: f32) {
    push_string(b, key);
    push_i32(b, 6);
    b.extend_from_slice(&value.to_le_bytes());
}

fn push_string(b: &mut Vec<u8>, value: &str) {
    push_u64(b, value.len() as u64);
    b.extend_from_slice(value.as_bytes());
}

fn push_u32(b: &mut Vec<u8>, value: u32) {
    b.extend_from_slice(&value.to_le_bytes());
}

fn push_i32(b: &mut Vec<u8>, value: i32) {
    b.extend_from_slice(&value.to_le_bytes());
}

fn push_u64(b: &mut Vec<u8>, value: u64) {
    b.extend_from_slice(&value.to_le_bytes());
}

fn push_i64(b: &mut Vec<u8>, value: i64) {
    b.extend_from_slice(&value.to_le_bytes());
}
