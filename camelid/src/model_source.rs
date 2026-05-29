use std::{
    collections::BTreeSet,
    fs,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{BackendError, Result};

/// Source-level model formats that Camelid can reason about before runtime loading.
///
/// This layer is intentionally narrower than generation support: a Hugging Face
/// SafeTensors directory can be detected and reported without becoming runnable.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ModelSourceKind {
    Gguf,
    HuggingFaceSafeTensors,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct ModelSourceManifest {
    pub id: String,
    pub kind: ModelSourceKind,
    pub root: PathBuf,
    pub weight_files: Vec<PathBuf>,
    pub config_path: Option<PathBuf>,
    pub tokenizer_path: Option<PathBuf>,
    pub tokenizer_config_path: Option<PathBuf>,
    pub special_tokens_map_path: Option<PathBuf>,
    pub generation_config_path: Option<PathBuf>,
    pub shard_index_path: Option<PathBuf>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct ModelSourceReadiness {
    pub metadata_ready: bool,
    pub tokenizer_ready: bool,
    pub weights_ready: bool,
    pub generation_ready: bool,
    pub blockers: Vec<ModelSourceBlocker>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct ModelSourceBlocker {
    pub code: &'static str,
    pub message: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
pub struct ModelSourceInspection {
    pub manifest: ModelSourceManifest,
    pub readiness: ModelSourceReadiness,
}

#[derive(Debug, Deserialize)]
struct HfConfigProbe {
    model_type: Option<String>,
    architectures: Option<Vec<String>>,
    rope_scaling: Option<Value>,
    sliding_window: Option<Value>,
}

/// Inspect a local model source without constructing runtime weights.
///
/// Existing GGUF callers should continue to use the current loader path. This
/// helper gives the SafeTensors lane a descriptor/readiness seam and deliberately
/// leaves Hugging Face SafeTensors generation disabled.
pub fn inspect_model_source(path: impl AsRef<Path>) -> Result<ModelSourceInspection> {
    let path = path.as_ref();
    let metadata = fs::metadata(path).map_err(|source| BackendError::Io {
        path: path.to_path_buf(),
        source,
    })?;

    if metadata.is_file() && has_extension(path, "gguf") {
        return Ok(inspect_gguf_file(path));
    }

    if metadata.is_dir() {
        return inspect_hugging_face_safetensors_dir(path);
    }

    Err(BackendError::InvalidModelMetadata(format!(
        "unsupported model source path {}; expected a .gguf file or local Hugging Face directory",
        public_path_label(path)
    )))
}

fn inspect_gguf_file(path: &Path) -> ModelSourceInspection {
    ModelSourceInspection {
        manifest: ModelSourceManifest {
            id: source_id(path),
            kind: ModelSourceKind::Gguf,
            root: path.to_path_buf(),
            weight_files: vec![path.to_path_buf()],
            config_path: None,
            tokenizer_path: None,
            tokenizer_config_path: None,
            special_tokens_map_path: None,
            generation_config_path: None,
            shard_index_path: None,
        },
        readiness: ModelSourceReadiness {
            metadata_ready: true,
            tokenizer_ready: false,
            weights_ready: true,
            generation_ready: false,
            blockers: vec![blocker(
                "gguf_runtime_loader_unchanged",
                "GGUF source detection is present, but generation readiness is still owned by the existing GGUF runtime loader",
            )],
        },
    }
}

fn inspect_hugging_face_safetensors_dir(path: &Path) -> Result<ModelSourceInspection> {
    let config_path = existing_child(path, "config.json");
    let tokenizer_path = existing_child(path, "tokenizer.json");
    let tokenizer_config_path = existing_child(path, "tokenizer_config.json");
    let special_tokens_map_path = existing_child(path, "special_tokens_map.json");
    let generation_config_path = existing_child(path, "generation_config.json");
    let shard_index_path = existing_child(path, "model.safetensors.index.json");
    let weight_files = safetensors_files(path)?;

    let mut blockers = Vec::new();
    let metadata_ready = config_path
        .as_ref()
        .map(|config_path| hf_config_ready(config_path, &mut blockers))
        .unwrap_or_else(|| {
            blockers.push(blocker(
                "missing_config_json",
                "Hugging Face SafeTensors directories must include config.json",
            ));
            false
        });

    let tokenizer_ready = tokenizer_path.is_some();
    if !tokenizer_ready {
        blockers.push(blocker(
            "missing_tokenizer_json",
            "Hugging Face SafeTensors directories must include tokenizer.json before tokenizer readiness can be reported",
        ));
    }

    let weights_ready =
        hf_weights_ready(&weight_files, shard_index_path.as_deref(), &mut blockers)?;
    blockers.push(blocker(
        "generation_disabled",
        "SafeTensors generation remains disabled until tokenizer parity, tensor orientation, dtype decode, and one-token dense execution fixtures pass",
    ));

    Ok(ModelSourceInspection {
        manifest: ModelSourceManifest {
            id: source_id(path),
            kind: ModelSourceKind::HuggingFaceSafeTensors,
            root: path.to_path_buf(),
            weight_files,
            config_path,
            tokenizer_path,
            tokenizer_config_path,
            special_tokens_map_path,
            generation_config_path,
            shard_index_path,
        },
        readiness: ModelSourceReadiness {
            metadata_ready,
            tokenizer_ready,
            weights_ready,
            generation_ready: false,
            blockers,
        },
    })
}

fn hf_config_ready(config_path: &Path, blockers: &mut Vec<ModelSourceBlocker>) -> bool {
    let Ok(bytes) = fs::read(config_path) else {
        blockers.push(blocker(
            "config_json_unreadable",
            format!(
                "could not read required Hugging Face config file {}",
                public_path_label(config_path)
            ),
        ));
        return false;
    };
    let Ok(config) = serde_json::from_slice::<HfConfigProbe>(&bytes) else {
        blockers.push(blocker(
            "invalid_config_json",
            format!(
                "required Hugging Face config file {} is not valid JSON",
                public_path_label(config_path)
            ),
        ));
        return false;
    };

    if config.model_type.as_deref() != Some("llama") {
        blockers.push(blocker(
            "unsupported_model_type",
            format!(
                "only dense LLaMA-family SafeTensors config metadata is in scope for the first readiness slice; got {:?}",
                config.model_type
            ),
        ));
        return false;
    }

    if let Some(architectures) = config.architectures.as_ref() {
        if !architectures
            .iter()
            .any(|architecture| architecture == "LlamaForCausalLM")
        {
            blockers.push(blocker(
                "unsupported_architecture",
                format!(
                    "only LlamaForCausalLM SafeTensors configs are in scope for the first readiness slice; got {:?}",
                    architectures
                ),
            ));
            return false;
        }
    }

    if config.sliding_window.is_some() {
        blockers.push(blocker(
            "unsupported_sliding_window_attention",
            "sliding-window attention needs an explicit Camelid runtime mapping before SafeTensors metadata can be ready",
        ));
        return false;
    }

    if config.rope_scaling.is_some() {
        blockers.push(blocker(
            "rope_scaling_metadata_only",
            "rope_scaling is parsed as metadata only; context support still requires Camelid RoPE mapping plus prompt-pack evidence",
        ));
    }

    true
}

fn hf_weights_ready(
    weight_files: &[PathBuf],
    shard_index_path: Option<&Path>,
    blockers: &mut Vec<ModelSourceBlocker>,
) -> Result<bool> {
    if weight_files.is_empty() {
        blockers.push(blocker(
            "missing_safetensors_weights",
            "Hugging Face SafeTensors directories must include at least one .safetensors weight file",
        ));
        return Ok(false);
    }

    if weight_files.len() > 1 && shard_index_path.is_none() {
        blockers.push(blocker(
            "missing_shard_index",
            "sharded SafeTensors directories must include model.safetensors.index.json before weights readiness can be reported",
        ));
        return Ok(false);
    }

    if let Some(shard_index_path) = shard_index_path {
        let bytes = fs::read(shard_index_path).map_err(|source| BackendError::Io {
            path: shard_index_path.to_path_buf(),
            source,
        })?;
        let Ok(index) = serde_json::from_slice::<Value>(&bytes) else {
            blockers.push(blocker(
                "invalid_shard_index_json",
                format!(
                    "SafeTensors shard index file {} is not valid JSON",
                    public_path_label(shard_index_path)
                ),
            ));
            return Ok(false);
        };
        if !hf_shard_index_weight_map_ready(&index, weight_files, blockers) {
            return Ok(false);
        }
    }

    Ok(true)
}

fn hf_shard_index_weight_map_ready(
    index: &Value,
    weight_files: &[PathBuf],
    blockers: &mut Vec<ModelSourceBlocker>,
) -> bool {
    let Some(weight_map) = index.get("weight_map").and_then(Value::as_object) else {
        blockers.push(blocker(
            "missing_shard_index_weight_map",
            "model.safetensors.index.json must include a weight_map object before sharded weights readiness can be reported",
        ));
        return false;
    };
    if weight_map.is_empty() {
        blockers.push(blocker(
            "empty_shard_index_weight_map",
            "model.safetensors.index.json weight_map must list at least one tensor shard before sharded weights readiness can be reported",
        ));
        return false;
    }

    let available = weight_files
        .iter()
        .filter_map(|path| path.file_name().and_then(|name| name.to_str()))
        .collect::<BTreeSet<_>>();
    let mut missing = BTreeSet::new();
    let mut invalid = BTreeSet::new();
    let mut invalid_filenames = BTreeSet::new();
    for (tensor_name, shard_name) in weight_map {
        let Some(shard_name) = shard_name.as_str() else {
            invalid.insert(tensor_name.as_str());
            continue;
        };
        if !is_plain_safetensors_shard_filename(shard_name) {
            invalid_filenames.insert(tensor_name.as_str());
            continue;
        }
        if !available.contains(shard_name) {
            missing.insert(shard_name);
        }
    }

    if !invalid.is_empty() {
        blockers.push(blocker(
            "invalid_shard_index_weight_map",
            format!(
                "model.safetensors.index.json weight_map entries must map tensor names to shard filenames; invalid entries: {}",
                invalid.into_iter().collect::<Vec<_>>().join(", ")
            ),
        ));
        return false;
    }
    if !invalid_filenames.is_empty() {
        blockers.push(blocker(
            "invalid_shard_index_shard_filename",
            format!(
                "model.safetensors.index.json weight_map shard values must be local shard filenames, not paths; invalid tensor entries: {}",
                invalid_filenames.into_iter().collect::<Vec<_>>().join(", ")
            ),
        ));
        return false;
    }
    if !missing.is_empty() {
        blockers.push(blocker(
            "missing_sharded_weight_file",
            format!(
                "model.safetensors.index.json references shard files that are not present locally: {}",
                missing.into_iter().collect::<Vec<_>>().join(", ")
            ),
        ));
        return false;
    }

    true
}

fn is_plain_safetensors_shard_filename(value: &str) -> bool {
    !value.is_empty()
        && !value.contains('/')
        && !value.contains('\\')
        && value != "."
        && value != ".."
        && has_extension(Path::new(value), "safetensors")
}

fn safetensors_files(path: &Path) -> Result<Vec<PathBuf>> {
    let entries = fs::read_dir(path).map_err(|source| BackendError::Io {
        path: path.to_path_buf(),
        source,
    })?;
    let mut files = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|source| BackendError::Io {
            path: path.to_path_buf(),
            source,
        })?;
        let candidate = entry.path();
        if candidate.is_file() && has_extension(&candidate, "safetensors") {
            files.push(candidate);
        }
    }
    files.sort();
    Ok(files)
}

fn existing_child(root: &Path, name: &str) -> Option<PathBuf> {
    let candidate = root.join(name);
    candidate.is_file().then_some(candidate)
}

fn has_extension(path: &Path, extension: &str) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.eq_ignore_ascii_case(extension))
}

