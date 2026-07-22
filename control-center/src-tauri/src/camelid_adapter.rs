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

#[cfg(test)]
mod tests {
    //! Adversarial tests for the local-camelid HTTP adapter. A hand-rolled
    //! single-shot TCP listener stands in for the inference server (no extra
    //! dependencies) so we can pin the connect-failure and each response-shape
    //! error path against REAL behavior.
    use super::*;
    use crate::router::{ChatMessage, ModelSettings};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    fn messages() -> Vec<ChatMessage> {
        vec![ChatMessage {
            role: "user".to_string(),
            content: "hi".to_string(),
        }]
    }

    fn settings() -> ModelSettings {
        ModelSettings {
            temperature: None,
            max_tokens: None,
        }
    }

    /// Spawn a one-shot HTTP stub that accepts a single connection and replies
    /// with `status_line` + `body`. Returns the full chat-completions URL to
    /// hand the adapter (which treats `endpoint` as the complete URL).
    async fn spawn_stub(status_line: &'static str, body: &'static str) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            if let Ok((mut socket, _)) = listener.accept().await {
                // Drain the (tiny) request; over loopback it arrives in one read.
                let mut buf = [0u8; 4096];
                let _ = socket.read(&mut buf).await;
                let response = format!(
                    "HTTP/1.1 {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
                    status_line,
                    body.len(),
                    body
                );
                let _ = socket.write_all(response.as_bytes()).await;
                let _ = socket.flush().await;
            }
        });
        format!("http://{}/v1/chat/completions", addr)
    }

    #[tokio::test]
    async fn dead_port_returns_connect_error() {
        let adapter = CamelidAdapter::new();
        let res = adapter
            .infer(
                "model",
                messages(),
                settings(),
                None,
                Some("http://127.0.0.1:9/v1/chat/completions".to_string()),
            )
            .await;
        let err = res.expect_err("dead port must error");
        assert!(
            err.starts_with("Failed to connect to local camelid"),
            "unexpected error: {err}"
        );
    }

    #[tokio::test]
    async fn ok_response_returns_content() {
        let url = spawn_stub("200 OK", r#"{"choices":[{"message":{"content":"hi"}}]}"#).await;
        let adapter = CamelidAdapter::new();
        let res = adapter
            .infer("model", messages(), settings(), None, Some(url))
            .await;
        assert_eq!(res.unwrap(), "hi");
    }

    #[tokio::test]
    async fn server_error_status_is_reported() {
        let url = spawn_stub("500 Internal Server Error", r#"{"error":"boom"}"#).await;
        let adapter = CamelidAdapter::new();
        let res = adapter
            .infer("model", messages(), settings(), None, Some(url))
            .await;
        let err = res.expect_err("500 must error");
        assert!(
            err.contains("Camelid error response"),
            "unexpected error: {err}"
        );
    }

    #[tokio::test]
    async fn missing_choices_content_is_reported() {
        let url = spawn_stub("200 OK", "{}").await;
        let adapter = CamelidAdapter::new();
        let res = adapter
            .infer("model", messages(), settings(), None, Some(url))
            .await;
        let err = res.expect_err("empty json must error");
        assert!(
            err.contains("Failed to retrieve content"),
            "unexpected error: {err}"
        );
    }
}
