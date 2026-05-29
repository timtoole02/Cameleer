use camelid::tensor::CpuTensor;

#[test]
fn matmul_2x2() {
    let a = CpuTensor::from_f32("a", vec![2, 2], vec![1.0, 2.0, 3.0, 4.0]).unwrap();
    let b = CpuTensor::from_f32("b", vec![2, 2], vec![5.0, 6.0, 7.0, 8.0]).unwrap();

    let out = a.matmul(&b, "out").unwrap();

    assert_eq!(out.shape.dims, vec![2, 2]);
    assert_eq!(out.data, vec![19.0, 22.0, 43.0, 50.0]);
}

#[test]
fn matmul_handles_rectangular_batches() {
    let a = CpuTensor::from_f32("a", vec![2, 3], vec![1.0, 0.0, 2.0, -1.0, 3.0, 1.0]).unwrap();
    let b = CpuTensor::from_f32(
        "b",
        vec![3, 4],
        vec![
            1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0,
        ],
    )
    .unwrap();

    let out = a.matmul(&b, "out").unwrap();

    assert_eq!(out.shape.dims, vec![2, 4]);
    assert_eq!(
        out.data,
        vec![19.0, 22.0, 25.0, 28.0, 23.0, 26.0, 29.0, 32.0]
    );
}

#[test]
fn matmul_rhs_transposed_matches_explicit_transpose() {
    let a = CpuTensor::from_f32("a", vec![2, 3], vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0]).unwrap();
    let b = CpuTensor::from_f32(
        "b",
        vec![4, 3],
        vec![1.0, 0.0, 1.0, 2.0, 1.0, 0.0, 0.0, 3.0, 1.0, 1.0, 1.0, 1.0],
    )
    .unwrap();

    let out = a.matmul_rhs_transposed(&b, "out").unwrap();

    assert_eq!(out.shape.dims, vec![2, 4]);
    assert_eq!(out.data, vec![4.0, 4.0, 9.0, 6.0, 10.0, 13.0, 21.0, 15.0]);
}

#[test]
fn add_and_mul_same_shape() {
    let a = CpuTensor::from_f32("a", vec![3], vec![1.0, 2.0, 3.0]).unwrap();
    let b = CpuTensor::from_f32("b", vec![3], vec![4.0, 5.0, 6.0]).unwrap();

    assert_eq!(a.add(&b, "add").unwrap().data, vec![5.0, 7.0, 9.0]);
    assert_eq!(a.mul(&b, "mul").unwrap().data, vec![4.0, 10.0, 18.0]);
}

#[test]
fn silu_known_values() {
    let x = CpuTensor::from_f32("x", vec![3], vec![-1.0, 0.0, 1.0]).unwrap();
    let out = x.silu("silu").unwrap();

    assert_close(out.data[0], -0.26894143);
    assert_close(out.data[1], 0.0);
    assert_close(out.data[2], 0.7310586);
}

#[test]
fn silu_mul_fuses_activation_and_multiply() {
    let gate = CpuTensor::from_f32("gate", vec![3], vec![-1.0, 0.0, 1.0]).unwrap();
    let up = CpuTensor::from_f32("up", vec![3], vec![2.0, 3.0, 4.0]).unwrap();
    let out = gate.silu_mul(&up, "activated").unwrap();

    assert_eq!(out.shape.dims, vec![3]);
    assert_close(out.data[0], -0.53788286);
    assert_close(out.data[1], 0.0);
    assert_close(out.data[2], 2.9242344);
}

#[test]
fn rms_norm_known_vector() {
    let x = CpuTensor::from_f32("x", vec![1, 2], vec![3.0, 4.0]).unwrap();
    let weight = CpuTensor::from_f32("w", vec![2], vec![1.0, 2.0]).unwrap();

    let out = x.rms_norm(&weight, 0.0, "norm").unwrap();

    let rms = ((9.0f32 + 16.0) / 2.0).sqrt();
    assert_close(out.data[0], 3.0 / rms);
    assert_close(out.data[1], 4.0 / rms * 2.0);
}

#[test]
fn softmax_is_stable_for_large_logits() {
    let x = CpuTensor::from_f32("x", vec![1, 3], vec![1000.0, 1001.0, 1002.0]).unwrap();

    let out = x.softmax_last_dim("softmax").unwrap();

    let sum: f32 = out.data.iter().sum();
    assert_close(sum, 1.0);
    assert!(out.data[2] > out.data[1]);
    assert!(out.data[1] > out.data[0]);
}

#[test]
fn embedding_lookup_returns_expected_rows() {
    let embedding =
        CpuTensor::from_f32("embd", vec![3, 2], vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0]).unwrap();

    let out = embedding.embedding_lookup(&[2, 0], "lookup").unwrap();

    assert_eq!(out.shape.dims, vec![2, 2]);
    assert_eq!(out.data, vec![5.0, 6.0, 1.0, 2.0]);
}

#[test]
fn transpose_2d() {
    let x = CpuTensor::from_f32("x", vec![2, 3], vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0]).unwrap();

    let out = x.transpose_2d("t").unwrap();

    assert_eq!(out.shape.dims, vec![3, 2]);
    assert_eq!(out.data, vec![1.0, 4.0, 2.0, 5.0, 3.0, 6.0]);
}

fn assert_close(actual: f32, expected: f32) {
    assert!(
        (actual - expected).abs() < 1e-5,
        "actual {actual} expected {expected}"
    );
}
