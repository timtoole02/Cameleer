use serde::{Deserialize, Serialize};
use crate::config::Config;
use crate::storage::ChatMessage;

pub enum LlmClient {
    Ollama(OllamaClient),
    Anthropic(AnthropicClient),
    OpenAi(OpenAiClient),
    Gemini(GeminiClient),
    Camelid(CamelidClient),
}

impl LlmClient {
    pub async fn chat(&self, history: Vec<ChatMessage>, system_prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
        match self {
            Self::Ollama(client) => client.chat(history, system_prompt).await,
            Self::Anthropic(client) => client.chat(history, system_prompt).await,
            Self::OpenAi(client) => client.chat(history, system_prompt).await,
            Self::Gemini(client) => client.chat(history, system_prompt).await,
            Self::Camelid(client) => client.chat(history, system_prompt).await,
        }
    }
}

pub struct AnthropicClient {
    api_key: String,
    model: String,
}

pub struct OpenAiClient {
    api_key: String,
    model: String,
}

pub struct GeminiClient {
    api_key: String,
    model: String,
}

pub struct OllamaClient {
    url: String,
    model: String,
}

// Implement Ollama Client
impl OllamaClient {
    pub async fn chat(&self, history: Vec<ChatMessage>, system_prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        
        #[derive(Serialize, Deserialize)]
        struct OllamaMessage {
            role: String,
            content: String,
        }

        #[derive(Serialize)]
        struct OllamaRequest {
            model: String,
            messages: Vec<OllamaMessage>,
            stream: bool,
        }

        #[derive(Deserialize)]
        struct OllamaResponse {
            message: OllamaMessage,
        }

        let mut messages = Vec::new();
        messages.push(OllamaMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        });

        for msg in history {
            messages.push(OllamaMessage {
                role: msg.role,
                content: msg.content,
            });
        }

        let payload = OllamaRequest {
            model: self.model.clone(),
            messages,
            stream: false,
        };

        let response = client
            .post(format!("{}/api/chat", self.url))
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Ollama API error: {}", error_text).into());
        }

        let res_body: OllamaResponse = response.json().await?;
        Ok(res_body.message.content)
    }
}

// Implement Anthropic Client
impl AnthropicClient {
    pub async fn chat(&self, history: Vec<ChatMessage>, system_prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();

        #[derive(Serialize)]
        struct AnthropicMessage {
            role: String,
            content: String,
        }

        #[derive(Serialize)]
        struct AnthropicRequest {
            model: String,
            messages: Vec<AnthropicMessage>,
            system: String,
            max_tokens: u32,
        }

        #[derive(Deserialize)]
        struct ContentItem {
            text: String,
        }

        #[derive(Deserialize)]
        struct AnthropicResponse {
            content: Vec<ContentItem>,
        }

        let mut messages = Vec::new();
        for msg in history {
            // Anthropic doesn't allow 'system' role inside messages array, only in system param
            if msg.role != "system" {
                messages.push(AnthropicMessage {
                    role: if msg.role == "user" { "user".to_string() } else { "assistant".to_string() },
                    content: msg.content,
                });
            }
        }

        let payload = AnthropicRequest {
            model: self.model.clone(),
            messages,
            system: system_prompt.to_string(),
            max_tokens: 4096,
        };

        let response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Anthropic API error: {}", error_text).into());
        }

        let res_body: AnthropicResponse = response.json().await?;
        if res_body.content.is_empty() {
            return Err("Empty response from Anthropic".into());
        }
        Ok(res_body.content[0].text.clone())
    }
}

// Implement OpenAI Client
impl OpenAiClient {
    pub async fn chat(&self, history: Vec<ChatMessage>, system_prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();

        #[derive(Serialize, Deserialize)]
        struct OpenAiMessage {
            role: String,
            content: String,
        }

        #[derive(Serialize)]
        struct OpenAiRequest {
            model: String,
            messages: Vec<OpenAiMessage>,
        }

        #[derive(Deserialize)]
        struct MessageChoice {
            message: OpenAiMessage,
        }

        #[derive(Deserialize)]
        struct OpenAiResponse {
            choices: Vec<MessageChoice>,
        }

        let mut messages = Vec::new();
        messages.push(OpenAiMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        });

        for msg in history {
            messages.push(OpenAiMessage {
                role: msg.role,
                content: msg.content,
            });
        }

        let payload = OpenAiRequest {
            model: self.model.clone(),
            messages,
        };

        let response = client
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(&self.api_key)
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("OpenAI API error: {}", error_text).into());
        }

        let res_body: OpenAiResponse = response.json().await?;
        if res_body.choices.is_empty() {
            return Err("Empty choices from OpenAI".into());
        }
        Ok(res_body.choices[0].message.content.clone())
    }
}