fn source_id(path: &Path) -> String {
    let name = if has_extension(path, "gguf") {
        path.file_stem().or_else(|| path.file_name())
    } else {
        path.file_name()
    };
    name.and_then(|value| value.to_str())
        .unwrap_or("model")
        .to_string()
}

fn public_path_label(path: &Path) -> String {
    path.file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("model source file")
        .to_string()
}

fn blocker(code: &'static str, message: impl Into<String>) -> ModelSourceBlocker {
    ModelSourceBlocker {
        code,
        message: message.into(),
    }
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path};

    use super::*;

    #[test]
    fn complete_hf_safetensors_directory_reports_readiness_but_not_generation() {
        let dir = tempfile::tempdir().unwrap();
        write_llama_config(dir.path());
        fs::write(dir.path().join("tokenizer.json"), "{}").unwrap();
        fs::write(dir.path().join("tokenizer_config.json"), "{}").unwrap();
        fs::write(dir.path().join("special_tokens_map.json"), "{}").unwrap();
        fs::write(dir.path().join("generation_config.json"), "{}").unwrap();
        fs::write(dir.path().join("model-00001-of-00002.safetensors"), b"").unwrap();
        fs::write(dir.path().join("model-00002-of-00002.safetensors"), b"").unwrap();
        fs::write(
            dir.path().join("model.safetensors.index.json"),
            r#"{"weight_map":{"model.embed_tokens.weight":"model-00001-of-00002.safetensors","lm_head.weight":"model-00002-of-00002.safetensors"}}"#,
        )
        .unwrap();

        let inspection = inspect_model_source(dir.path()).unwrap();

        assert_eq!(
            inspection.manifest.kind,
            ModelSourceKind::HuggingFaceSafeTensors
        );
        assert_eq!(inspection.manifest.weight_files.len(), 2);
        assert!(inspection.manifest.config_path.is_some());
        assert!(inspection.manifest.tokenizer_path.is_some());
        assert!(inspection.manifest.shard_index_path.is_some());
        assert!(inspection.readiness.metadata_ready);
        assert!(inspection.readiness.tokenizer_ready);
        assert!(inspection.readiness.weights_ready);
        assert!(!inspection.readiness.generation_ready);
        assert_blocker_codes(&inspection, &["generation_disabled"]);
    }

    #[test]
    fn missing_tokenizer_fixture_has_precise_blocker() {
        let dir = tempfile::tempdir().unwrap();
        write_llama_config(dir.path());
        fs::write(dir.path().join("model.safetensors"), b"").unwrap();

        let inspection = inspect_model_source(dir.path()).unwrap();

        assert!(inspection.readiness.metadata_ready);
        assert!(!inspection.readiness.tokenizer_ready);
        assert!(inspection.readiness.weights_ready);
        assert_blocker_codes(
            &inspection,
            &["missing_tokenizer_json", "generation_disabled"],
        );
    }

    #[test]
    fn sharded_weights_without_index_have_precise_blocker() {
        let dir = tempfile::tempdir().unwrap();
        write_llama_config(dir.path());
        fs::write(dir.path().join("tokenizer.json"), "{}").unwrap();
        fs::write(dir.path().join("model-00001-of-00002.safetensors"), b"").unwrap();
        fs::write(dir.path().join("model-00002-of-00002.safetensors"), b"").unwrap();

        let inspection = inspect_model_source(dir.path()).unwrap();

        assert!(inspection.readiness.metadata_ready);
        assert!(inspection.readiness.tokenizer_ready);
        assert!(!inspection.readiness.weights_ready);
        assert_blocker_codes(&inspection, &["missing_shard_index", "generation_disabled"]);
    }

    #[test]
    fn invalid_shard_index_has_precise_blocker() {
        let dir = tempfile::tempdir().unwrap();
        write_llama_config(dir.path());
        fs::write(dir.path().join("tokenizer.json"), "{}").unwrap();
        fs::write(dir.path().join("model-00001-of-00002.safetensors"), b"").unwrap();
        fs::write(dir.path().join("model-00002-of-00002.safetensors"), b"").unwrap();
        fs::write(dir.path().join("model.safetensors.index.json"), "not json").unwrap();

        let inspection = inspect_model_source(dir.path()).unwrap();

        assert!(!inspection.readiness.weights_ready);
        assert_blocker_codes(
            &inspection,
            &["invalid_shard_index_json", "generation_disabled"],
        );
        assert_public_blocker_message_without_local_path(
            &inspection.readiness.blockers[0].message,
            dir.path(),
        );
        assert!(inspection.readiness.blockers[0]
            .message
            .contains("model.safetensors.index.json"));
    }

    #[test]
    fn shard_index_without_weight_map_has_precise_blocker() {
        let dir = tempfile::tempdir().unwrap();
        write_llama_config(dir.path());
        fs::write(dir.path().join("tokenizer.json"), "{}").unwrap();
        fs::write(dir.path().join("model-00001-of-00002.safetensors"), b"").unwrap();
        fs::write(dir.path().join("model-00002-of-00002.safetensors"), b"").unwrap();
        fs::write(dir.path().join("model.safetensors.index.json"), "{}").unwrap();

        let inspection = inspect_model_source(dir.path()).unwrap();

        assert!(!inspection.readiness.weights_ready);
        assert_blocker_codes(
            &inspection,
            &["missing_shard_index_weight_map", "generation_disabled"],
        );
    }

    #[test]
    fn shard_index_referencing_missing_weight_file_has_precise_blocker() {
        let dir = tempfile::tempdir().unwrap();
        write_llama_config(dir.path());
        fs::write(dir.path().join("tokenizer.json"), "{}").unwrap();
        fs::write(dir.path().join("model-00001-of-00002.safetensors"), b"").unwrap();
        fs::write(dir.path().join("model-00002-of-00002.safetensors"), b"").unwrap();
        fs::write(
            dir.path().join("model.safetensors.index.json"),
            r#"{"weight_map":{"model.embed_tokens.weight":"model-00003-of-00003.safetensors"}}"#,
        )
        .unwrap();

        let inspection = inspect_model_source(dir.path()).unwrap();

        assert!(!inspection.readiness.weights_ready);
        assert_blocker_codes(
            &inspection,
            &["missing_sharded_weight_file", "generation_disabled"],
        );
        assert!(inspection.readiness.blockers[0]
            .message
            .contains("model-00003-of-00003.safetensors"));
    }

    #[test]
    fn invalid_config_json_has_sanitized_precise_blocker() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(dir.path().join("config.json"), "not json").unwrap();
        fs::write(dir.path().join("tokenizer.json"), "{}").unwrap();
        fs::write(dir.path().join("model.safetensors"), b"").unwrap();

        let inspection = inspect_model_source(dir.path()).unwrap();

        assert!(!inspection.readiness.metadata_ready);
        assert!(inspection.readiness.tokenizer_ready);
        assert!(inspection.readiness.weights_ready);
        assert_blocker_codes(&inspection, &["invalid_config_json", "generation_disabled"]);
        assert_public_blocker_message_without_local_path(
            &inspection.readiness.blockers[0].message,
            dir.path(),
        );
        assert!(inspection.readiness.blockers[0]
            .message
            .contains("config.json"));
    }

    #[test]
    fn unsupported_config_fixture_has_precise_blocker() {
        let dir = tempfile::tempdir().unwrap();
        fs::write(
            dir.path().join("config.json"),
            r#"{"model_type":"mistral","architectures":["MistralForCausalLM"]}"#,
        )
        .unwrap();
        fs::write(dir.path().join("tokenizer.json"), "{}").unwrap();
        fs::write(dir.path().join("model.safetensors"), b"").unwrap();

        let inspection = inspect_model_source(dir.path()).unwrap();

        assert!(!inspection.readiness.metadata_ready);
        assert!(inspection.readiness.tokenizer_ready);
        assert!(inspection.readiness.weights_ready);
        assert_blocker_codes(
            &inspection,
            &["unsupported_model_type", "generation_disabled"],
        );
    }

    #[test]
    fn shard_index_path_values_have_sanitized_precise_blocker() {
        let dir = tempfile::tempdir().unwrap();
        write_llama_config(dir.path());
        fs::write(dir.path().join("tokenizer.json"), "{}").unwrap();
        fs::write(dir.path().join("model-00001-of-00002.safetensors"), b"").unwrap();
        fs::write(dir.path().join("model-00002-of-00002.safetensors"), b"").unwrap();
        fs::write(
            dir.path().join("model.safetensors.index.json"),
            r#"{"weight_map":{"model.embed_tokens.weight":"../private/model-00001-of-00002.safetensors","lm_head.weight":"C:\\private\\model-00002-of-00002.safetensors"}}"#,
        )
        .unwrap();

        let inspection = inspect_model_source(dir.path()).unwrap();

        assert!(!inspection.readiness.weights_ready);
        assert_blocker_codes(
            &inspection,
            &["invalid_shard_index_shard_filename", "generation_disabled"],
        );
        let message = &inspection.readiness.blockers[0].message;
        assert!(message.contains("model.embed_tokens.weight"));
        assert!(message.contains("lm_head.weight"));
        assert!(!message.contains("../private"));
        assert!(!message.contains("C:"));
        assert!(!message.contains("model-00001-of-00002.safetensors"));
        assert!(!message.contains("model-00002-of-00002.safetensors"));
    }

    #[test]
    fn shard_index_invalid_entries_are_reported_in_stable_tensor_order() {
        let dir = tempfile::tempdir().unwrap();
        write_llama_config(dir.path());
        fs::write(dir.path().join("tokenizer.json"), "{}").unwrap();
        fs::write(dir.path().join("model-00001-of-00002.safetensors"), b"").unwrap();
        fs::write(dir.path().join("model-00002-of-00002.safetensors"), b"").unwrap();
        fs::write(
            dir.path().join("model.safetensors.index.json"),
            r#"{"weight_map":{"z.weight":42,"a.weight":false}}"#,
        )
        .unwrap();

        let inspection = inspect_model_source(dir.path()).unwrap();

        assert!(!inspection.readiness.weights_ready);
        assert_blocker_codes(
            &inspection,
            &["invalid_shard_index_weight_map", "generation_disabled"],
        );
        let message = &inspection.readiness.blockers[0].message;
        assert!(message.ends_with("invalid entries: a.weight, z.weight"));
    }

    #[test]
    fn hf_directory_source_id_preserves_dotted_model_name() {
        let root = tempfile::tempdir().unwrap();
        let model_dir = root.path().join("Meta-Llama-3.1-8B-Instruct");
        fs::create_dir(&model_dir).unwrap();
        write_llama_config(&model_dir);
        fs::write(model_dir.join("tokenizer.json"), "{}").unwrap();
        fs::write(model_dir.join("model.safetensors"), b"").unwrap();

        let inspection = inspect_model_source(&model_dir).unwrap();

        assert_eq!(inspection.manifest.id, "Meta-Llama-3.1-8B-Instruct");
    }

    #[test]
    fn gguf_file_source_id_strips_only_gguf_extension() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("TinyLlama-1.1B-Chat-v1.0.Q8_0.gguf");
        fs::write(&path, b"").unwrap();

        let inspection = inspect_model_source(&path).unwrap();

        assert_eq!(inspection.manifest.id, "TinyLlama-1.1B-Chat-v1.0.Q8_0");
    }

    #[test]
    fn unsupported_source_file_error_uses_public_label_without_parent_path() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("not-a-model.bin");
        fs::write(&path, b"").unwrap();

        let err = inspect_model_source(&path).unwrap_err().to_string();

        assert!(err.contains("not-a-model.bin"));
        assert_public_blocker_message_without_local_path(&err, dir.path());
    }

    fn write_llama_config(root: &Path) {
        fs::write(
            root.join("config.json"),
            r#"{"model_type":"llama","architectures":["LlamaForCausalLM"]}"#,
        )
        .unwrap();
    }

    fn assert_blocker_codes(inspection: &ModelSourceInspection, expected: &[&str]) {
        let actual = inspection
            .readiness
            .blockers
            .iter()
            .map(|blocker| blocker.code)
            .collect::<Vec<_>>();
        assert_eq!(actual, expected);
    }

    fn assert_public_blocker_message_without_local_path(message: &str, root: &Path) {
        let root = root.display().to_string();
        assert!(
            !message.contains(&root),
            "blocker message leaked local path {root:?}: {message}"
        );
        assert!(
            !message.contains("/var/") && !message.contains("/private/"),
            "blocker message leaked a private temp path: {message}"
        );
    }
}
