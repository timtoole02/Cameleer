mod reader;

pub use reader::{GgufFile, GgufMetadataValue, GgufTensorDescriptor, GgufTensorType};

use std::path::Path;

use crate::Result;

pub fn read_metadata(path: impl AsRef<Path>) -> Result<GgufFile> {
    reader::read_metadata(path.as_ref())
}