// Implement Gemini Client
impl GeminiClient {
    pub async fn chat(&self, history: Vec<ChatMessage>, system_prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();

        #[derive(Serialize)]
        struct Part {
            text: String,
        }

        #[derive(Serialize)]
        struct Content {
            role: String,
            parts: Vec<Part>,
        }

        #[derive(Serialize)]
        struct SystemInstruction {
            parts: Vec<Part>,
        }

        #[derive(Serialize)]
        struct GeminiRequest {
            contents: Vec<Content>,
            #[serde(rename = "systemInstruction")]
            system_instruction: SystemInstruction,
        }

        #[derive(Deserialize)]
        struct Candidate {
            content: GeminiResponseContent,
        }

        #[derive(Deserialize)]
        struct GeminiResponseContent {
            parts: Vec<PartResponse>,
        }

        #[derive(Deserialize)]
        struct PartResponse {
            text: String,
        }

        #[derive(Deserialize)]
        struct GeminiResponse {
            candidates: Vec<Candidate>,
        }

        let mut contents = Vec::new();
        for msg in history {
            if msg.role != "system" {
                contents.push(Content {
                    role: if msg.role == "user" { "user".to_string() } else { "model".to_string() },
                    parts: vec![Part { text: msg.content }],
                });
            }
        }

        let payload = GeminiRequest {
            contents,
            system_instruction: SystemInstruction {
                parts: vec![Part { text: system_prompt.to_string() }],
            },
        };

        let response = client
            .post(format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                self.model, self.api_key
            ))
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Gemini API error: {}", error_text).into());
        }

        let res_body: GeminiResponse = response.json().await?;
        if res_body.candidates.is_empty() || res_body.candidates[0].content.parts.is_empty() {
            return Err("Empty response from Gemini".into());
        }
        Ok(res_body.candidates[0].content.parts[0].text.clone())
    }
}

pub struct CamelidClient {
    url: String,
    model: String,
}

impl CamelidClient {
    pub async fn chat(&self, history: Vec<ChatMessage>, system_prompt: &str) -> Result<String, Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();
        
        #[derive(Serialize, Deserialize)]
        struct OpenAiMessage {
            role: String,
            content: String,
        }

        #[derive(Serialize)]
        struct OpenAiRequest {
            messages: Vec<OpenAiMessage>,
        }

        #[derive(Deserialize)]
        struct MessageChoice {
            message: OpenAiMessage,
        }

        #[derive(Deserialize)]
        struct OpenAiResponse {
            choices: Vec<MessageChoice>,
        }

        let mut messages = Vec::new();
        messages.push(OpenAiMessage {
            role: "system".to_string(),
            content: system_prompt.to_string(),
        });

        for msg in history {
            messages.push(OpenAiMessage {
                role: msg.role,
                content: msg.content,
            });
        }

        let payload = OpenAiRequest {
            messages,
        };

        let response = client
            .post(format!("{}/v1/chat/completions", self.url))
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Camelid API error: {}", error_text).into());
        }

        let res_body: OpenAiResponse = response.json().await?;
        if res_body.choices.is_empty() {
            return Err("Empty choices from Camelid".into());
        }
        Ok(res_body.choices[0].message.content.clone())
    }
}

// Factory function
pub fn create_client(config: &Config) -> Result<LlmClient, Box<dyn std::error::Error>> {
    match config.llm.provider.as_str() {
        "camelid" => Ok(LlmClient::Camelid(CamelidClient {
            url: "http://127.0.0.1:8181".to_string(),
            model: config.llm.model.clone(),
        })),
        "ollama" => Ok(LlmClient::Ollama(OllamaClient {
            url: config.llm.ollama_url.clone(),
            model: config.llm.model.clone(),
        })),
        "anthropic" => {
            let key = config.llm.anthropic_api_key.as_ref()
                .ok_or("Anthropic API key is missing in config")?;
            Ok(LlmClient::Anthropic(AnthropicClient {
                api_key: key.clone(),
                model: config.llm.model.clone(),
            }))
        }
        "openai" => {
            let key = config.llm.openai_api_key.as_ref()
                .ok_or("OpenAI API key is missing in config")?;
            Ok(LlmClient::OpenAi(OpenAiClient {
                api_key: key.clone(),
                model: config.llm.model.clone(),
            }))
        }
        "gemini" => {
            let key = config.llm.gemini_api_key.as_ref()
                .ok_or("Gemini API key is missing in config")?;
            Ok(LlmClient::Gemini(GeminiClient {
                api_key: key.clone(),
                model: config.llm.model.clone(),
            }))
        }
        _ => Err(format!("Unsupported LLM provider: {}", config.llm.provider).into()),
    }
}
