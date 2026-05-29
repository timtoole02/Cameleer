use std::{fs, path::Path};

use camelid::gguf::{read_metadata, GgufMetadataValue, GgufTensorType};

#[test]
fn parses_minimal_gguf_metadata_and_tensor_directory() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("tiny.gguf");
    write_tiny_gguf(&path);

    let gguf = read_metadata(&path).unwrap();

    assert_eq!(gguf.version, 3);
    assert_eq!(gguf.tensor_count, 1);
    assert_eq!(gguf.metadata_count, 3);
    assert_eq!(gguf.architecture(), Some("llama"));
    assert_eq!(gguf.model_name(), Some("tiny-test"));
    assert_eq!(
        gguf.metadata.get("general.alignment"),
        Some(&GgufMetadataValue::U32(32))
    );
    assert_eq!(gguf.tensors.len(), 1);
    assert_eq!(gguf.tensors[0].name, "token_embd.weight");
    assert_eq!(gguf.tensors[0].dimensions, vec![4, 2]);
    assert_eq!(gguf.tensors[0].tensor_type, GgufTensorType::F32);
    assert_eq!(gguf.tensors[0].relative_offset, 0);
    assert_eq!(gguf.tensors[0].absolute_offset % 32, 0);
    assert_eq!(gguf.tensors[0].n_bytes, 32);
}

#[test]
fn rejects_bad_magic() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("bad.gguf");
    fs::write(&path, b"NOPE").unwrap();

    let err = read_metadata(&path).unwrap_err().to_string();
    assert!(err.contains("bad magic") || err.contains("unexpected end of file"));
}

#[test]
fn rejects_duplicate_metadata_keys() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("duplicate-metadata.gguf");
    let mut b = header(0, 2);
    push_kv_string(&mut b, "general.architecture", "llama");
    push_kv_string(&mut b, "general.architecture", "llama");
    fs::write(&path, b).unwrap();

    let err = read_metadata(&path).unwrap_err().to_string();
    assert!(err.contains("duplicate metadata key general.architecture"));
}

#[test]
fn rejects_non_contiguous_tensor_offsets() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("offset-gap.gguf");
    let mut b = header(1, 1);
    push_kv_string(&mut b, "general.architecture", "llama");
    push_string(&mut b, "token_embd.weight");
    push_u32(&mut b, 1);
    push_i64(&mut b, 2);
    push_i32(&mut b, 0); // f32
    push_u64(&mut b, 4); // first tensor must begin at relative offset 0
    while !b.len().is_multiple_of(32) {
        b.push(0);
    }
    b.extend_from_slice(&[0u8; 8]);
    fs::write(&path, b).unwrap();

    let err = read_metadata(&path).unwrap_err().to_string();
    assert!(err.contains("not contiguous"));
    assert!(err.contains("expected 0"));
}

fn header(tensor_count: i64, metadata_count: i64) -> Vec<u8> {
    let mut b = Vec::new();
    b.extend_from_slice(b"GGUF");
    push_u32(&mut b, 3);
    push_i64(&mut b, tensor_count);
    push_i64(&mut b, metadata_count);
    b
}

fn write_tiny_gguf(path: &Path) {
    let mut b = header(1, 3);

    push_kv_string(&mut b, "general.architecture", "llama");
    push_kv_string(&mut b, "general.name", "tiny-test");
    push_string(&mut b, "general.alignment");
    push_u32(&mut b, 4); // u32 type
    push_u32(&mut b, 32);

    push_string(&mut b, "token_embd.weight");
    push_u32(&mut b, 2); // dims
    push_i64(&mut b, 4);
    push_i64(&mut b, 2);
    push_i32(&mut b, 0); // f32
    push_u64(&mut b, 0); // relative offset

    while !b.len().is_multiple_of(32) {
        b.push(0);
    }
    b.extend_from_slice(&[0u8; 4 * 2 * 4]);
    fs::write(path, b).unwrap();
}

fn push_kv_string(b: &mut Vec<u8>, key: &str, value: &str) {
    push_string(b, key);
    push_u32(b, 8); // string type
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
