use std::{
    fs,
    path::Path,
    sync::{Arc, Mutex},
};

use camelid::{
    gguf::{read_metadata, GgufTensorType},
    tensor::{CpuTensor, Q8_0Block, Q8_0RuntimeStorage, RuntimeDType, TensorStore},
};

static ENV_LOCK: Mutex<()> = Mutex::new(());

#[test]
fn loads_f32_tensor_payload() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    write_tensor_gguf(
        &path,
        0,
        &[1.0f32.to_le_bytes(), 2.5f32.to_le_bytes()].concat(),
    );

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_cpu_f32("test.weight").unwrap();

    assert_eq!(tensor.shape.dims, vec![2]);
    assert_eq!(tensor.dtype, RuntimeDType::F32);
    assert_eq!(tensor.data, vec![1.0, 2.5]);
}

#[test]
fn loads_f16_tensor_payload_as_f32() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    write_tensor_gguf(
        &path,
        1,
        &[0x3c00u16.to_le_bytes(), 0xc000u16.to_le_bytes()].concat(),
    );

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_cpu_f32("test.weight").unwrap();

    assert_eq!(tensor.data, vec![1.0, -2.0]);
}

#[test]
fn loads_bf16_tensor_payload_as_f32() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    write_tensor_gguf(
        &path,
        30,
        &[0x3f80u16.to_le_bytes(), 0xc000u16.to_le_bytes()].concat(),
    );

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_cpu_f32("test.weight").unwrap();

    assert_eq!(tensor.data, vec![1.0, -2.0]);
}

#[test]
fn loads_q8_0_tensor_payload_as_f32() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    payload.extend_from_slice(&0x3c00u16.to_le_bytes()); // scale 1.0
    payload.extend((0..32).map(|v| v as i8 as u8));
    write_tensor_gguf_with_dims(&path, 8, &[32], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_cpu_f32("test.weight").unwrap();

    assert_eq!(tensor.source_type, Some(GgufTensorType::Q8_0));
    assert_eq!(tensor.data.len(), 32);
    assert_eq!(tensor.data[0], 0.0);
    assert_eq!(tensor.data[31], 31.0);
    assert!(tensor.q8_0_blocks.is_none());
}

#[test]
fn loads_q8_0_file_backed_linear_without_f32_materialization() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    payload.extend_from_slice(&0x3c00u16.to_le_bytes()); // scale 1.0
    payload.extend((0..32).map(|v| v as i8 as u8));
    payload.extend_from_slice(&0x4000u16.to_le_bytes()); // scale 2.0
    payload.extend((0..32).map(|v| (v as i8 - 16) as u8));
    write_tensor_gguf_with_dims(&path, 8, &[32, 2], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_q8_0_file_backed_linear("test.weight").unwrap();

    assert_eq!(tensor.name, "test.weight");
    assert_eq!(tensor.shape.dims, vec![32, 2]);
    assert_eq!(tensor.source_type, Some(GgufTensorType::Q8_0));
    assert!(tensor.data.is_empty());
    assert!(tensor.q8_0_blocks.is_none());
    let backing = tensor.q8_0_file_backing.unwrap();
    assert_eq!(backing.path, path);
    assert_eq!(backing.num_blocks, 2);

    let first = backing.file().unwrap();
    let second = backing.clone().file().unwrap();
    assert!(Arc::ptr_eq(&first, &second));
}

#[test]
fn mac_q8_repack_loads_attn_q_as_packed_runtime_without_row_major_duplicate() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("CAMELID_MAC_Q8_REPACK", "on");
    std::env::remove_var("CAMELID_Q8_0_BLOCK_DOT");
    std::env::remove_var("CAMELID_Q8_0_PACKED_4X8_DOT");

    let tensor_name = "blk.0.attn_q.weight";
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    for block_idx in 0..32 {
        payload.extend_from_slice(&0x3c00u16.to_le_bytes());
        payload.extend((0..32).map(|v| (v as i8).wrapping_add(block_idx as i8) as u8));
    }
    write_named_tensor_gguf_with_dims(&path, tensor_name, 8, &[32, 32], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_q8_0_file_backed_linear(tensor_name).unwrap();

    assert!(
        tensor.data.is_empty(),
        "{tensor_name} materialized f32 data"
    );
    assert!(
        tensor.q8_0_blocks.is_none(),
        "{tensor_name} kept q8_0 blocks"
    );
    assert!(
        tensor.q8_0_file_backing.is_none(),
        "{tensor_name} kept file backing"
    );
    assert!(tensor.q8_0_packed_rows4_4x4.is_none());
    assert!(tensor.q8_0_packed_rows4_4x8.is_none());
    let Q8_0RuntimeStorage::PackedRows4(packed) = tensor.q8_0_runtime_storage.unwrap();
    assert_eq!(packed.rows, 32, "{tensor_name}");
    assert_eq!(packed.blocks_per_row, 1, "{tensor_name}");

    let block_backed_tensor = store.load_q8_0_block_backed_linear(tensor_name).unwrap();
    assert!(
        block_backed_tensor.data.is_empty(),
        "{tensor_name} block-backed materialized f32 data"
    );
    assert!(
        block_backed_tensor.q8_0_blocks.is_none(),
        "{tensor_name} block-backed kept q8_0 blocks"
    );
    assert!(
        block_backed_tensor.q8_0_file_backing.is_none(),
        "{tensor_name} block-backed kept file backing"
    );
    assert!(block_backed_tensor.q8_0_packed_rows4_4x4.is_none());
    assert!(block_backed_tensor.q8_0_packed_rows4_4x8.is_none());
    let Q8_0RuntimeStorage::PackedRows4(packed) = block_backed_tensor.q8_0_runtime_storage.unwrap();
    assert_eq!(packed.rows, 32, "{tensor_name}");
    assert_eq!(packed.blocks_per_row, 1, "{tensor_name}");

    std::env::remove_var("CAMELID_MAC_Q8_REPACK");
}

