use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use reqwest::Client;
use tauri::State;
use crate::storage::DbState;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelSettings {
    pub temperature: Option<f64>,
    pub max_tokens: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProviderConfig {
    pub id: i32,
    pub provider: String,
    pub model_name: String,
    pub api_key: Option<String>,
    pub endpoint_url: Option<String>,
    pub is_default: bool,
}

#[tauri::command]
pub async fn list_provider_configs(state: State<'_, DbState>) -> Result<Vec<ProviderConfig>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, provider, model_name, api_key, endpoint_url, is_default FROM model_configs")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(ProviderConfig {
                id: row.get(0)?,
                provider: row.get(1)?,
                model_name: row.get(2)?,
                api_key: row.get(3)?,
                endpoint_url: row.get(4)?,
                is_default: row.get::<_, i32>(5)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut configs = Vec::new();
    for config in iter {
        configs.push(config.map_err(|e| e.to_string())?);
    }
    Ok(configs)
}

#[tauri::command]
pub async fn save_provider_config(
    state: State<'_, DbState>,
    provider: String,
    model_name: String,
    api_key: Option<String>,
    endpoint_url: Option<String>,
    is_default: bool,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    if is_default {
        conn.execute("UPDATE model_configs SET is_default = 0 WHERE provider = ?1", [&provider])
            .map_err(|e| e.to_string())?;
    }

    conn.execute(
        "INSERT INTO model_configs (provider, model_name, api_key, endpoint_url, is_default)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![
            provider,
            model_name,
            api_key,
            endpoint_url,
            if is_default { 1 } else { 0 }
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Low-level LLM router execution function
pub async fn call_model(
    provider: &str,
    model_name: &str,
    messages: Vec<ChatMessage>,
    settings: ModelSettings,
    api_key: Option<String>,
    endpoint: Option<String>,
) -> Result<String, String> {
    let client = Client::new();

    match provider.to_lowercase().as_str() {
        "camelid" => {
            // Local camelid: by default uses port 8181 or falls back to 8080.
            let url = endpoint.unwrap_or_else(|| "http://127.0.0.1:8181/v1/chat/completions".to_string());
            
            // Build the payload. CRITICAL: Omit model parameter if we want it to fall back to the currently loaded model,
            // or if it matches camelid defaults. We omit it here as recommended for best compatibility.
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
        }
        "ollama" => {
            let url = endpoint.unwrap_or_else(|| "http://127.0.0.1:11434/v1/chat/completions".to_string());
            let mut payload = serde_json::json!({
                "model": model_name,
                "messages": messages,
            });

            if let Some(t) = settings.temperature {
                payload["temperature"] = serde_json::json!(t);
            }

            let response = client
                .post(&url)
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Failed to connect to Ollama: {}", e))?;

            if !response.status().is_success() {
                let err_text = response.text().await.unwrap_or_default();
                return Err(format!("Ollama error response: {}", err_text));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

            let text = json["choices"][0]["message"]["content"]
                .as_str()
                .ok_or_else(|| "Failed to retrieve content from choices".to_string())?;

            Ok(text.to_string())
        }
        "openai" => {
            let url = endpoint.unwrap_or_else(|| "https://api.openai.com/v1/chat/completions".to_string());
            let key = api_key.ok_or_else(|| "Missing API key for OpenAI".to_string())?;

            let mut payload = serde_json::json!({
                "model": model_name,
                "messages": messages,
            });

            if let Some(t) = settings.temperature {
                payload["temperature"] = serde_json::json!(t);
            }

            let response = client
                .post(&url)
                .header("Authorization", format!("Bearer {}", key))
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Failed to connect to OpenAI: {}", e))?;

            if !response.status().is_success() {
                let err_text = response.text().await.unwrap_or_default();
                return Err(format!("OpenAI error response: {}", err_text));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse OpenAI response: {}", e))?;

            let text = json["choices"][0]["message"]["content"]
                .as_str()
                .ok_or_else(|| "Failed to retrieve content from choices".to_string())?;

            Ok(text.to_string())
        }
        "anthropic" => {
            let url = endpoint.unwrap_or_else(|| "https://api.anthropic.com/v1/messages".to_string());
            let key = api_key.ok_or_else(|| "Missing API key for Anthropic".to_string())?;

            // Anthropic has a different payload format
            let mut anthropic_messages = Vec::new();
            let mut system_prompt = String::new();

            for msg in messages {
                if msg.role == "system" {
                    system_prompt = msg.content;
                } else {
                    anthropic_messages.push(serde_json::json!({
                        "role": msg.role,
                        "content": msg.content,
                    }));
                }
            }

            let mut payload = serde_json::json!({
                "model": model_name,
                "messages": anthropic_messages,
                "max_tokens": settings.max_tokens.unwrap_or(2048),
            });

            if !system_prompt.is_empty() {
                payload["system"] = serde_json::json!(system_prompt);
            }
            if let Some(t) = settings.temperature {
                payload["temperature"] = serde_json::json!(t);
            }

            let response = client
                .post(&url)
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
                .json(&payload)
                .send()
                .await
                .map_err(|e| format!("Failed to connect to Anthropic: {}", e))?;

            if !response.status().is_success() {
                let err_text = response.text().await.unwrap_or_default();
                return Err(format!("Anthropic error response: {}", err_text));
            }

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| format!("Failed to parse Anthropic response: {}", e))?;

            let text = json["content"][0]["text"]
                .as_str()
                .ok_or_else(|| "Failed to retrieve content from choices".to_string())?;

            Ok(text.to_string())
        }
        _ => Err(format!("Unsupported provider: {}", provider)),
    }
}

// --- LOCAL MODEL DOWNLOADER & MANAGEMENT COMMANDS ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModelsResponse {
    pub downloaded: Vec<String>,
    pub active_model: Option<String>,
    pub download_state: serde_json::Value,
}

fn get_models_dir() -> std::path::PathBuf {
    let mut path = std::path::PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/Users/timtoole".to_string()));
    path.push(".cameleer");
    path.push("models");
    path
}

#[tauri::command]
pub async fn get_local_models(state: State<'_, DbState>) -> Result<LocalModelsResponse, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 1. Get downloaded .gguf models
    let mut downloaded = Vec::new();
    let models_dir = get_models_dir();
    if models_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(models_dir) {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if name.to_lowercase().ends_with(".gguf") {
                            downloaded.push(name);
                        }
                    }
                }
            }
        }
    }

    // 2. Get active local model
    let active_model: Option<String> = conn
        .query_row(
            "SELECT value FROM shared_state WHERE key = 'active_local_model'",
            [],
            |row| row.get(0),
        )
        .ok();

    // 3. Get download state
    let download_state_str: Option<String> = conn
        .query_row(
            "SELECT value FROM shared_state WHERE key = 'download_progress'",
            [],
            |row| row.get(0),
        )
        .ok();

    let download_state: serde_json::Value = if let Some(s) = download_state_str {
        serde_json::from_str(&s).unwrap_or_else(|_| {
            serde_json::json!({
                "downloading": false,
                "model": "",
                "progress": 0.0,
                "error": null
            })
        })
    } else {
        serde_json::json!({
            "downloading": false,
            "model": "",
            "progress": 0.0,
            "error": null
        })
    };

    Ok(LocalModelsResponse {
        downloaded,
        active_model,
        download_state,
    })
}

