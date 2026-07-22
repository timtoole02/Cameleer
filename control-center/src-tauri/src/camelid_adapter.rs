use crate::llm_adapter::LlmAdapter;
use crate::router::{ChatMessage, ModelSettings};
use reqwest::Client;
use std::future::Future;
use std::pin::Pin;

pub struct CamelidAdapter {
    client: Client,
}

impl Default for CamelidAdapter {
    fn default() -> Self {
        Self::new()
    }
}

impl CamelidAdapter {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }
}

impl LlmAdapter for CamelidAdapter {
    fn infer(
        &self,
        _model_name: &str,
        messages: Vec<ChatMessage>,
        settings: ModelSettings,
        _api_key: Option<String>,
        endpoint: Option<String>,
    ) -> Pin<Box<dyn Future<Output = Result<String, String>> + Send>> {
        let client = self.client.clone();

        Box::pin(async move {
            let url =
                endpoint.unwrap_or_else(|| "http://127.0.0.1:8181/v1/chat/completions".to_string());

            let mut payload = serde_json::json!({
                "messages": messages,
            });

            if let Some(t) = settings.temperature {
                payload["temperature"] = serde_json::json!(t);
            }
            if let Some(m) = settings.max_tokens {
                payload["max_tokens"] = serde_json::json!(m);
            }

            let response = client
                .post(&url)
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Failed to connect to local camelid: {}", e))?;

            if !response.status().is_success() {
                let err_text = response.text().await.unwrap_or_default();
                return Err(format!("Camelid error response: {}", err_text));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Camelid response JSON: {}", e))?;

            let text = json["choices"][0]["message"]["content"]
                .as_str()
                .ok_or_else(|| "Failed to retrieve content from choices".to_string())?;

            Ok(text.to_string())
        })
    }
}