#[test]
fn mac_q8_repack_loads_attention_kvo_as_packed_runtime_without_row_major_duplicate() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("CAMELID_MAC_Q8_REPACK", "on");
    std::env::remove_var("CAMELID_Q8_0_BLOCK_DOT");
    std::env::remove_var("CAMELID_Q8_0_PACKED_4X8_DOT");

    for tensor_name in [
        "blk.0.attn_k.weight",
        "blk.0.attn_v.weight",
        "blk.0.attn_output.weight",
    ] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tensor.gguf");
        let mut payload = Vec::new();
        for block_idx in 0..32 {
            payload.extend_from_slice(&0x3c00u16.to_le_bytes());
            payload.extend((0..32).map(|v| (v as i8).wrapping_add(block_idx as i8) as u8));
        }
        write_named_tensor_gguf_with_dims(&path, tensor_name, 8, &[32, 32], &payload);

        let gguf = read_metadata(&path).unwrap();
        let store = TensorStore::open(&path, &gguf);
        let tensor = store.load_q8_0_file_backed_linear(tensor_name).unwrap();
        assert!(
            tensor.data.is_empty(),
            "{tensor_name} materialized f32 data"
        );
        assert!(
            tensor.q8_0_blocks.is_none(),
            "{tensor_name} kept q8_0 blocks"
        );
        assert!(
            tensor.q8_0_file_backing.is_none(),
            "{tensor_name} kept file backing"
        );
        assert!(tensor.q8_0_packed_rows4_4x4.is_none());
        assert!(tensor.q8_0_packed_rows4_4x8.is_none());
        let Q8_0RuntimeStorage::PackedRows4(packed) = tensor.q8_0_runtime_storage.unwrap();
        assert_eq!(packed.rows, 32, "{tensor_name}");
        assert_eq!(packed.blocks_per_row, 1, "{tensor_name}");

        let block_backed_tensor = store.load_q8_0_block_backed_linear(tensor_name).unwrap();
        assert!(
            block_backed_tensor.data.is_empty(),
            "{tensor_name} block-backed materialized f32 data"
        );
        assert!(
            block_backed_tensor.q8_0_blocks.is_none(),
            "{tensor_name} block-backed kept q8_0 blocks"
        );
        assert!(
            block_backed_tensor.q8_0_file_backing.is_none(),
            "{tensor_name} block-backed kept file backing"
        );
        assert!(block_backed_tensor.q8_0_packed_rows4_4x4.is_none());
        assert!(block_backed_tensor.q8_0_packed_rows4_4x8.is_none());
        let Q8_0RuntimeStorage::PackedRows4(packed) =
            block_backed_tensor.q8_0_runtime_storage.unwrap();
        assert_eq!(packed.rows, 32, "{tensor_name}");
        assert_eq!(packed.blocks_per_row, 1, "{tensor_name}");
    }

    std::env::remove_var("CAMELID_MAC_Q8_REPACK");
}

#[test]
fn mac_q8_repack_loads_ffn_gate_as_transposed_packed_runtime_without_row_major_duplicate() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("CAMELID_MAC_Q8_REPACK", "on");
    std::env::remove_var("CAMELID_Q8_0_BLOCK_DOT");
    std::env::remove_var("CAMELID_Q8_0_PACKED_4X8_DOT");

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    for block_idx in 0..64 {
        payload.extend_from_slice(&0x3c00u16.to_le_bytes());
        payload.extend((0..32).map(|v| (v as i8).wrapping_add(block_idx as i8) as u8));
    }
    write_named_tensor_gguf_with_dims(&path, "blk.0.ffn_gate.weight", 8, &[32, 64], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store
        .load_q8_0_file_backed_linear("blk.0.ffn_gate.weight")
        .unwrap();

    assert_eq!(tensor.shape.dims, vec![32, 64]);
    assert!(tensor.data.is_empty());
    assert!(tensor.q8_0_blocks.is_none());
    assert!(tensor.q8_0_file_backing.is_none());
    assert!(tensor.q8_0_packed_rows4_4x4.is_none());
    assert!(tensor.q8_0_packed_rows4_4x8.is_none());
    let Q8_0RuntimeStorage::PackedRows4(packed) = tensor.q8_0_runtime_storage.unwrap();
    assert_eq!(packed.rows, 64);
    assert_eq!(packed.blocks_per_row, 1);

    std::env::remove_var("CAMELID_MAC_Q8_REPACK");
}