#[tauri::command]
pub async fn download_model(state: State<'_, DbState>, model_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Check if download already in progress
    let is_downloading: bool = conn
        .query_row(
            "SELECT value FROM shared_state WHERE key = 'download_progress'",
            [],
            |row| {
                let val_str: String = row.get(0)?;
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&val_str) {
                    Ok(val["downloading"].as_bool().unwrap_or(false))
                } else {
                    Ok(false)
                }
            },
        )
        .unwrap_or(false);

    if is_downloading {
        return Err("A model download is already in progress.".to_string());
    }

    // Map model_id to Hugging Face URL and filename
    let (url, filename) = match model_id.as_str() {
        "tinyllama-1.1b" => (
            "https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q8_0.gguf",
            "tinyllama-1.1b-chat-v1.0.Q8_0.gguf"
        ),
        "llama-3.2-1b" => (
            "https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q8_0.gguf",
            "Llama-3.2-1B-Instruct-Q8_0.gguf"
        ),
        "llama-3.2-3b" => (
            "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q8_0.gguf",
            "Llama-3.2-3B-Instruct-Q8_0.gguf"
        ),
        "llama-3-8b" => (
            "https://huggingface.co/bartowski/Meta-Llama-3-8B-Instruct-GGUF/resolve/main/Meta-Llama-3-8B-Instruct-Q8_0.gguf",
            "Meta-Llama-3-8B-Instruct-Q8_0.gguf"
        ),
        "mistral-7b" => (
            "https://huggingface.co/maziyarpanahi/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3.Q8_0.gguf",
            "Mistral-7B-Instruct-v0.3.Q8_0.gguf"
        ),
        _ => return Err("Invalid model_id specified.".to_string())
    };

    // Save initial progress
    let initial_progress = serde_json::json!({
        "downloading": true,
        "model": filename,
        "progress": 0.0,
        "error": null
    }).to_string();

    conn.execute(
        "INSERT INTO shared_state (key, value, updated_at) 
         VALUES ('download_progress', ?1, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = CURRENT_TIMESTAMP",
        [initial_progress],
    ).map_err(|e| e.to_string())?;

    let dl_url = url.to_string();
    let dl_filename = filename.to_string();

    tokio::spawn(async move {
        let client = Client::new();
        
        let update_progress = |percent: f64, downloading: bool, error: Option<String>| {
            let db_path = crate::storage::get_db_path();
            if let Ok(conn) = rusqlite::Connection::open(db_path) {
                let progress_val = serde_json::json!({
                    "downloading": downloading,
                    "model": dl_filename,
                    "progress": percent,
                    "error": error
                }).to_string();
                let _ = conn.execute(
                    "INSERT INTO shared_state (key, value, updated_at) 
                     VALUES ('download_progress', ?1, CURRENT_TIMESTAMP)
                     ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = CURRENT_TIMESTAMP",
                    [progress_val],
                );
            }
        };

        match client.get(&dl_url).send().await {
            Ok(res) => {
                let total_size = res.content_length().unwrap_or(0);
                let models_dir = get_models_dir();
                if let Err(e) = std::fs::create_dir_all(&models_dir) {
                    update_progress(0.0, false, Some(format!("Failed to create models directory: {}", e)));
                    return;
                }
                let file_path = models_dir.join(&dl_filename);

                match tokio::fs::File::create(&file_path).await {
                    Ok(mut file) => {
                        let mut downloaded: u64 = 0;
                        let mut stream = res.bytes_stream();
                        use futures_util::StreamExt;
                        let mut last_saved_percent = 0;

                        while let Some(chunk_res) = stream.next().await {
                            match chunk_res {
                                Ok(chunk) => {
                                    if let Err(e) = tokio::io::AsyncWriteExt::write_all(&mut file, &chunk).await {
                                        update_progress(0.0, false, Some(format!("Write failed: {}", e)));
                                        return;
                                    }
                                    downloaded += chunk.len() as u64;
                                    let percentage = if total_size > 0 {
                                        (downloaded as f64 / total_size as f64) * 100.0
                                    } else {
                                        0.0
                                    };
                                    let rounded = percentage as i64;
                                    if rounded > last_saved_percent {
                                        last_saved_percent = rounded;
                                        update_progress(percentage, true, None);
                                    }
                                }
                                Err(e) => {
                                    update_progress(0.0, false, Some(format!("Stream error: {}", e)));
                                    return;
                                }
                            }
                        }

                        // Complete!
                        update_progress(100.0, false, None);
                    }
                    Err(e) => {
                        update_progress(0.0, false, Some(format!("Failed to create file: {}", e)));
                    }
                }
            }
            Err(e) => {
                update_progress(0.0, false, Some(format!("Network request failed: {}", e)));
            }
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn activate_model(
    state: State<'_, DbState>,
    daemon_state: State<'_, crate::supervisor::DaemonState>,
    model_name: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 1. Update shared_state active_local_model
    conn.execute(
        "INSERT INTO shared_state (key, value, updated_at) 
         VALUES ('active_local_model', ?1, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = CURRENT_TIMESTAMP",
        [&model_name],
    ).map_err(|e| e.to_string())?;

    // 2. Update model_configs table for camelid provider to use the new model_name
    conn.execute(
        "UPDATE model_configs SET model_name = ?1 WHERE provider = 'camelid'",
        [&model_name],
    ).map_err(|e| e.to_string())?;

    // 3. Update all agents using 'camelid' provider to have model_name set to this
    conn.execute(
        "UPDATE agents SET model_name = ?1 WHERE model_provider = 'camelid'",
        [&model_name],
    ).map_err(|e| e.to_string())?;

    // Drop the connection lock explicitly before spawning the daemon
    drop(conn);

    // Seamlessly hot-swap the background local inference daemon
    crate::supervisor::spawn_camelid_daemon(&state, &daemon_state, Some(model_name))?;

    Ok(())
}

