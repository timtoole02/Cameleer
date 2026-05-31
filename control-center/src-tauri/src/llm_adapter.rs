use crate::router::{ChatMessage, ModelSettings};
use serde::{Deserialize, Serialize};
use std::future::Future;
use std::pin::Pin;

pub trait LlmAdapter {
    fn infer(
        &self,
        model_name: &str,
        messages: Vec<ChatMessage>,
        settings: ModelSettings,
        api_key: Option<String>,
        endpoint: Option<String>,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send>>;
}