#[test]
fn mac_q8_repack_loads_ffn_down_as_transposed_packed_runtime_without_row_major_duplicate() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("CAMELID_MAC_Q8_REPACK", "on");
    std::env::remove_var("CAMELID_Q8_0_BLOCK_DOT");
    std::env::remove_var("CAMELID_Q8_0_PACKED_4X8_DOT");

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    for block_idx in 0..64 {
        payload.extend_from_slice(&0x3c00u16.to_le_bytes());
        payload.extend((0..32).map(|v| (v as i8).wrapping_add(block_idx as i8) as u8));
    }
    write_named_tensor_gguf_with_dims(&path, "blk.0.ffn_down.weight", 8, &[64, 32], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store
        .load_q8_0_file_backed_linear("blk.0.ffn_down.weight")
        .unwrap();

    assert_eq!(tensor.shape.dims, vec![64, 32]);
    assert!(tensor.data.is_empty());
    assert!(tensor.q8_0_blocks.is_none());
    assert!(tensor.q8_0_file_backing.is_none());
    assert!(tensor.q8_0_packed_rows4_4x4.is_none());
    assert!(tensor.q8_0_packed_rows4_4x8.is_none());
    let Q8_0RuntimeStorage::PackedRows4(packed) = tensor.q8_0_runtime_storage.unwrap();
    assert_eq!(packed.rows, 32);
    assert_eq!(packed.blocks_per_row, 2);

    std::env::remove_var("CAMELID_MAC_Q8_REPACK");
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
#[test]
fn x86_q8_repack_loads_attn_q_as_packed_runtime_without_row_major_duplicate() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("CAMELID_X86_Q8_REPACK", "on");
    std::env::remove_var("CAMELID_MAC_Q8_REPACK");
    std::env::remove_var("CAMELID_Q8_0_BLOCK_DOT");
    std::env::remove_var("CAMELID_Q8_0_PACKED_4X8_DOT");

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    for block_idx in 0..32 {
        payload.extend_from_slice(&0x3c00u16.to_le_bytes());
        payload.extend((0..32).map(|v| (v as i8).wrapping_add(block_idx as i8) as u8));
    }
    write_named_tensor_gguf_with_dims(&path, "blk.0.attn_q.weight", 8, &[32, 32], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store
        .load_q8_0_file_backed_linear("blk.0.attn_q.weight")
        .unwrap();

    assert!(tensor.data.is_empty());
    assert!(tensor.q8_0_blocks.is_none());
    assert!(tensor.q8_0_file_backing.is_none());
    assert!(tensor.q8_0_packed_rows4_4x4.is_none());
    assert!(tensor.q8_0_packed_rows4_4x8.is_none());
    let Q8_0RuntimeStorage::PackedRows4(packed) = tensor.q8_0_runtime_storage.unwrap();
    assert_eq!(packed.rows, 32);
    assert_eq!(packed.blocks_per_row, 1);

    let block_backed_tensor = store
        .load_q8_0_block_backed_linear("blk.0.attn_q.weight")
        .unwrap();
    assert!(block_backed_tensor.data.is_empty());
    assert!(block_backed_tensor.q8_0_blocks.is_none());
    assert!(block_backed_tensor.q8_0_file_backing.is_none());
    let Q8_0RuntimeStorage::PackedRows4(packed) = block_backed_tensor.q8_0_runtime_storage.unwrap();
    assert_eq!(packed.rows, 32);
    assert_eq!(packed.blocks_per_row, 1);

    std::env::remove_var("CAMELID_X86_Q8_REPACK");
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
#[test]
fn x86_q8_repack_loads_dense_attention_family_as_packed_runtime() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("CAMELID_X86_Q8_REPACK", "on");
    std::env::remove_var("CAMELID_MAC_Q8_REPACK");
    std::env::remove_var("CAMELID_Q8_0_BLOCK_DOT");
    std::env::remove_var("CAMELID_Q8_0_PACKED_4X8_DOT");

    for tensor_name in [
        "blk.0.attn_q.weight",
        "blk.0.attn_k.weight",
        "blk.0.attn_v.weight",
        "blk.0.attn_output.weight",
    ] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tensor.gguf");
        let mut payload = Vec::new();
        for block_idx in 0..32 {
            payload.extend_from_slice(&0x3c00u16.to_le_bytes());
            payload.extend((0..32).map(|v| (v as i8).wrapping_add(block_idx as i8) as u8));
        }
        write_named_tensor_gguf_with_dims(&path, tensor_name, 8, &[32, 32], &payload);

        let gguf = read_metadata(&path).unwrap();
        let store = TensorStore::open(&path, &gguf);
        let tensor = store.load_q8_0_file_backed_linear(tensor_name).unwrap();

        assert_eq!(tensor.shape.dims, vec![32, 32]);
        assert!(
            tensor.data.is_empty(),
            "{tensor_name} materialized f32 data"
        );
        assert!(
            tensor.q8_0_blocks.is_none(),
            "{tensor_name} kept q8_0 blocks"
        );
        assert!(
            tensor.q8_0_file_backing.is_none(),
            "{tensor_name} kept file backing instead of runtime storage"
        );
        assert!(tensor.q8_0_packed_rows4_4x4.is_none());
        assert!(tensor.q8_0_packed_rows4_4x8.is_none());
        let Q8_0RuntimeStorage::PackedRows4(packed) = tensor.q8_0_runtime_storage.unwrap();
        assert_eq!(packed.rows, 32, "{tensor_name} packed row count");
        assert_eq!(packed.blocks_per_row, 1, "{tensor_name} packed k blocks");
    }

    std::env::remove_var("CAMELID_X86_Q8_REPACK");
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
#[test]
fn x86_q8_repack_loads_attention_qkv_as_output_row_packed_runtime() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("CAMELID_X86_Q8_REPACK", "on");
    std::env::remove_var("CAMELID_MAC_Q8_REPACK");
    std::env::remove_var("CAMELID_Q8_0_BLOCK_DOT");
    std::env::remove_var("CAMELID_Q8_0_PACKED_4X8_DOT");

    for (tensor_name, dims, expected_rows, expected_blocks_per_row) in [
        ("blk.0.attn_q.weight", [32_i64, 32_i64], 32_usize, 1_usize),
        ("blk.0.attn_k.weight", [64_i64, 32_i64], 32_usize, 2_usize),
        ("blk.0.attn_v.weight", [64_i64, 32_i64], 32_usize, 2_usize),
    ] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tensor.gguf");
        let block_count = (dims[0] as usize * dims[1] as usize) / 32;
        let mut payload = Vec::new();
        for block_idx in 0..block_count {
            payload.extend_from_slice(&0x3c00u16.to_le_bytes());
            payload.extend((0..32).map(|v| (v as i8).wrapping_add(block_idx as i8) as u8));
        }
        write_named_tensor_gguf_with_dims(&path, tensor_name, 8, &dims, &payload);

        let gguf = read_metadata(&path).unwrap();
        let store = TensorStore::open(&path, &gguf);
        let tensor = store.load_q8_0_file_backed_linear(tensor_name).unwrap();

        assert_eq!(tensor.shape.dims, vec![dims[0] as usize, dims[1] as usize]);
        assert!(
            tensor.data.is_empty(),
            "{tensor_name} materialized f32 data"
        );
        assert!(tensor.q8_0_blocks.is_none(), "{tensor_name} kept q8 blocks");
        assert!(
            tensor.q8_0_file_backing.is_none(),
            "{tensor_name} kept file backing"
        );
        let Q8_0RuntimeStorage::PackedRows4(packed) = tensor.q8_0_runtime_storage.unwrap();
        assert_eq!(packed.rows, expected_rows, "{tensor_name} packed row count");
        assert_eq!(
            packed.blocks_per_row, expected_blocks_per_row,
            "{tensor_name} packed blocks per output row"
        );
    }

    std::env::remove_var("CAMELID_X86_Q8_REPACK");
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
#[test]
fn x86_q8_repack_loads_dense_ffn_family_as_transposed_packed_runtime() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("CAMELID_X86_Q8_REPACK", "on");
    std::env::remove_var("CAMELID_MAC_Q8_REPACK");
    std::env::remove_var("CAMELID_Q8_0_BLOCK_DOT");
    std::env::remove_var("CAMELID_Q8_0_PACKED_4X8_DOT");

    for (tensor_name, dims, expected_rows, expected_blocks_per_row) in [
        ("blk.0.ffn_gate.weight", [32_i64, 64_i64], 64_usize, 1_usize),
        ("blk.0.ffn_up.weight", [32_i64, 64_i64], 64_usize, 1_usize),
        // Llama dense FFN down rows are [ffn, hidden] in GGUF, so the x86
        // runtime storage must be directly usable as transposed rows [hidden, ffn].
        ("blk.0.ffn_down.weight", [64_i64, 32_i64], 32_usize, 2_usize),
    ] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("tensor.gguf");
        let block_count = (dims[0] as usize * dims[1] as usize) / 32;
        let mut payload = Vec::new();
        for block_idx in 0..block_count {
            payload.extend_from_slice(&0x3c00u16.to_le_bytes());
            payload.extend((0..32).map(|v| (v as i8).wrapping_add(block_idx as i8) as u8));
        }
        write_named_tensor_gguf_with_dims(&path, tensor_name, 8, &dims, &payload);

        let gguf = read_metadata(&path).unwrap();
        let store = TensorStore::open(&path, &gguf);
        let tensor = store.load_q8_0_file_backed_linear(tensor_name).unwrap();

        assert_eq!(tensor.shape.dims, dims.map(|dim| dim as usize).to_vec());
        assert!(
            tensor.data.is_empty(),
            "{tensor_name} materialized f32 data"
        );
        assert!(
            tensor.q8_0_blocks.is_none(),
            "{tensor_name} kept q8_0 blocks"
        );
        assert!(
            tensor.q8_0_file_backing.is_none(),
            "{tensor_name} kept file backing instead of runtime storage"
        );
        assert!(tensor.q8_0_packed_rows4_4x4.is_none());
        assert!(tensor.q8_0_packed_rows4_4x8.is_none());
        let Q8_0RuntimeStorage::PackedRows4(packed) = tensor.q8_0_runtime_storage.unwrap();
        assert_eq!(packed.rows, expected_rows, "{tensor_name} packed row count");
        assert_eq!(
            packed.blocks_per_row, expected_blocks_per_row,
            "{tensor_name} packed k blocks"
        );
    }

    std::env::remove_var("CAMELID_X86_Q8_REPACK");
}

