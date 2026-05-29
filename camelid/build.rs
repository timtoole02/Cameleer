use std::{env, path::PathBuf, process::Command};

fn main() {
    println!("cargo:rerun-if-changed=src/x86_amx_q8.c");
    let target_os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_default();
    let target_arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_default();
    if target_os != "linux" || target_arch != "x86_64" {
        return;
    }

    let out_dir = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR"));
    let obj = out_dir.join("x86_amx_q8.o");
    let lib = out_dir.join("libcamelid_x86_amx_q8.a");

    let status = Command::new("gcc")
        .args([
            "-O3",
            "-std=c11",
            "-Wall",
            "-Wextra",
            "-mavx512f",
            "-mfma",
            "-mamx-tile",
            "-mamx-int8",
            "-c",
            "src/x86_amx_q8.c",
            "-o",
        ])
        .arg(&obj)
        .status()
        .expect("failed to run gcc for x86 AMX Q8 kernel");
    if !status.success() {
        panic!("gcc failed building x86 AMX Q8 kernel");
    }

    let status = Command::new("ar")
        .arg("crus")
        .arg(&lib)
        .arg(&obj)
        .status()
        .expect("failed to run ar for x86 AMX Q8 kernel");
    if !status.success() {
        panic!("ar failed building x86 AMX Q8 kernel");
    }

    println!("cargo:rustc-link-search=native={}", out_dir.display());
    println!("cargo:rustc-link-lib=static=camelid_x86_amx_q8");
}
