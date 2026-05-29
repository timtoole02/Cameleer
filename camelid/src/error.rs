use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum BackendError {
    #[error("I/O error while reading {path}: {source}")]
    Io {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },

    #[error("invalid GGUF file: {0}")]
    InvalidGguf(String),

    #[error("unsupported GGUF feature: {0}")]
    UnsupportedGguf(String),

    #[error("unsupported tokenizer: {0}")]
    UnsupportedTokenizer(String),

    #[error("invalid tokenizer metadata: {0}")]
    InvalidTokenizerMetadata(String),

    #[error("tokenizer metadata is not available in the loaded model")]
    TokenizerNotAvailable,

    #[error("tensor not found: {0}")]
    TensorNotFound(String),

    #[error("unsupported tensor type: {0}")]
    UnsupportedTensorType(String),

    #[error("invalid tensor data: {0}")]
    InvalidTensorData(String),

    #[error("runtime shape mismatch: {0}")]
    RuntimeShapeMismatch(String),

    #[error("invalid model metadata: {0}")]
    InvalidModelMetadata(String),

    #[error("unsupported model architecture: {0}")]
    UnsupportedModelArchitecture(String),

    #[error("model is not loaded")]
    ModelNotLoaded,

    #[error("inference is not implemented yet; current build supports health checks and GGUF metadata inspection only")]
    InferenceNotImplemented,
}

pub type Result<T> = std::result::Result<T, BackendError>;