#[test]
fn mac_q8_repack_loads_output_projection_as_token_major_packed_runtime() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::set_var("CAMELID_MAC_Q8_REPACK", "on");
    std::env::remove_var("CAMELID_X86_Q8_REPACK");
    std::env::remove_var("CAMELID_Q8_0_BLOCK_DOT");
    std::env::remove_var("CAMELID_Q8_0_PACKED_4X8_DOT");

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    for block_idx in 0..64 {
        payload.extend_from_slice(&0x3c00u16.to_le_bytes());
        payload.extend((0..32).map(|v| (v as i8).wrapping_add(block_idx as i8) as u8));
    }
    write_named_tensor_gguf_with_dims(&path, "output.weight", 8, &[32, 64], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);

    std::env::remove_var("CAMELID_MAC_Q8_REPACK");
    let fallback = store.load_q8_0_file_backed_linear("output.weight").unwrap();
    assert!(fallback.q8_0_runtime_storage.is_none());
    assert!(fallback.q8_0_file_backing.is_some());

    std::env::set_var("CAMELID_MAC_Q8_REPACK", "on");
    let tensor = store.load_q8_0_file_backed_linear("output.weight").unwrap();
    assert_eq!(tensor.shape.dims, vec![32, 64]);
    assert!(tensor.data.is_empty());
    assert!(tensor.q8_0_blocks.is_none());
    assert!(tensor.q8_0_file_backing.is_none());
    assert!(tensor.q8_0_packed_rows4_4x4.is_none());
    assert!(tensor.q8_0_packed_rows4_4x8.is_none());
    let Q8_0RuntimeStorage::PackedRows4(packed) = tensor.q8_0_runtime_storage.unwrap();
    assert_eq!(packed.rows, 64);
    assert_eq!(packed.blocks_per_row, 1);

    std::env::remove_var("CAMELID_MAC_Q8_REPACK");
}

#[cfg(any(target_arch = "x86", target_arch = "x86_64"))]
#[test]
fn x86_q8_repack_loads_output_projection_as_token_major_packed_runtime() {
    let _guard = ENV_LOCK.lock().unwrap();
    std::env::remove_var("CAMELID_X86_Q8_REPACK");
    std::env::remove_var("CAMELID_MAC_Q8_REPACK");
    std::env::remove_var("CAMELID_Q8_0_BLOCK_DOT");
    std::env::remove_var("CAMELID_Q8_0_PACKED_4X8_DOT");

    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    for block_idx in 0..64 {
        payload.extend_from_slice(&0x3c00u16.to_le_bytes());
        payload.extend((0..32).map(|v| (v as i8).wrapping_add(block_idx as i8) as u8));
    }
    write_named_tensor_gguf_with_dims(&path, "output.weight", 8, &[32, 64], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let fallback = store.load_q8_0_file_backed_linear("output.weight").unwrap();
    assert!(fallback.q8_0_runtime_storage.is_none());
    assert!(fallback.q8_0_file_backing.is_some());

    std::env::set_var("CAMELID_X86_Q8_REPACK", "on");
    let tensor = store.load_q8_0_file_backed_linear("output.weight").unwrap();

    assert_eq!(tensor.shape.dims, vec![32, 64]);
    assert!(tensor.data.is_empty());
    assert!(tensor.q8_0_blocks.is_none());
    assert!(tensor.q8_0_file_backing.is_none());
    assert!(tensor.q8_0_packed_rows4_4x4.is_none());
    assert!(tensor.q8_0_packed_rows4_4x8.is_none());
    let Q8_0RuntimeStorage::PackedRows4(packed) = tensor.q8_0_runtime_storage.unwrap();
    assert_eq!(packed.rows, 64);
    assert_eq!(packed.blocks_per_row, 1);

    std::env::remove_var("CAMELID_X86_Q8_REPACK");
}

#[test]
fn loads_q8_0_block_backed_linear_without_f32_materialization() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    payload.extend_from_slice(&0x3c00u16.to_le_bytes()); // scale 1.0
    payload.extend((0..32).map(|v| v as i8 as u8));
    payload.extend_from_slice(&0x4000u16.to_le_bytes()); // scale 2.0
    payload.extend((0..32).map(|v| (v as i8 - 16) as u8));
    write_tensor_gguf_with_dims(&path, 8, &[32, 2], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_q8_0_block_backed_linear("test.weight").unwrap();

    assert_eq!(tensor.name, "test.weight");
    assert_eq!(tensor.shape.dims, vec![32, 2]);
    assert_eq!(tensor.source_type, Some(GgufTensorType::Q8_0));
    assert!(tensor.data.is_empty());
    assert!(tensor.q8_0_file_backing.is_none());
    assert_eq!(tensor.q8_0_blocks.as_ref().unwrap().len(), 2);
}

#[test]
fn q8_0_block_backed_embedding_lookup_dequantizes_requested_rows() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    payload.extend_from_slice(&0x3c00u16.to_le_bytes()); // row 0 scale 1.0
    payload.extend((0..32).map(|v| v as i8 as u8));
    payload.extend_from_slice(&0x4000u16.to_le_bytes()); // row 1 scale 2.0
    payload.extend((0..32).map(|v| (v as i8 - 16) as u8));
    write_tensor_gguf_with_dims(&path, 8, &[32, 2], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let mut tensor = store.load_q8_0_block_backed_linear("test.weight").unwrap();
    tensor.shape.dims = vec![2, 32];

    let actual = tensor.embedding_lookup(&[1], "embedding").unwrap();

    assert_eq!(actual.shape.dims, vec![1, 32]);
    assert_eq!(actual.data[0], -32.0);
    assert_eq!(actual.data[31], 30.0);
}

#[test]
fn q8_0_file_backed_embedding_lookup_reads_only_requested_rows() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    payload.extend_from_slice(&0x3c00u16.to_le_bytes()); // row 0 scale 1.0
    payload.extend((0..32).map(|v| v as i8 as u8));
    payload.extend_from_slice(&0x4000u16.to_le_bytes()); // row 1 scale 2.0
    payload.extend((0..32).map(|v| (v as i8 - 16) as u8));
    write_tensor_gguf_with_dims(&path, 8, &[32, 2], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let mut tensor = store.load_q8_0_file_backed_linear("test.weight").unwrap();
    tensor.shape.dims = vec![2, 32];

    let actual = tensor.embedding_lookup(&[1], "embedding").unwrap();

    assert_eq!(actual.shape.dims, vec![1, 32]);
    assert_eq!(actual.data[0], -32.0);
    assert_eq!(actual.data[31], 30.0);
}

#[test]
fn loads_q8_0_blocks_without_f32_materialization() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    payload.extend_from_slice(&0x3c00u16.to_le_bytes()); // scale 1.0
    payload.extend((0..32).map(|v| v as i8 as u8));
    payload.extend_from_slice(&0x4000u16.to_le_bytes()); // scale 2.0
    payload.extend((0..32).map(|v| (v as i8 - 16) as u8));
    write_tensor_gguf_with_dims(&path, 8, &[64], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_q8_0_blocks("test.weight").unwrap();

    assert_eq!(tensor.name, "test.weight");
    assert_eq!(tensor.shape.dims, vec![64]);
    assert_eq!(tensor.element_count().unwrap(), 64);
    assert_eq!(tensor.byte_size_if_f32_materialized().unwrap(), 256);
    assert_eq!(tensor.blocks.len(), 2);
    assert_eq!(
        tensor.blocks[0],
        Q8_0Block {
            scale: 1.0,
            quants: std::array::from_fn(|idx| idx as i8),
        }
    );
    assert_eq!(tensor.blocks[1].scale, 2.0);
    assert_eq!(tensor.blocks[1].quants[0], -16);
    assert_eq!(tensor.blocks[1].quants[31], 15);
}

#[test]
fn dequantizes_q8_0_block_ranges_without_full_materialization() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    payload.extend_from_slice(&0x3c00u16.to_le_bytes()); // scale 1.0
    payload.extend((0..32).map(|v| v as i8 as u8));
    payload.extend_from_slice(&0x4000u16.to_le_bytes()); // scale 2.0
    payload.extend((0..32).map(|v| (v as i8 - 16) as u8));
    write_tensor_gguf_with_dims(&path, 8, &[64], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_q8_0_blocks("test.weight").unwrap();

    assert_eq!(
        tensor.dequantize_elements(30, 4).unwrap(),
        vec![30.0, 31.0, -32.0, -30.0]
    );
    assert_eq!(
        tensor.dequantize_elements(64, 0).unwrap(),
        Vec::<f32>::new()
    );
    let err = tensor.dequantize_elements(63, 2).unwrap_err().to_string();
    assert!(err.contains("exceeds element count"));
}

#[test]
fn dequantizes_q8_0_rows_without_full_materialization() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    payload.extend_from_slice(&0x3c00u16.to_le_bytes()); // scale 1.0
    payload.extend((0..32).map(|v| v as i8 as u8));
    payload.extend_from_slice(&0x4000u16.to_le_bytes()); // scale 2.0
    payload.extend((0..32).map(|v| (v as i8 - 16) as u8));
    write_tensor_gguf_with_dims(&path, 8, &[32, 2], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_q8_0_blocks("test.weight").unwrap();

    assert_eq!(tensor.dequantize_row(0).unwrap(), vec![0.0, 1.0]);
    let row = tensor.dequantize_row(31).unwrap();
    assert_eq!(row[0], 28.0);
    assert_eq!(row[1], 30.0);
    let err = tensor.dequantize_row(32).unwrap_err().to_string();
    assert!(err.contains("out of range"));
}

#[test]
fn dots_q8_0_rows_against_f32_input_without_full_materialization() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    payload.extend_from_slice(&0x3c00u16.to_le_bytes()); // scale 1.0
    payload.extend((0..32).map(|v| v as i8 as u8));
    payload.extend_from_slice(&0x4000u16.to_le_bytes()); // scale 2.0
    payload.extend((0..32).map(|v| (v as i8 - 16) as u8));
    write_tensor_gguf_with_dims(&path, 8, &[32, 2], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_q8_0_blocks("test.weight").unwrap();

    let input = [0.25, -0.5];
    assert_eq!(tensor.dot_row_f32(0, &input).unwrap(), -0.5);
    assert_eq!(tensor.dot_row_f32(31, &input).unwrap(), -8.0);

    let materialized_row = tensor.dequantize_row(31).unwrap();
    let expected: f32 = materialized_row
        .iter()
        .zip(input.iter())
        .map(|(weight, value)| weight * value)
        .sum();
    assert_eq!(tensor.dot_row_f32(31, &input).unwrap(), expected);

    let err = tensor.dot_row_f32(0, &[1.0]).unwrap_err().to_string();
    assert!(err.contains("expected input width 2"));
}

#[test]
fn dots_all_q8_0_rows_into_f32_tensor_without_full_materialization() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    payload.extend_from_slice(&0x3c00u16.to_le_bytes()); // scale 1.0
    payload.extend((0..32).map(|v| v as i8 as u8));
    payload.extend_from_slice(&0x4000u16.to_le_bytes()); // scale 2.0
    payload.extend((0..32).map(|v| (v as i8 - 16) as u8));
    write_tensor_gguf_with_dims(&path, 8, &[32, 2], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_q8_0_blocks("test.weight").unwrap();

    let input = [0.25, -0.5];
    let actual = tensor.dot_all_rows_f32(&input, "lazy_out").unwrap();

    assert_eq!(actual.name, "lazy_out");
    assert_eq!(actual.shape.dims, vec![32]);
    assert_eq!(actual.data.len(), 32);
    for row in [0, 1, 15, 31] {
        let materialized_row = tensor.dequantize_row(row).unwrap();
        let expected: f32 = materialized_row
            .iter()
            .zip(input.iter())
            .map(|(weight, value)| weight * value)
            .sum();
        assert_eq!(actual.data[row], expected);
    }

    let err = tensor
        .dot_all_rows_f32(&[1.0], "bad_width")
        .unwrap_err()
        .to_string();
    assert!(err.contains("all-row dot expected input width 2"));
}

#[test]
fn adapts_q8_0_all_row_dot_to_single_row_linear_output_shape() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    payload.extend_from_slice(&0x3c00u16.to_le_bytes()); // scale 1.0
    payload.extend((0..32).map(|v| v as i8 as u8));
    payload.extend_from_slice(&0x4000u16.to_le_bytes()); // scale 2.0
    payload.extend((0..32).map(|v| (v as i8 - 16) as u8));
    write_tensor_gguf_with_dims(&path, 8, &[32, 2], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_q8_0_blocks("test.weight").unwrap();
    let input = CpuTensor::from_f32("input", vec![1, 2], vec![0.25, -0.5]).unwrap();

    let actual = tensor
        .dot_single_input_row_f32(&input, "lazy_linear_out")
        .unwrap();

    assert_eq!(actual.name, "lazy_linear_out");
    assert_eq!(actual.shape.dims, vec![1, 32]);
    assert_eq!(actual.data.len(), 32);
    for row in [0, 1, 15, 31] {
        let materialized_row = tensor.dequantize_row(row).unwrap();
        let expected: f32 = materialized_row
            .iter()
            .zip(input.data.iter())
            .map(|(weight, value)| weight * value)
            .sum();
        assert_eq!(actual.data[row], expected);
    }

    let bad_input = CpuTensor::from_f32("bad", vec![2, 1], vec![1.0, 2.0]).unwrap();
    let err = tensor
        .dot_single_input_row_f32(&bad_input, "bad_shape")
        .unwrap_err()
        .to_string();
    assert!(err.contains("expected single input row"));
}

#[test]
fn dots_all_q8_0_block_aligned_rows_without_per_element_row_fallback() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    let mut payload = Vec::new();
    for block_idx in 0..32 {
        let scale_bits: u16 = if block_idx % 2 == 0 { 0x3c00 } else { 0x4000 };
        payload.extend_from_slice(&scale_bits.to_le_bytes());
        payload.extend((0..32).map(|v| (v as i8).wrapping_sub(block_idx as i8) as u8));
    }
    write_tensor_gguf_with_dims(&path, 8, &[32, 32], &payload);

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let tensor = store.load_q8_0_blocks("test.weight").unwrap();

    let input: Vec<f32> = (0..32).map(|idx| idx as f32 / 16.0 - 1.0).collect();
    let actual = tensor.dot_all_rows_f32(&input, "lazy_out").unwrap();

    assert_eq!(actual.shape.dims, vec![32]);
    for row in [0, 1, 15, 31] {
        let materialized_row = tensor.dequantize_row(row).unwrap();
        let expected: f32 = materialized_row
            .iter()
            .zip(input.iter())
            .map(|(weight, value)| weight * value)
            .sum();
        assert_eq!(actual.data[row], expected);
    }
}

#[test]
fn rejects_non_q8_0_block_only_loads() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    write_tensor_gguf(
        &path,
        0,
        &[1.0f32.to_le_bytes(), 2.5f32.to_le_bytes()].concat(),
    );

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let err = store
        .load_q8_0_blocks("test.weight")
        .unwrap_err()
        .to_string();

    assert!(err.contains("q8_0 block-only load requires Q8_0"));
}

#[test]
fn rejects_planned_quant_tensors_until_dequant_support_exists() {
    for (name, tensor_type, dims, payload_len) in [
        ("q4_0", 2, [32_i64].as_slice(), 18_usize),
        ("q5_0", 6, [32_i64].as_slice(), 22_usize),
        ("q4_k", 12, [256_i64].as_slice(), 144_usize),
        ("q5_k", 13, [256_i64].as_slice(), 176_usize),
    ] {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(format!("{name}.gguf"));
        write_tensor_gguf_with_dims(&path, tensor_type, dims, &vec![0; payload_len]);

        let gguf = read_metadata(&path).unwrap();
        let store = TensorStore::open(&path, &gguf);
        let err = store.load_cpu_f32("test.weight").unwrap_err().to_string();

        assert!(err.contains("unsupported storage type"), "{name}: {err}");
        assert!(err.contains("F32, F16, BF16, Q8_0"), "{name}: {err}");
    }
}

#[test]
fn rejects_q8_0_tensor_with_non_block_aligned_first_dimension() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("bad-q8.gguf");
    write_tensor_gguf_with_dims(&path, 8, &[31], &[]);

    let err = read_metadata(&path).unwrap_err().to_string();

    assert!(err.contains("first dimension 31"));
    assert!(err.contains("block size 32"));
}

#[test]
fn reports_missing_tensor_by_name() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tensor.gguf");
    write_tensor_gguf(
        &path,
        0,
        &[1.0f32.to_le_bytes(), 2.0f32.to_le_bytes()].concat(),
    );

    let gguf = read_metadata(&path).unwrap();
    let store = TensorStore::open(&path, &gguf);
    let err = store
        .load_cpu_f32("missing.weight")
        .unwrap_err()
        .to_string();

    assert!(err.contains("missing.weight"));
}

fn write_tensor_gguf(path: &Path, tensor_type: i32, payload: &[u8]) {
    write_tensor_gguf_with_dims(path, tensor_type, &[2], payload);
}

fn write_tensor_gguf_with_dims(path: &Path, tensor_type: i32, dims: &[i64], payload: &[u8]) {
    write_named_tensor_gguf_with_dims(path, "test.weight", tensor_type, dims, payload);
}

fn write_named_tensor_gguf_with_dims(
    path: &Path,
    tensor_name: &str,
    tensor_type: i32,
    dims: &[i64],
    payload: &[u8],
) {
    let mut b = Vec::new();
    b.extend_from_slice(b"GGUF");
    push_u32(&mut b, 3);
    push_i64(&mut b, 1); // tensor count
    push_i64(&mut b, 1); // metadata count

    push_kv_string(&mut b, "general.architecture", "llama");

    push_string(&mut b, tensor_name);
    push_u32(&mut b, dims.len() as u32);
    for dim in dims {
        push_i64(&mut b, *dim);
    }
    push_i32(&mut b, tensor_type);
    push_u64(&mut b, 0);

    while !b.len().is_multiple_of(32) {
        b.push(0);
    }
    b.extend_from_slice(payload);
    fs::write(path, b).unwrap();
}

fn push_kv_string(b: &mut Vec<u8>, key: &str, value: &str) {
    push_string(b, key);
    push_i32(b, 8);
    push_string(b, value);
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
