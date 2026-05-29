use std::sync::Arc;
use std::fs;
use tokio::net::TcpListener;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use crate::agent::Agent;
use crate::skills::load_skills;

pub async fn run(agent: Arc<Agent>) -> Result<(), Box<dyn std::error::Error>> {
    let addr = "127.0.0.1:8080";
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("❌ Web Gateway failed to bind on {}: {}", addr, e);
            return Err(e.into());
        }
    };

    println!("🕸️  Cameleer Web Dashboard & UI active at http://{}", addr);

    loop {
        let (mut socket, _) = match listener.accept().await {
            Ok(conn) => conn,
            Err(_) => continue,
        };

        let agent_clone = Arc::clone(&agent);

        tokio::spawn(async move {
            let mut buffer = Vec::new();
            let mut temp_buf = [0; 8192];
            let mut headers_parsed = false;
            let mut content_length = 0;
            let mut body_start = 0;

            loop {
                let n = match socket.read(&mut temp_buf).await {
                    Ok(bytes) if bytes > 0 => bytes,
                    _ => break,
                };
                buffer.extend_from_slice(&temp_buf[..n]);

                if !headers_parsed {
                    let req_str = String::from_utf8_lossy(&buffer);
                    if let Some(pos) = req_str.find("\r\n\r\n") {
                        headers_parsed = true;
                        body_start = pos + 4;
                        // Parse Content-Length header
                        for line in req_str[..pos].lines() {
                            let line_lower = line.to_lowercase();
                            if line_lower.starts_with("content-length:") {
                                if let Some(val_str) = line.split(':').nth(1) {
                                    content_length = val_str.trim().parse::<usize>().unwrap_or(0);
                                }
                            }
                        }
                    }
                }

                if headers_parsed {
                    let current_body_len = buffer.len() - body_start;
                    if current_body_len >= content_length {
                        break;
                    }
                }
                
                // Maximum safety buffer limit (64KB)
                if buffer.len() >= 65536 {
                    break;
                }
            }

            if buffer.is_empty() {
                return;
            }

            let request = String::from_utf8_lossy(&buffer);
            let first_line = request.lines().next().unwrap_or("");
            let parts: Vec<&str> = first_line.split_whitespace().collect();
            if parts.len() < 2 {
                return;
            }

            let method = parts[0];
            let path = parts[1];

            let (status_line, content_type, body) = match (method, path) {
                ("GET", "/") | ("GET", "/index.html") => {
                    ("HTTP/1.1 200 OK", "text/html; charset=utf-8", get_dashboard_html())
                }
                ("GET", "/api/skills") => {
                    let skills_json = match load_skills() {
                        Ok(skills) => {
                            let list: Vec<serde_json::Value> = skills.iter().map(|s| {
                                serde_json::json!({
                                    "name": s.name,
                                    "description": s.description,
                                    "path": s.path.to_string_lossy(),
                                })
                            }).collect();
                            serde_json::json!(list).to_string()
                        }
                        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string()
                    };
                    ("HTTP/1.1 200 OK", "application/json", skills_json)
                }
                ("GET", p) if p.starts_with("/api/history") => {
                    let mut session_id = "console_default".to_string();
                    if let Some(pos) = p.find("session_id=") {
                        session_id = p[pos + 11..].split('&').next().unwrap_or("console_default").to_string();
                    }
                    let history_json = match agent_clone.storage().get_messages(&session_id, 50) {
                        Ok(messages) => {
                            let list: Vec<serde_json::Value> = messages.iter().map(|m| {
                                serde_json::json!({
                                    "role": m.role,
                                    "content": m.content,
                                    "timestamp": m.timestamp,
                                })
                            }).collect();
                            serde_json::json!(list).to_string()
                        }
                        Err(e) => serde_json::json!({ "error": e.to_string() }).to_string()
                    };
                    ("HTTP/1.1 200 OK", "application/json", history_json)
                }
                ("GET", "/api/audit") => {
                    let conn = rusqlite::Connection::open(crate::config::get_config_dir().join("cameleer.db")).unwrap();
                    let mut stmt = conn.prepare("SELECT id, command, status, output, timestamp FROM audit_log ORDER BY id DESC LIMIT 30").unwrap();
                    let audit_iter = stmt.query_map([], |row| {
                        Ok(serde_json::json!({
                            "id": row.get::<_, i64>(0)?,
                            "command": row.get::<_, String>(1)?,
                            "status": row.get::<_, String>(2)?,
                            "output": row.get::<_, Option<String>>(3)?,
                            "timestamp": row.get::<_, String>(4)?,
                        }))
                    }).unwrap();

                    let mut list = Vec::new();
                    for item in audit_iter {
                        if let Ok(v) = item {
                            list.push(v);
                        }
                    }
                    ("HTTP/1.1 200 OK", "application/json", serde_json::json!(list).to_string())
                }
                ("GET", "/api/pending") => {
                    let conn = rusqlite::Connection::open(crate::config::get_config_dir().join("cameleer.db")).unwrap();
                    let mut stmt = conn.prepare("SELECT id, command, timestamp FROM audit_log WHERE status = 'pending' ORDER BY id DESC").unwrap();
                    let pending_iter = stmt.query_map([], |row| {
                        Ok(serde_json::json!({
                            "id": row.get::<_, i64>(0)?,
                            "command": row.get::<_, String>(1)?,
                            "timestamp": row.get::<_, String>(2)?,
                        }))
                    }).unwrap();

                    let mut list = Vec::new();
                    for item in pending_iter {
                        if let Ok(v) = item {
                            list.push(v);
                        }
                    }
                    ("HTTP/1.1 200 OK", "application/json", serde_json::json!(list).to_string())
                }
                ("POST", "/api/approve") => {
                    // Extract payload
                    let mut approved = false;
                    let mut cmd_id: i64 = 0;
                    
                    if let Some(body_start) = request.find("\r\n\r\n") {
                        let json_body = &request[body_start + 4..];
                        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(json_body) {
                            cmd_id = payload["id"].as_i64().unwrap_or(0);
                            approved = payload["approved"].as_bool().unwrap_or(false);
                        }
                    }

                    if cmd_id > 0 {
                        let status = if approved { "approved" } else { "denied" };
                        let _ = agent_clone.storage().update_command_log(cmd_id, status, None);
                        ("HTTP/1.1 200 OK", "application/json", serde_json::json!({ "status": "success", "action": status }).to_string())
                    } else {
                        ("HTTP/1.1 400 Bad Request", "application/json", serde_json::json!({ "error": "Invalid payload" }).to_string())
                    }
                }
                ("POST", "/api/chat") => {
                    let mut user_msg = String::new();
                    let mut session_id = "console_default".to_string();
                    if let Some(body_start) = request.find("\r\n\r\n") {
                        let json_body = &request[body_start + 4..];
                        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(json_body) {
                            user_msg = payload["message"].as_str().unwrap_or("").to_string();
                            session_id = payload["session_id"].as_str().unwrap_or("console_default").to_string();
                        }
                    }

                    if !user_msg.is_empty() {
                        match agent_clone.process_message(&session_id, &user_msg, "web").await {
                            Ok(response) => {
                                ("HTTP/1.1 200 OK", "application/json", serde_json::json!({ "status": "success", "response": response }).to_string())
                            }
                            Err(e) => {
                                ("HTTP/1.1 500 Internal Server Error", "application/json", serde_json::json!({ "error": e.to_string() }).to_string())
                            }
                        }
                    } else {
                        ("HTTP/1.1 400 Bad Request", "application/json", serde_json::json!({ "error": "Empty message field" }).to_string())
                    }
                }
                ("GET", "/api/config") => {
                    let config_path = crate::config::get_config_path();
                    match fs::read_to_string(&config_path) {
                        Ok(content) => {
                            ("HTTP/1.1 200 OK", "application/json", serde_json::json!({ "config": content }).to_string())
                        }
                        Err(e) => {
                            ("HTTP/1.1 500 Internal Server Error", "application/json", serde_json::json!({ "error": e.to_string() }).to_string())
                        }
                    }
                }
                ("POST", "/api/config/save") => {
                    let mut toml_content = String::new();
                    if let Some(body_start) = request.find("\r\n\r\n") {
                        let json_body = &request[body_start + 4..];
                        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(json_body) {
                            toml_content = payload["config"].as_str().unwrap_or("").to_string();
                        }
                    }

                    if !toml_content.is_empty() {
                        // Validate TOML syntax and structure
                        match toml::from_str::<crate::config::Config>(&toml_content) {
                            Ok(_) => {
                                let config_path = crate::config::get_config_path();
                                match fs::write(&config_path, &toml_content) {
                                    Ok(_) => {
                                        ("HTTP/1.1 200 OK", "application/json", serde_json::json!({ "status": "success" }).to_string())
                                    }
                                    Err(e) => {
                                        ("HTTP/1.1 500 Internal Server Error", "application/json", serde_json::json!({ "error": format!("Failed to write config: {}", e) }).to_string())
                                    }
                                }
                            }
                            Err(e) => {
                                ("HTTP/1.1 400 Bad Request", "application/json", serde_json::json!({ "error": format!("Invalid TOML structure: {}", e) }).to_string())
                            }
                        }
                    } else {
                        ("HTTP/1.1 400 Bad Request", "application/json", serde_json::json!({ "error": "Empty config content" }).to_string())
                    }
                }
                ("POST", "/api/skills/save") => {
                    let mut name = String::new();
                    let mut content = String::new();
                    
                    if let Some(body_start) = request.find("\r\n\r\n") {
                        let json_body = &request[body_start + 4..];
                        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(json_body) {
                            name = payload["name"].as_str().unwrap_or("").to_string();
                            content = payload["content"].as_str().unwrap_or("").to_string();
                        }
                    }

                    // Clean the name to prevent directory traversal
                    let clean_name: String = name.chars().filter(|c| c.is_alphanumeric() || *c == '-' || *c == '_').collect();

                    if !clean_name.is_empty() && !content.is_empty() {
                        let skills_dir = crate::skills::get_skills_dir();
                        let skill_dir = skills_dir.join(&clean_name);
                        
                        if let Err(e) = fs::create_dir_all(&skill_dir) {
                            ("HTTP/1.1 500 Internal Server Error", "application/json", serde_json::json!({ "error": format!("Failed to create directory: {}", e) }).to_string())
                        } else {
                            let skill_file = skill_dir.join("SKILL.md");
                            match fs::write(&skill_file, &content) {
                                Ok(_) => {
                                    ("HTTP/1.1 200 OK", "application/json", serde_json::json!({ "status": "success", "path": skill_file.to_string_lossy() }).to_string())
                                }
                                Err(e) => {
                                    ("HTTP/1.1 500 Internal Server Error", "application/json", serde_json::json!({ "error": format!("Failed to write skill file: {}", e) }).to_string())
                                }
                            }
                        }
                    } else {
                        ("HTTP/1.1 400 Bad Request", "application/json", serde_json::json!({ "error": "Name and content fields are required" }).to_string())
                    }
                }
                ("POST", "/api/database/reset") => {
                    let config_dir = crate::config::get_config_dir();
                    let db_path = config_dir.join("cameleer.db");
                    match rusqlite::Connection::open(db_path) {
                        Ok(conn) => {
                            let r1 = conn.execute("DELETE FROM messages", []);
                            let r2 = conn.execute("DELETE FROM audit_log", []);
                            if r1.is_ok() && r2.is_ok() {
                                ("HTTP/1.1 200 OK", "application/json", serde_json::json!({ "status": "success" }).to_string())
                            } else {
                                let err_msg = format!("Failed to clear tables: messages={:?}, audit={:?}", r1.err(), r2.err());
                                ("HTTP/1.1 500 Internal Server Error", "application/json", serde_json::json!({ "error": err_msg }).to_string())
                            }
                        }
                        Err(e) => {
                            ("HTTP/1.1 500 Internal Server Error", "application/json", serde_json::json!({ "error": format!("Database connection error: {}", e) }).to_string())
                        }
                    }
                }
                ("GET", "/api/models/status") => {
                    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                    let models_dir = std::path::Path::new(&home).join(".cameleer").join("models");
                    
                    let mut downloaded_list = Vec::new();
                    if let Ok(entries) = fs::read_dir(&models_dir) {
                        for entry in entries.flatten() {
                            let path = entry.path();
                            if path.is_file() && path.extension().map_or(false, |ext| ext == "gguf") {
                                if let Some(filename) = path.file_name().and_then(|f| f.to_str()) {
                                    downloaded_list.push(filename.to_string());
                                }
                            }
                        }
                    }

                    let active_model = agent_clone.config().llm.model.clone();

                    let download_state = match agent_clone.storage().kv_get("download_progress") {
                        Ok(Some(progress_json)) => {
                            match serde_json::from_str::<serde_json::Value>(&progress_json) {
                                Ok(val) => val,
                                Err(_) => serde_json::json!({ "downloading": false, "model": "", "progress": 0.0, "error": null })
                            }
                        }
                        _ => serde_json::json!({ "downloading": false, "model": "", "progress": 0.0, "error": null })
                    };

                    let res_json = serde_json::json!({
                        "downloaded": downloaded_list,
                        "active_model": active_model,
                        "download_state": download_state
                    }).to_string();

                    ("HTTP/1.1 200 OK", "application/json", res_json)
                }
                ("POST", "/api/models/download") => {
                    let mut model_id = String::new();
                    if let Some(body_start) = request.find("\r\n\r\n") {
                        let json_body = &request[body_start + 4..];
                        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(json_body) {
                            model_id = payload["model_id"].as_str().unwrap_or("").to_string();
                        }
                    }

                    if model_id.is_empty() {
                        ("HTTP/1.1 400 Bad Request", "application/json", serde_json::json!({ "error": "Empty model_id" }).to_string())
                    } else {
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
                            _ => ("", "")
                        };

                        if url.is_empty() {
                            ("HTTP/1.1 400 Bad Request", "application/json", serde_json::json!({ "error": "Invalid model_id specified" }).to_string())
                        } else {
                            let storage_clone = agent_clone.storage().clone();
                            let dl_url = url.to_string();
                            let dl_filename = filename.to_string();

                            tokio::spawn(async move {
                                let client = reqwest::Client::new();
                                let start_json = serde_json::json!({
                                    "downloading": true,
                                    "model": dl_filename,
                                    "progress": 0.0,
                                    "error": serde_json::Value::Null
                                }).to_string();
                                let _ = storage_clone.kv_set("download_progress", &start_json);

                                match client.get(&dl_url).send().await {
                                    Ok(res) => {
                                        let total_size = res.content_length().unwrap_or(0);
                                        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                                        let models_dir = std::path::Path::new(&home).join(".cameleer").join("models");
                                        let _ = fs::create_dir_all(&models_dir);
                                        let file_path = models_dir.join(&dl_filename);

                                        match tokio::fs::File::create(&file_path).await {
                                            Ok(mut file) => {
                                                let mut downloaded: u64 = 0;
                                                let mut stream = res.bytes_stream();
                                                use futures_util::StreamExt;
                                                let mut last_saved_percent = 0;

                                                while let Some(chunk_res) = stream.next().await {
                                                     if let Ok(chunk) = chunk_res {
                                                         if tokio::io::AsyncWriteExt::write_all(&mut file, &chunk).await.is_err() {
                                                             break;
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
                                                             let progress_json = serde_json::json!({
                                                                 "downloading": true,
                                                                 "model": dl_filename,
                                                                 "progress": percentage,
                                                                 "error": serde_json::Value::Null
                                                             }).to_string();
                                                             let _ = storage_clone.kv_set("download_progress", &progress_json);
                                                         }
                                                     } else {
                                                         break;
                                                     }
                                                 }

                                                let success_json = serde_json::json!({
                                                    "downloading": false,
                                                    "model": dl_filename,
                                                    "progress": 100.0,
                                                    "error": serde_json::Value::Null
                                                }).to_string();
                                                let _ = storage_clone.kv_set("download_progress", &success_json);
                                            }
                                            Err(e) => {
                                                let error_json = serde_json::json!({
                                                    "downloading": false,
                                                    "model": dl_filename,
                                                    "progress": 0.0,
                                                    "error": format!("File create failed: {}", e)
                                                }).to_string();
                                                let _ = storage_clone.kv_set("download_progress", &error_json);
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        let error_json = serde_json::json!({
                                            "downloading": false,
                                            "model": dl_filename,
                                            "progress": 0.0,
                                            "error": format!("Download send failed: {}", e)
                                        }).to_string();
                                        let _ = storage_clone.kv_set("download_progress", &error_json);
                                    }
                                }
                            });

                            ("HTTP/1.1 200 OK", "application/json", serde_json::json!({ "status": "started" }).to_string())
                        }
                    }
                }
                ("POST", "/api/models/activate") => {
                    let mut model_name = String::new();
                    if let Some(body_start) = request.find("\r\n\r\n") {
                        let json_body = &request[body_start + 4..];
                        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(json_body) {
                            model_name = payload["model"].as_str().unwrap_or("").to_string();
                        }
                    }

                    if model_name.is_empty() {
                        ("HTTP/1.1 400 Bad Request", "application/json", serde_json::json!({ "error": "Empty model field" }).to_string())
                    } else {
                        let config_path = crate::config::get_config_path();
                        if let Ok(mut config) = crate::config::load() {
                            config.llm.model = model_name.clone();
                            config.llm.provider = "camelid".to_string();

                            if let Ok(toml_content) = toml::to_string_pretty(&config) {
                                let comment_header = r#"# Cameleer Configuration File
# Edit this file to configure your AI agent, gateways, and safety parameters.

"#;
                                let _ = fs::write(&config_path, format!("{}{}", comment_header, toml_content));
                            }
                        }

                        let agent_daemon = Arc::clone(&agent_clone);
                        let m_name = model_name.clone();
                        tokio::spawn(async move {
                            println!("🔄 Supervisor: Dynamic Model Swap request. Restarting Daemon with model: {}", m_name);
                            if let Err(e) = agent_daemon.restart_inference_daemon(&m_name).await {
                                eprintln!("❌ Failed to restart local inference daemon: {}", e);
                            }
                        });

                        ("HTTP/1.1 200 OK", "application/json", serde_json::json!({ "status": "activated", "model": model_name }).to_string())
                    }
                }
                ("GET", "/api/agents") => {
                    match agent_clone.storage().get_agents() {
                        Ok(list) => {
                            ("HTTP/1.1 200 OK", "application/json", serde_json::json!(list).to_string())
                        }
                        Err(e) => {
                            ("HTTP/1.1 500 Internal Server Error", "application/json", serde_json::json!({ "error": e.to_string() }).to_string())
                        }
                    }
                }
                ("POST", "/api/agents/create") => {
                    let mut payload_val = serde_json::Value::Null;
                    if let Some(body_start) = request.find("\r\n\r\n") {
                        let json_body = &request[body_start + 4..];
                        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(json_body) {
                            payload_val = payload;
                        }
                    }

                    let name = payload_val["name"].as_str().unwrap_or("").to_string();
                    let emoji = payload_val["emoji"].as_str().unwrap_or("🤖").to_string();
                    let persona = payload_val["persona"].as_str().unwrap_or("").to_string();
                    let provider = payload_val["model_provider"].as_str().unwrap_or("camelid").to_string();
                    let model = payload_val["model_name"].as_str().unwrap_or("Llama-3.2-3B-Instruct-Q8_0.gguf").to_string();

                    if name.is_empty() || persona.is_empty() {
                        ("HTTP/1.1 400 Bad Request", "application/json", serde_json::json!({ "error": "Empty name or persona" }).to_string())
                    } else {
                        // Generate a unique ID based on the name slugified
                        let id = format!("agent-{}", name.to_lowercase().replace(' ', "-"));
                        let profile = crate::storage::AgentProfile {
                            id: id.clone(),
                            name,
                            emoji,
                            persona,
                            model_provider: provider,
                            model_name: model,
                            is_autonomous: false,
                            autonomous_goal: None,
                            status: "idle".to_string(),
                        };

                        match agent_clone.storage().save_agent(&profile) {
                            Ok(_) => {
                                ("HTTP/1.1 200 OK", "application/json", serde_json::json!({ "status": "created", "agent_id": id }).to_string())
                            }
                            Err(e) => {
                                ("HTTP/1.1 500 Internal Server Error", "application/json", serde_json::json!({ "error": e.to_string() }).to_string())
                            }
                        }
                    }
                }
                ("POST", "/api/agents/update_model") => {
                    let mut agent_id = String::new();
                    let mut provider = String::new();
                    let mut model = String::new();

                    if let Some(body_start) = request.find("\r\n\r\n") {
                        let json_body = &request[body_start + 4..];
                        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(json_body) {
                            agent_id = payload["agent_id"].as_str().unwrap_or("").to_string();
                            provider = payload["model_provider"].as_str().unwrap_or("").to_string();
                            model = payload["model_name"].as_str().unwrap_or("").to_string();
                        }
                    }

                    if agent_id.is_empty() || provider.is_empty() || model.is_empty() {
                        ("HTTP/1.1 400 Bad Request", "application/json", serde_json::json!({ "error": "Missing parameters" }).to_string())
                    } else {
                        match agent_clone.storage().update_agent_model(&agent_id, &provider, &model) {
                            Ok(_) => {
                                // If the model is a local GGUF and we changed the active LLM of the system, hot swap the background camelid daemon!
                                if agent_id == "agent-coder" && provider == "camelid" {
                                    let agent_daemon = Arc::clone(&agent_clone);
                                    let m_name = model.clone();
                                    tokio::spawn(async move {
                                        let _ = agent_daemon.restart_inference_daemon(&m_name).await;
                                    });
                                }

                                ("HTTP/1.1 200 OK", "application/json", serde_json::json!({ "status": "updated" }).to_string())
                            }
                            Err(e) => {
                                ("HTTP/1.1 500 Internal Server Error", "application/json", serde_json::json!({ "error": e.to_string() }).to_string())
                            }
                        }
                    }
                }
                ("POST", "/api/agents/toggle_autonomous") => {
                    let mut agent_id = String::new();
                    let mut is_autonomous = false;
                    let mut autonomous_goal = None;

                    if let Some(body_start) = request.find("\r\n\r\n") {
                        let json_body = &request[body_start + 4..];
                        if let Ok(payload) = serde_json::from_str::<serde_json::Value>(json_body) {
                            agent_id = payload["agent_id"].as_str().unwrap_or("").to_string();
                            is_autonomous = payload["is_autonomous"].as_bool().unwrap_or(false);
                            autonomous_goal = payload["autonomous_goal"].as_str().map(|s| s.to_string());
                        }
                    }

                    if agent_id.is_empty() {
                        ("HTTP/1.1 400 Bad Request", "application/json", serde_json::json!({ "error": "Empty agent_id" }).to_string())
                    } else {
                        match agent_clone.storage().update_agent_autonomous(&agent_id, is_autonomous, autonomous_goal.as_deref()) {
                            Ok(_) => {
                                ("HTTP/1.1 200 OK", "application/json", serde_json::json!({ "status": "toggled", "is_autonomous": is_autonomous }).to_string())
                            }
                            Err(e) => {
                                ("HTTP/1.1 500 Internal Server Error", "application/json", serde_json::json!({ "error": e.to_string() }).to_string())
                            }
                        }
                    }
                }
                _ => ("HTTP/1.1 404 Not Found", "text/plain", "Not Found".to_string()),
            };

            let response = format!(
                "{}\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: *\r\nConnection: close\r\n\r\n{}",
                status_line, content_type, body.len(), body
            );

            let _ = socket.write_all(response.as_bytes()).await;
        });
    }
}

fn get_dashboard_html() -> String {
    let html = r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Cameleer — Control Dashboard & Live Console</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-base: #06080c;
            --bg-panel: rgba(14, 18, 28, 0.65);
            --bg-glass-heavy: rgba(20, 26, 38, 0.9);
            --border-panel: rgba(255, 255, 255, 0.06);
            --border-panel-glow: rgba(124, 77, 255, 0.25);
            --text-main: #f3f4f6;
            --text-muted: #9ca3af;
            --accent-glow: #7c4dff;
            --accent-blue: #2979ff;
            --status-success: #10b981;
            --status-failed: #ef4444;
            --status-pending: #f59e0b;
            --status-warning: #f43f5e;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-base);
            color: var(--text-main);
            overflow-x: hidden;
            display: flex;
            min-height: 100vh;
            background-image: radial-gradient(circle at 10% 20%, rgba(124, 77, 255, 0.05) 0%, transparent 40%),
                              radial-gradient(circle at 90% 80%, rgba(41, 121, 255, 0.05) 0%, transparent 40%);
        }

        /* Glassmorphism sidebar */
        .sidebar {
            width: 280px;
            background: var(--bg-panel);
            border-right: 1px solid var(--border-panel);
            backdrop-filter: blur(20px);
            padding: 2.5rem 1.75rem;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: fixed;
            height: 100vh;
            z-index: 10;
        }

        .logo-area {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 3.5rem;
        }

        .logo-glow {
            font-size: 2.2rem;
            filter: drop-shadow(0 0 15px var(--accent-glow));
            animation: float 4s ease-in-out infinite;
        }

        .logo-text {
            font-size: 1.5rem;
            font-weight: 800;
            letter-spacing: 0.5px;
            background: linear-gradient(135deg, #a855f7, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .menu-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
        }

        .menu-item {
            padding: 0.85rem 1.25rem;
            border-radius: 12px;
            cursor: pointer;
            color: var(--text-muted);
            font-weight: 600;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            align-items: center;
            gap: 1rem;
            border: 1px solid transparent;
        }

        .menu-item:hover, .menu-item.active {
            color: var(--text-main);
            background: rgba(124, 77, 255, 0.08);
            border: 1px solid var(--border-panel-glow);
            box-shadow: 0 4px 20px rgba(124, 77, 255, 0.05);
        }

        .menu-item.active {
            background: linear-gradient(135deg, rgba(124, 77, 255, 0.15), rgba(41, 121, 255, 0.05));
            border-left: 4px solid var(--accent-glow);
        }

        /* Main Workspace container */
        .workspace {
            margin-left: 280px;
            flex: 1;
            padding: 3rem;
            display: flex;
            flex-direction: column;
            gap: 2.5rem;
            max-width: 1400px;
            min-height: 100vh;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid var(--border-panel);
            padding-bottom: 1.5rem;
        }

        .header-title h1 {
            font-size: 2.2rem;
            font-weight: 700;
            letter-spacing: -0.5px;
            background: linear-gradient(135deg, #ffffff, #d1d5db);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .header-title p {
            color: var(--text-muted);
            margin-top: 0.35rem;
            font-size: 0.95rem;
        }

        /* Cards and Metrics */
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 1.5rem;
        }

        .glass-card {
            background: var(--bg-panel);
            border: 1px solid var(--border-panel);
            backdrop-filter: blur(20px);
            border-radius: 20px;
            padding: 1.75rem;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
            transition: all 0.3s ease;
            position: relative;
            overflow: hidden;
        }

        .glass-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(255,255,255,0.02), transparent);
            pointer-events: none;
        }

        .glass-card:hover {
            transform: translateY(-5px);
            border-color: var(--border-panel-glow);
            box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5), 0 0 20px rgba(124, 77, 255, 0.05);
        }

        .metric-title {
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: var(--text-muted);
            font-weight: 700;
        }

        .metric-value {
            font-size: 2.6rem;
            font-weight: 800;
            margin-top: 0.75rem;
            background: linear-gradient(135deg, #ffffff, #9ca3af);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        /* Tabs setup */
        .tab-content {
            display: none;
            flex-direction: column;
            gap: 2.5rem;
            animation: fadeIn 0.4s ease-in-out forwards;
        }

        .tab-content.active {
            display: flex;
        }

        /* Side-by-side splits */
        .panel-grid {
            display: grid;
            grid-template-columns: 1.5fr 1fr;
            gap: 2.5rem;
        }

        @media (max-width: 1024px) {
            .panel-grid {
                grid-template-columns: 1fr;
            }
        }

        .terminal-panel {
            min-height: 480px;
            display: flex;
            flex-direction: column;
        }

        .terminal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.25rem;
        }

        .terminal-body {
            background: #040508;
            border: 1px solid var(--border-panel);
            border-radius: 16px;
            flex: 1;
            padding: 1.75rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            overflow-y: auto;
            max-height: 420px;
            display: flex;
            flex-direction: column;
            gap: 0.85rem;
            box-shadow: inset 0 4px 30px rgba(0,0,0,0.9);
        }

        .terminal-row {
            display: flex;
            gap: 1rem;
            line-height: 1.6;
        }

        .timestamp {
            color: var(--accent-blue);
            min-width: 80px;
        }

        .cmd-text {
            color: #38bdf8;
            flex: 1;
            word-break: break-all;
        }

        .cmd-status {
            padding: 3px 10px;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .status-success { background: rgba(16, 185, 129, 0.12); color: var(--status-success); border: 1px solid rgba(16, 185, 129, 0.2); }
        .status-failed { background: rgba(239, 68, 68, 0.12); color: var(--status-failed); border: 1px solid rgba(239, 68, 68, 0.2); }
        .status-pending { background: rgba(245, 158, 11, 0.12); color: var(--status-pending); border: 1px solid rgba(245, 158, 11, 0.2); }
        .status-blocked { background: rgba(244, 63, 94, 0.15); color: var(--status-warning); border: 1px solid rgba(244, 63, 94, 0.25); }

        /* Approval Box Dashboard */
        .approval-panel {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
        }

        .approval-card {
            background: rgba(245, 158, 11, 0.05);
            border: 1px solid rgba(245, 158, 11, 0.25);
            border-radius: 16px;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
            box-shadow: 0 4px 30px rgba(245, 158, 11, 0.05);
            animation: pulse-glow 2s infinite ease-in-out;
        }

        .approval-text {
            font-size: 0.95rem;
            line-height: 1.5;
        }

        .approval-buttons {
            display: flex;
            gap: 1rem;
        }

        .btn {
            padding: 0.75rem 1.5rem;
            border: 1px solid transparent;
            border-radius: 10px;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            font-family: inherit;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }

        .btn-approve {
            background: var(--status-success);
            color: white;
            box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);
        }

        .btn-approve:hover {
            box-shadow: 0 6px 25px rgba(16, 185, 129, 0.4);
            transform: translateY(-2px);
        }

        .btn-deny {
            background: var(--status-failed);
            color: white;
            box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2);
        }

        .btn-deny:hover {
            box-shadow: 0 6px 25px rgba(239, 68, 68, 0.4);
            transform: translateY(-2px);
        }

        .btn-primary {
            background: linear-gradient(135deg, var(--accent-glow), var(--accent-blue));
            color: white;
            border: 1px solid rgba(255,255,255,0.1);
        }

        .btn-primary:hover {
            box-shadow: 0 8px 25px rgba(124, 77, 255, 0.3);
            transform: translateY(-2px);
        }

        .btn-danger {
            background: rgba(244, 63, 94, 0.15);
            color: var(--status-warning);
            border: 1px solid rgba(244, 63, 94, 0.3);
        }

        .btn-danger:hover {
            background: var(--status-warning);
            color: white;
            box-shadow: 0 6px 25px rgba(244, 63, 94, 0.3);
            transform: translateY(-2px);
        }

        .discord-chat-layout {
            display: grid;
            grid-template-columns: 240px 200px 1fr;
            gap: 0;
            background: #090c15;
            border: 1px solid var(--border-panel);
            border-radius: 20px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
            height: calc(100vh - 180px);
            min-height: 480px;
            overflow: hidden;
        }

        /* Column 1: Agents Sidebar */
        .discord-agents-sidebar {
            background: #05070c;
            border-right: 1px solid rgba(255, 255, 255, 0.03);
            display: flex;
            flex-direction: column;
            padding: 1.25rem 0.75rem;
            justify-content: space-between;
        }

        .discord-section-header {
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: var(--text-muted);
            margin-bottom: 1rem;
            padding-left: 0.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .discord-agents-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            overflow-y: auto;
            flex: 1;
        }

        .discord-agent-item {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.65rem 0.75rem;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            color: var(--text-muted);
            font-weight: 600;
            font-size: 0.9rem;
            border: 1px solid transparent;
        }

        .discord-agent-item:hover, .discord-agent-item.active {
            color: white;
            background: rgba(124, 77, 255, 0.08);
            border-color: rgba(124, 77, 255, 0.2);
        }

        .discord-agent-item.active {
            background: linear-gradient(135deg, rgba(124, 77, 255, 0.15), rgba(41, 121, 255, 0.05));
            border-left: 3px solid var(--accent-glow);
        }

        .discord-agent-avatar {
            font-size: 1.25rem;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.03);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }

        .discord-agent-status {
            position: absolute;
            bottom: -2px;
            right: -2px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            border: 2px solid #05070c;
            background: #9ca3af;
        }

        .discord-agent-status.online { background: #10b981; box-shadow: 0 0 8px #10b981; }
        .discord-agent-status.thinking { background: #a855f7; box-shadow: 0 0 8px #a855f7; animation: pulse 1.5s infinite; }
        .discord-agent-status.waiting_approval { background: #f59e0b; box-shadow: 0 0 8px #f59e0b; animation: pulse 1.5s infinite; }

        /* Column 2: Channels Sidebar */
        .discord-channels-sidebar {
            background: #090c15;
            border-right: 1px solid rgba(255, 255, 255, 0.03);
            display: flex;
            flex-direction: column;
            padding: 1.25rem 0.75rem;
        }

        .discord-channels-list {
            list-style: none;
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
        }

        .discord-channel-item {
            display: flex;
            align-items: center;
            gap: 0.65rem;
            padding: 0.5rem 0.75rem;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            color: var(--text-muted);
            font-weight: 500;
            font-size: 0.85rem;
        }

        .discord-channel-item:hover, .discord-channel-item.active {
            color: white;
            background: rgba(255, 255, 255, 0.03);
        }

        .discord-channel-item.active {
            color: white;
            background: rgba(255, 255, 255, 0.06);
            font-weight: 600;
        }

        /* Column 3: Main Chat Window */
        .discord-chat-main {
            display: flex;
            flex-direction: column;
            background: #0f1322;
        }

        .discord-chat-header {
            height: 60px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.03);
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 1.5rem;
            background: rgba(0, 0, 0, 0.1);
        }

        .discord-header-left {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .discord-header-name {
            font-weight: 700;
            color: white;
            font-size: 0.95rem;
        }

        .discord-header-status {
            font-size: 0.75rem;
            color: var(--text-muted);
            margin-left: 0.75rem;
            padding: 0.15rem 0.5rem;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.02);
            border: 1px solid rgba(255,255,255,0.03);
        }

        .discord-model-selector-container {
            display: flex;
            align-items: center;
            gap: 0.75rem;
        }

        .discord-model-selector {
            background: #05070c;
            border: 1px solid var(--border-panel);
            color: white;
            border-radius: 8px;
            padding: 0.35rem 0.75rem;
            font-size: 0.8rem;
            font-weight: 600;
            cursor: pointer;
            outline: none;
            transition: all 0.2s ease;
        }

        .discord-model-selector:focus {
            border-color: var(--accent-glow);
        }

        .discord-messages-container {
            flex: 1;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
            padding: 1.5rem;
        }

        .discord-message-row {
            display: flex;
            gap: 1rem;
            align-items: flex-start;
        }

        .discord-message-avatar {
            font-size: 1.35rem;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.04);
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255, 255, 255, 0.02);
        }

        .discord-message-content-wrapper {
            flex: 1;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }

        .discord-message-meta {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .discord-message-sender {
            font-weight: 700;
            font-size: 0.9rem;
            color: white;
        }

        .discord-message-time {
            font-size: 0.75rem;
            color: var(--text-muted);
        }

        .discord-message-text {
            font-size: 0.95rem;
            line-height: 1.6;
            color: #d1d5db;
            word-break: break-word;
        }

        .discord-message-text p {
            margin: 0 0 0.5rem 0;
        }

        .discord-message-text p:last-child {
            margin: 0;
        }

        .discord-message-text code {
            font-family: 'JetBrains Mono', monospace;
            background: rgba(0,0,0,0.3);
            padding: 0.15rem 0.35rem;
            border-radius: 4px;
            font-size: 0.85rem;
            color: var(--accent-blue);
        }

        .discord-message-text pre {
            background: #05070c;
            border: 1px solid rgba(255,255,255,0.03);
            border-radius: 10px;
            padding: 1rem;
            overflow-x: auto;
            margin: 0.5rem 0;
        }

        .discord-message-text pre code {
            background: transparent;
            padding: 0;
            color: #f3f4f6;
            font-size: 0.85rem;
        }

        .discord-input-container {
            padding: 1.25rem;
            background: rgba(0,0,0,0.1);
            border-top: 1px solid rgba(255, 255, 255, 0.03);
        }

        .discord-input-wrapper {
            background: #151a2e;
            border: 1px solid var(--border-panel);
            border-radius: 12px;
            display: flex;
            align-items: center;
            padding: 0 0.75rem 0 1.25rem;
            transition: all 0.3s ease;
        }

        .discord-input-wrapper:focus-within {
            border-color: var(--accent-glow);
            box-shadow: 0 0 15px rgba(124, 77, 255, 0.1);
        }

        .discord-input-field {
            flex: 1;
            background: transparent;
            border: none;
            outline: none;
            color: white;
            font-size: 0.9rem;
            padding: 0.85rem 0;
            font-family: inherit;
        }

        .discord-input-field::placeholder {
            color: var(--text-muted);
        }

        /* Modal styling for custom agent creation */
        .glass-modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.6);
            backdrop-filter: blur(10px);
            z-index: 100;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: all 0.3s ease;
        }

        .glass-modal.active {
            display: flex;
            opacity: 1;
        }

        .glass-modal-content {
            background: var(--bg-panel);
            border: 1px solid var(--border-panel);
            border-radius: 20px;
            padding: 2.5rem;
            width: 580px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.6);
            animation: modalSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @keyframes modalSlideUp {
            from { transform: translateY(40px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .thinking-indicator {
            display: none;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: rgba(124, 77, 255, 0.1);
            color: var(--accent-glow);
            border-radius: 10px;
            font-size: 0.85rem;
            font-weight: 600;
            width: fit-content;
            margin-left: 1rem;
            animation: pulse 1.5s infinite ease-in-out;
        }

        /* Editor configurations */
        .editor-container {
            display: flex;
            flex-direction: column;
            gap: 1.25rem;
        }

        .editor-textarea {
            width: 100%;
            height: 380px;
            background: #040508;
            color: #10b981;
            border: 1px solid var(--border-panel);
            border-radius: 12px;
            padding: 1.5rem;
            font-family: 'JetBrains Mono', monospace;
            font-size: 0.9rem;
            line-height: 1.5;
            resize: vertical;
            transition: all 0.3s ease;
            box-shadow: inset 0 2px 15px rgba(0,0,0,0.8);
        }

        .editor-textarea:focus {
            outline: none;
            border-color: var(--border-panel-glow);
            box-shadow: inset 0 2px 15px rgba(0,0,0,0.8), 0 0 15px rgba(124, 77, 255, 0.1);
        }

        /* Skills view */
        .skills-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 1.75rem;
        }

        /* Overlay modal */
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(6, 8, 12, 0.85);
            backdrop-filter: blur(10px);
            z-index: 100;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.3s ease;
        }

        .modal-content {
            background: var(--bg-glass-heavy);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 24px;
            width: 90%;
            max-width: 800px;
            padding: 2.5rem;
            box-shadow: 0 20px 80px rgba(0,0,0,0.6);
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }

        .form-row {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
        }

        .form-input {
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--border-panel);
            padding: 0.75rem 1rem;
            color: white;
            border-radius: 8px;
            font-family: inherit;
        }

        /* Keyframes */
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulse-glow {
            0%, 100% { box-shadow: 0 4px 30px rgba(245, 158, 11, 0.05); }
            50% { box-shadow: 0 4px 40px rgba(245, 158, 11, 0.15), 0 0 10px rgba(245, 158, 11, 0.05); }
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        /* Models Grid & Cards */
        .models-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
            gap: 1.5rem;
            margin-top: 1.5rem;
        }

        .model-card {
            background: var(--bg-panel);
            border: 1px solid var(--border-panel);
            border-radius: 16px;
            padding: 1.75rem;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
            min-height: 280px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .model-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(135deg, rgba(255,255,255,0.01), transparent);
            pointer-events: none;
        }

        .model-card:hover {
            transform: translateY(-5px);
            border-color: var(--border-panel-glow);
            box-shadow: 0 15px 40px rgba(0,0,0,0.4), 0 0 20px rgba(124, 77, 255, 0.05);
        }

        .model-card.active-model {
            border-color: var(--status-success);
            background: rgba(16, 185, 129, 0.04);
            box-shadow: 0 15px 40px rgba(16, 185, 129, 0.05), 0 0 20px rgba(16, 185, 129, 0.05);
        }

        .model-card.active-model::after {
            content: 'ACTIVE LLM';
            position: absolute;
            top: 15px;
            right: 15px;
            background: var(--status-success);
            color: white;
            font-size: 0.65rem;
            font-weight: 800;
            padding: 3px 9px;
            border-radius: 6px;
            letter-spacing: 0.5px;
            box-shadow: 0 0 10px rgba(16, 185, 129, 0.4);
        }

        .model-name {
            font-size: 1.2rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            letter-spacing: -0.3px;
        }

        .model-meta {
            font-size: 0.85rem;
            color: var(--text-muted);
            margin-bottom: 0.85rem;
            font-family: 'JetBrains Mono', monospace;
        }

        .model-evidence {
            font-size: 0.75rem;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 6px;
            margin-bottom: 1.25rem;
            display: inline-block;
            width: fit-content;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .evidence-verified { background: rgba(16, 185, 129, 0.12); color: var(--status-success); border: 1px solid rgba(16, 185, 129, 0.2); }
        .evidence-smoke { background: rgba(245, 158, 11, 0.12); color: var(--status-pending); border: 1px solid rgba(245, 158, 11, 0.2); }
        .evidence-validation { background: rgba(30, 58, 138, 0.2); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); }

        .download-progress-bar {
            width: 100%;
            background: rgba(0, 0, 0, 0.4);
            height: 8px;
            border-radius: 10px;
            overflow: hidden;
            margin-top: 1rem;
            display: none;
            border: 1px solid rgba(255,255,255,0.05);
        }

        .download-progress-inner {
            height: 100%;
            background: linear-gradient(90deg, var(--accent-glow), var(--accent-blue));
            width: 0%;
            transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 10px var(--accent-glow);
        }
    </style>
</head>
<body>
    <!-- Sidebar -->
    <div class="sidebar">
        <div>
            <div class="logo-area">
                <span class="logo-glow">🦀</span>
                <span class="logo-text">CAMELEER</span>
            </div>
            <ul class="menu-list">
                <li class="menu-item active" id="menu-dashboard" onclick="showTab('dashboard')">💻 Dashboard</li>
                <li class="menu-item" id="menu-chat" onclick="showTab('chat')">💬 Live Chat</li>
                <li class="menu-item" id="menu-models" onclick="showTab('models')">📦 Local Models</li>
                <li class="menu-item" id="menu-skills" onclick="showTab('skills')">🔧 Dynamic Skills</li>
                <li class="menu-item" id="menu-config" onclick="showTab('config')">⚙️ Settings</li>
            </ul>
        </div>
        <div style="color: var(--text-muted); font-size: 0.8rem; border-top: 1px solid var(--border-panel); padding-top: 1.25rem; line-height: 1.5;">
            Engine: <strong>Rust 2024</strong><br>
            IPC Channel: <strong>SQLite DB</strong><br>
            Status: <span style="color:var(--status-success); font-weight:700;">Online</span>
        </div>
    </div>

    <!-- Main Workspace -->
    <div class="workspace">
        <div class="header">
            <div class="header-title">
                <h1 id="title-text">Control Dashboard</h1>
                <p id="subtitle-text">Real-time shell audit logs & sandbox safety metrics</p>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.3); color: var(--status-success); padding: 0.6rem 1.25rem; border-radius: 30px; font-size: 0.85rem; font-weight: 700;">
                <span style="display:inline-block; width:8px; height:8px; background:var(--status-success); border-radius:50%; box-shadow: 0 0 10px var(--status-success); animation: pulse 2s infinite;"></span> Active Session
            </div>
        </div>

        <!-- TAB: Dashboard -->
        <div id="tab-dashboard" class="tab-content active">
            <div class="metrics-grid">
                <div class="glass-card">
                    <div class="metric-title">Security Gateway</div>
                    <div class="metric-value" style="color: var(--accent-glow); font-size: 2.1rem; margin-top:1rem;">SANDBOX</div>
                </div>
                <div class="glass-card">
                    <div class="metric-title">Active Capabilities</div>
                    <div class="metric-value" id="count-skills">2</div>
                </div>
                <div class="glass-card">
                    <div class="metric-title">Audit Logs Persistent</div>
                    <div class="metric-value" id="count-audits">0</div>
                </div>
            </div>

            <div class="panel-grid">
                <!-- Left: Audit Logs Terminal -->
                <div class="glass-card terminal-panel">
                    <div class="terminal-header">
                        <h2 style="font-size: 1.25rem;">📝 Shell Audit Log Stream</h2>
                        <button onclick="refreshAudits()" style="background:none; border:none; color:var(--accent-blue); cursor:pointer; font-weight:700;">🔄 Refresh</button>
                    </div>
                    <div class="terminal-body" id="audit-log-stream">
                        <div class="terminal-row"><span class="timestamp">00:00:00</span> <span class="cmd-text">Loading audit database...</span></div>
                    </div>
                </div>

                <!-- Right: Pending Actions & Skills -->
                <div style="display:flex; flex-direction:column; gap:2rem;">
                    <div class="glass-card approval-panel">
                        <h2 style="font-size: 1.25rem; margin-bottom: 0.25rem;">🛡️ Sandbox Actions Pending</h2>
                        <div id="pending-actions-box">
                            <div style="color:var(--text-muted); font-size:0.9rem;">No actions waiting for user confirmation. Excellent!</div>
                        </div>
                    </div>

                    <div class="glass-card">
                        <h2 style="font-size: 1.25rem; margin-bottom: 1rem;">⚡ Active Capabilities</h2>
                        <div class="skills-list" id="capabilities-box" style="display:flex; flex-direction:column; gap:0.75rem;">
                            <div style="color:var(--text-muted); font-size:0.9rem;">Loading installed playbooks...</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB: Chat Console -->
        <div id="tab-chat" class="tab-content" style="padding:0; gap:0;">
            <div class="discord-chat-layout">
                <!-- COLUMN 1: AGENTS SIDEBAR -->
                <div class="discord-agents-sidebar">
                    <div>
                        <div class="discord-section-header">
                            <span>Agents Registry</span>
                            <span style="font-size:1.15rem; cursor:pointer;" onclick="openCreateAgentModal()" title="Deploy Custom Agent">+</span>
                        </div>
                        
                        <!-- Prominent Custom Agent Creation Option -->
                        <button class="btn btn-approve" style="font-size:0.75rem; padding:0.5rem 0.75rem; width:100%; margin-bottom:1rem; display:flex; align-items:center; justify-content:center; gap:0.35rem; border-radius:8px;" onclick="openCreateAgentModal()">
                            <span>🤖 Spawn Custom Agent</span>
                        </button>

                        <ul class="discord-agents-list" id="discord-agents-list-box">
                            <!-- Populated dynamically -->
                        </ul>
                    </div>
                    <!-- Self-Healing status badge -->
                    <div class="glass-card" style="padding:0.75rem; border-radius:10px; font-size:0.75rem; border:1px solid rgba(255,255,255,0.02); background:rgba(0,0,0,0.2);">
                        <div style="font-weight:600; margin-bottom:0.25rem;">🦀 Sandbox Firewall</div>
                        <div style="color:var(--status-success); display:flex; align-items:center; gap:0.25rem;">● Active Protection</div>
                    </div>
                </div>

                <!-- COLUMN 2: CHANNELS SIDEBAR -->
                <div class="discord-channels-sidebar">
                    <div class="discord-section-header">Channels</div>
                    <ul class="discord-channels-list">
                        <li class="discord-channel-item active" id="channel-general" onclick="selectChannel('general')">💬 # general-chat</li>
                        <li class="discord-channel-item" id="channel-sandbox" onclick="selectChannel('sandbox')">🤖 # autonomous-sandbox</li>
                        <li class="discord-channel-item" id="channel-diagnostics" onclick="selectChannel('diagnostics')">📋 # system-diagnostics</li>
                    </ul>
                    <div style="flex:1;"></div>
                    <!-- Quick action buttons -->
                    <button class="btn btn-danger" style="font-size:0.75rem; padding:0.5rem; width:100%;" onclick="confirmResetDB()">🧹 Reset Session</button>
                </div>

                <!-- COLUMN 3: MAIN CHAT PANEL -->
                <div class="discord-chat-main">
                    <!-- Chat Header with Model Selector -->
                    <div class="discord-chat-header">
                        <div class="discord-header-left">
                            <span style="font-size:1.2rem;" id="active-agent-avatar">💻</span>
                            <span class="discord-header-name" id="active-agent-name">Software Engineer</span>
                            <span class="discord-header-status" id="active-agent-status-badge">online</span>
                        </div>
                        
                        <!-- Model Hot-swapping dropdown -->
                        <div class="discord-model-selector-container">
                            <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600;">Active LLM:</span>
                            <select class="discord-model-selector" id="chat-model-selector" onchange="handleModelSelectorChange()">
                                <optgroup label="Local GGUF Models (via Camelid)" id="selector-group-gguf">
                                    <!-- Filled dynamically with GGUFs -->
                                </optgroup>
                                <optgroup label="Cloud API Providers" id="selector-group-apis">
                                    <option value="openai/gpt-4o">OpenAI GPT-4o</option>
                                    <option value="anthropic/claude-3-5-sonnet-latest">Claude 3.5 Sonnet</option>
                                    <option value="gemini/gemini-1.5-pro">Gemini 1.5 Pro</option>
                                </optgroup>
                            </select>
                        </div>
                    </div>

                    <!-- Chat Messages Stream -->
                    <div class="discord-messages-container" id="chat-messages-box">
                        <!-- Filled dynamically -->
                    </div>

                    <!-- Sandbox Approval Gate -->
                    <div id="discord-sandbox-gate-container" style="display:none; padding:1rem 1.5rem; background:rgba(245, 158, 11, 0.05); border-top:1px solid rgba(245, 158, 11, 0.1); border-bottom:1px solid rgba(245, 158, 11, 0.1); align-items:center; justify-content:space-between;">
                        <div style="display:flex; align-items:center; gap:0.75rem;">
                            <span style="font-size:1.5rem; animation:pulse 1.5s infinite;">🛡️</span>
                            <div>
                                <div style="font-weight:700; color:white; font-size:0.85rem;">Sandbox Security: Mutating Command Blocked</div>
                                <div style="font-size:0.75rem; color:var(--text-muted);" id="discord-sandbox-gate-cmd">Command: rm -rf target/</div>
                            </div>
                        </div>
                        <div style="display:flex; gap:0.5rem;">
                            <button class="btn btn-approve" id="btn-gate-approve" onclick="approveAction(0)">Approve 🚀</button>
                            <button class="btn btn-danger" id="btn-gate-deny" onclick="denyAction(0)" style="padding:0.4rem 0.85rem;">Deny 🚫</button>
                        </div>
                    </div>

                    <!-- Autonomous Controller Bar -->
                    <div id="discord-autonomous-bar" style="display:none; padding:1rem 1.5rem; background:rgba(168, 85, 247, 0.05); border-top:1px solid rgba(168, 85, 247, 0.1); border-bottom:1px solid rgba(168, 85, 247, 0.1); justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:0.75rem; flex:1;">
                            <span style="font-size:1.5rem;">⚙️</span>
                            <div style="flex:1; padding-right:1rem;">
                                <div style="font-weight:700; color:white; font-size:0.85rem;">Continuous Autonomous Agent Engine</div>
                                <input type="text" class="chat-input" id="autonomous-goal-input" style="font-size:0.8rem; padding:0.4rem 0.75rem; margin-top:0.25rem; width:100%;" placeholder="Specify background goal (e.g. Audit CPU status every 15s)...">
                            </div>
                        </div>
                        <div style="display:flex; gap:0.5rem; align-items:center;">
                            <button class="btn btn-approve" id="btn-toggle-auto" onclick="toggleAutonomousLoop()" style="white-space:nowrap;">Start Loop 🔁</button>
                        </div>
                    </div>

                    <!-- Loading / Typing Indicator -->
                    <div class="thinking-indicator" id="chat-thinking" style="margin-left: 1.5rem; margin-bottom: 0.5rem; font-size:0.85rem; color:var(--accent-glow);">
                        <span>🤖 Agent thinking...</span>
                    </div>

                    <!-- Input message container -->
                    <div class="discord-input-container">
                        <div class="discord-input-wrapper">
                            <input type="text" class="discord-input-field" id="chat-input-field" placeholder="Type a message to active agent..." onkeydown="handleChatKey(event)">
                            <button class="btn btn-primary" onclick="sendChatMessage()" style="padding:0.4rem 1rem; font-size:0.8rem; border-radius:8px;">Send 🚀</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- DIALOG MODAL: CREATE CUSTOM AGENT -->
        <div class="glass-modal" id="create-agent-modal">
            <div class="glass-modal-content">
                <h2 style="margin-top:0; font-size:1.4rem; margin-bottom:1.5rem; display:flex; align-items:center; gap:0.5rem;">🤖 Deploy Custom Reasoning Agent</h2>
                <div style="display:flex; flex-direction:column; gap:1.25rem;">
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:0.35rem;">Agent Name</label>
                        <input type="text" class="chat-input" id="new-agent-name" placeholder="e.g. Code Reviewer, SysAdmin Sentry" style="width:100%;">
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 4fr; gap:1rem;">
                        <div>
                            <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:0.35rem;">Emoji Avatar</label>
                            <input type="text" class="chat-input" id="new-agent-emoji" value="🤖" style="width:100%; text-align:center;">
                        </div>
                        <div>
                            <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:0.35rem;">Default Model</label>
                            <select class="discord-model-selector" id="new-agent-model" style="width:100%; padding:0.8rem 1rem; border-radius:12px; height:45px; font-size:0.9rem;">
                                <option value="camelid/Llama-3.2-3B-Instruct-Q8_0.gguf">Llama 3.2 3B Instruct (GGUF Local)</option>
                                <option value="camelid/tinyllama-1.1b-chat-v1.0.Q8_0.gguf">TinyLlama 1.1B Chat (GGUF Local)</option>
                                <option value="openai/gpt-4o">OpenAI GPT-4o (Cloud)</option>
                                <option value="anthropic/claude-3-5-sonnet-latest">Claude 3.5 Sonnet (Cloud)</option>
                                <option value="gemini/gemini-1.5-pro">Gemini 1.5 Pro (Cloud)</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style="font-size:0.85rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:0.35rem;">Persona Directive / Custom System Instructions</label>
                        <textarea class="chat-input" id="new-agent-persona" rows="4" placeholder="Describe the agent's core directives, specific whitelist commands, behaviors, and tasks..." style="width:100%; font-family:inherit; resize:vertical;"></textarea>
                    </div>
                    <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:0.5rem;">
                        <button class="btn btn-danger" style="background:transparent; border:1px solid rgba(255,255,255,0.1); padding:0.5rem 1rem;" onclick="closeCreateAgentModal()">Cancel</button>
                        <button class="btn btn-approve" onclick="saveNewAgent()">Deploy Agent 🚀</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB: Dynamic Skills -->
        <div id="tab-skills" class="tab-content">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h2 style="font-size: 1.4rem;">📦 ClawHub Skill Registry</h2>
                <button class="btn btn-primary" onclick="openNewSkillModal()">+ Design New Skill</button>
            </div>
            <div class="skills-grid" id="skills-grid-box">
                <!-- Filled dynamically -->
            </div>
        </div>

        <!-- TAB: Local Models -->
        <div id="tab-models" class="tab-content">
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <h2 style="font-size: 1.4rem;">📦 Camelid GGUF Local Model Registry</h2>
                    <p style="font-size: 0.9rem; color: var(--text-muted); margin-top: 0.25rem;">Download and activate evidence-verified local inference models natively on your Mac</p>
                </div>
            </div>
            
            <div class="models-grid">
                <!-- TinyLlama -->
                <div class="model-card" id="card-tinyllama">
                    <div>
                        <div class="model-name">TinyLlama 1.1B Chat (Q8_0)</div>
                        <div class="model-meta">Size: 1.2 GB | Format: GGUF | Quant: Q8_0</div>
                        <div class="model-evidence evidence-verified">✓ Verified support</div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">Ultralightweight local LLM. Perfect for fast testing, low memory configurations, and rapid ReAct iterations.</p>
                    </div>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-primary" style="width:100%;" id="btn-tinyllama" onclick="handleModelAction('tinyllama-1.1b', 'tinyllama-1.1b-chat-v1.0.Q8_0.gguf')">Download Model 📥</button>
                        <div class="download-progress-bar" id="progress-tinyllama">
                            <div class="download-progress-inner" id="progress-inner-tinyllama"></div>
                        </div>
                    </div>
                </div>

                <!-- Llama 3.2 1B -->
                <div class="model-card" id="card-llama1b">
                    <div>
                        <div class="model-name">Llama 3.2 1B Instruct (Q8_0)</div>
                        <div class="model-meta">Size: 1.2 GB | Format: GGUF | Quant: Q8_0</div>
                        <div class="model-evidence evidence-verified">✓ Verified bounded support</div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">Ultra-fast modern light Instruct model. Extremely clean output alignment with zero-lag CPU completion times.</p>
                    </div>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-primary" style="width:100%;" id="btn-llama1b" onclick="handleModelAction('llama-3.2-1b', 'Llama-3.2-1B-Instruct-Q8_0.gguf')">Download Model 📥</button>
                        <div class="download-progress-bar" id="progress-llama1b">
                            <div class="download-progress-inner" id="progress-inner-llama1b"></div>
                        </div>
                    </div>
                </div>

                <!-- Llama 3.2 3B -->
                <div class="model-card" id="card-llama3b">
                    <div>
                        <div class="model-name">Llama 3.2 3B Instruct (Q8_0)</div>
                        <div class="model-meta">Size: 3.2 GB | Format: GGUF | Quant: Q8_0</div>
                        <div class="model-evidence evidence-smoke">✓ Supported exact-row smoke</div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;"><strong>[Recommended]</strong> Ideal balanced model for local reasoning. Excellent tool calling capabilities and smart persona adherence.</p>
                    </div>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-primary" style="width:100%;" id="btn-llama3b" onclick="handleModelAction('llama-3.2-3b', 'Llama-3.2-3B-Instruct-Q8_0.gguf')">Download Model 📥</button>
                        <div class="download-progress-bar" id="progress-llama3b">
                            <div class="download-progress-inner" id="progress-inner-llama3b"></div>
                        </div>
                    </div>
                </div>

                <!-- Llama 3 8B -->
                <div class="model-card" id="card-llama8b">
                    <div>
                        <div class="model-name">Llama 3 8B Instruct (Q8_0)</div>
                        <div class="model-meta">Size: 8.5 GB | Format: GGUF | Quant: Q8_0</div>
                        <div class="model-evidence evidence-verified">✓ Verified bounded support</div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">High-end local model. Advanced coding, complex structural outputs, and deep contextual reasoning capacity.</p>
                    </div>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-primary" style="width:100%;" id="btn-llama8b" onclick="handleModelAction('llama-3-8b', 'Meta-Llama-3-8B-Instruct-Q8_0.gguf')">Download Model 📥</button>
                        <div class="download-progress-bar" id="progress-llama8b">
                            <div class="download-progress-inner" id="progress-inner-llama8b"></div>
                        </div>
                    </div>
                </div>

                <!-- Mistral 7B -->
                <div class="model-card" id="card-mistral">
                    <div>
                        <div class="model-name">Mistral 7B Instruct v0.3 (Q8_0)</div>
                        <div class="model-meta">Size: 7.7 GB | Format: GGUF | Quant: Q8_0</div>
                        <div class="model-evidence evidence-validation">◒ Active validation</div>
                        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.4;">Powerful general-purpose Instruct model. High output quality and robust instruction compliance.</p>
                    </div>
                    <div style="margin-top: 1rem;">
                        <button class="btn btn-primary" style="width:100%;" id="btn-mistral" onclick="handleModelAction('mistral-7b', 'Mistral-7B-Instruct-v0.3.Q8_0.gguf')">Download Model 📥</button>
                        <div class="download-progress-bar" id="progress-mistral">
                            <div class="download-progress-inner" id="progress-inner-mistral"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- TAB: Configuration -->
        <div id="tab-config" class="tab-content">
            <div style="display:grid; grid-template-columns: 2fr 1.2fr; gap:2.5rem;">
                <div class="glass-card editor-container">
                    <h2 style="font-size: 1.25rem;">📝 Inline Config Editor (~/.cameleer/config.toml)</h2>
                    <textarea class="editor-textarea" id="config-editor-box" spellcheck="false"></textarea>
                    <div style="display:flex; gap:1rem; align-self: flex-end;">
                        <button class="btn btn-primary" onclick="saveConfiguration()">Save Config & Reload 💾</button>
                    </div>
                </div>

                <div style="display:flex; flex-direction:column; gap:2rem;">
                    <div class="glass-card">
                        <h2 style="font-size: 1.2rem; margin-bottom: 1rem;">💡 TOML Configuration Tips</h2>
                        <ul style="font-size: 0.9rem; color: var(--text-muted); display:flex; flex-direction:column; gap:0.75rem; padding-left:1.25rem; line-height: 1.5;">
                            <li>Choose your LLM provider by updating the <code>llm.provider</code> field (options: "ollama", "anthropic", "openai", "gemini").</li>
                            <li>List binaries allowed to execute under <code>security.allowed_commands</code>.</li>
                            <li>Toggle <code>security.require_approval</code> to <code>false</code> to bypass interactive user prompts (Caution: sandboxing will be passive).</li>
                        </ul>
                    </div>
                    <div class="glass-card" style="border-color: rgba(239, 68, 68, 0.2);">
                        <h2 style="font-size: 1.2rem; margin-bottom: 0.75rem; color: var(--status-failed);">⚠️ Hard Reset Engine</h2>
                        <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 1.25rem;">
                            Wipes all message threads, audit records, and sandboxed execution logs from your SQLite database. File configurations will not be affected.
                        </p>
                        <button class="btn btn-danger" style="width:100%;" onclick="confirmResetDB()">Wipe SQLite Database 🚫</button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- SKILL EDITOR MODAL -->
    <div class="modal" id="new-skill-modal">
        <div class="modal-content">
            <h2 style="font-size: 1.5rem; margin-bottom: 0.5rem; background: linear-gradient(135deg, var(--accent-glow), var(--accent-blue)); -webkit-background-clip: text; -webkit-text-fill-color: transparent;"> Design Custom Skill playbook</h2>
            <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1rem;">Your playbook will instantly compile and load into the agent's available tools.</p>
            
            <div class="form-row">
                <label style="font-size:0.9rem; font-weight:600;">Skill Slug (e.g. system-reboot)</label>
                <input type="text" class="form-input" id="modal-skill-name" placeholder="system-reboot">
            </div>
            
            <div class="form-row">
                <label style="font-size:0.9rem; font-weight:600;">Short Description</label>
                <input type="text" class="form-input" id="modal-skill-desc" placeholder="Details that teach the LLM when to trigger this skill">
            </div>

            <div class="form-row">
                <label style="font-size:0.9rem; font-weight:600;">Skill Document (SKILL.md)</label>
                <textarea class="editor-textarea" style="height:250px;" id="modal-skill-content" spellcheck="false"></textarea>
            </div>

            <div style="display:flex; gap:1rem; justify-content: flex-end; margin-top:1rem;">
                <button class="btn btn-danger" style="background:transparent; border:1px solid rgba(255,255,255,0.1);" onclick="closeNewSkillModal()">Cancel</button>
                <button class="btn btn-primary" onclick="saveNewSkill()">Deploy Skill 🚀</button>
            </div>
        </div>
    </div>

    <script>
        // Global Error Catcher for easy headless diagnostics
        window.onerror = function(message, source, lineno, colno, error) {
            alert("JS Exception caught: " + message + " at " + source + ":" + lineno + ":" + colno);
            return false;
        };

        // Navigation Logic
        function showTab(tabName) {
            document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
            
            const targetContent = document.getElementById(`tab-${tabName}`);
            if (targetContent) targetContent.style.display = 'flex';
            
            const targetMenu = document.getElementById(`menu-${tabName}`);
            if (targetMenu) targetMenu.classList.add('active');

            // Header titles update
            const title = document.getElementById('title-text');
            const subtitle = document.getElementById('subtitle-text');

            if (tabName === 'dashboard') {
                title.innerText = 'Control Dashboard';
                subtitle.innerText = 'Real-time shell audit logs & sandbox safety metrics';
                refreshAudits();
                checkPending();
                loadSkillsBox();
            } else if (tabName === 'chat') {
                title.innerText = 'Interactive Gateway Console';
                subtitle.innerText = 'Direct autonomous chat window with the reasoning agent';
                loadChatHistory();
            } else if (tabName === 'skills') {
                title.innerText = 'Dynamic Skill Packages';
                subtitle.innerText = 'Standardized ClawHub SKILL.md playbooks loaded';
                loadSkillsTab();
            } else if (tabName === 'models') {
                title.innerText = 'Local Model Manager';
                subtitle.innerText = 'Download, configure, and activate local GGUF models on your Mac';
                refreshModels();
            } else if (tabName === 'config') {
                title.innerText = 'Central System Settings';
                subtitle.innerText = 'Inline configuration & core safety parameters';
                loadConfigTab();
            }
        }

        // Dashboard Metrics and Tables
        async function refreshAudits() {
            try {
                const res = await fetch('/api/audit');
                const data = await res.json();
                const container = document.getElementById('audit-log-stream');
                if (!container) return;
                
                container.innerHTML = '';
                document.getElementById('count-audits').innerText = data.length;

                if (data.length === 0) {
                    container.innerHTML = '<div class="terminal-row"><span style="color:var(--text-muted)">No commands executed yet.</span></div>';
                    return;
                }

                data.forEach(item => {
                    const time = item.timestamp.split(' ')[1] || item.timestamp;
                    const statusClass = `status-${item.status.toLowerCase()}`;
                    const row = document.createElement('div');
                    row.className = 'terminal-row';
                    row.innerHTML = `
                        <span class="timestamp">${time}</span>
                        <span class="cmd-text">$ ${item.command}</span>
                        <span><span class="cmd-status ${statusClass}">${item.status}</span></span>
                    `;
                    container.appendChild(row);
                });
            } catch(e) {
                console.error(e);
            }
        }

        async function checkPending() {
            try {
                const res = await fetch('/api/pending');
                const data = await res.json();
                const container = document.getElementById('pending-actions-box');
                if (!container) return;
                
                container.innerHTML = '';

                if (data.length === 0) {
                    container.innerHTML = '<div style="color:var(--text-muted); font-size:0.9rem;">No actions waiting for user confirmation. Excellent!</div>';
                    return;
                }

                data.forEach(item => {
                    const card = document.createElement('div');
                    card.className = 'approval-card';
                    card.innerHTML = `
                        <div class="approval-text">Command requested execution:<br><strong style="font-family:\'JetBrains Mono\'; color:#38bdf8; display:block; margin-top:0.5rem; word-break:break-all;">${item.command}</strong></div>
                        <div class="approval-buttons">
                            <button class="btn btn-approve" onclick="approveCmd(${item.id}, true)">Approve 🚀</button>
                            <button class="btn btn-deny" onclick="approveCmd(${item.id}, false)">Deny 🚫</button>
                        </div>
                    `;
                    container.appendChild(card);
                });
            } catch(e) {
                console.error(e);
            }
        }

        async function approveCmd(id, approved) {
            try {
                await fetch('/api/approve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id, approved })
                });
                checkPending();
                refreshAudits();
                if (document.getElementById('tab-chat').style.display === 'flex') {
                    loadChatHistory();
                }
            } catch(e) {
                console.error(e);
            }
        }

        async function loadSkillsBox() {
            try {
                const res = await fetch('/api/skills');
                const data = await res.json();
                const container = document.getElementById('capabilities-box');
                if (!container) return;
                
                container.innerHTML = '';
                document.getElementById('count-skills').innerText = data.length;

                data.forEach(skill => {
                    const div = document.createElement('div');
                    div.style.padding = '0.85rem';
                    div.style.borderRadius = '10px';
                    div.style.background = 'rgba(255,255,255,0.02)';
                    div.style.border = '1px solid var(--border-panel)';
                    div.innerHTML = `
                        <div style="font-weight:600; color:var(--accent-blue); font-size:0.95rem;">${skill.name}</div>
                        <div style="font-size:0.8rem; color:var(--text-muted); margin-top:0.25rem;">${skill.description}</div>
                    `;
                    container.appendChild(div);
                });
            } catch(e) {
                console.error(e);
            }
        }

        // Multi-Agent Discord-style Chat State & Operations
        let activeAgentId = 'agent-coder';
        let activeChannel = 'general';
        let registeredAgents = [];

        async function loadAgents() {
            try {
                const res = await fetch('/api/agents');
                const data = await res.json();
                registeredAgents = data;

                const box = document.getElementById('discord-agents-list-box');
                if (!box) return;
                box.innerHTML = '';

                registeredAgents.forEach(agent => {
                    const li = document.createElement('li');
                    li.className = `discord-agent-item ${agent.id === activeAgentId ? 'active' : ''}`;
                    li.onclick = () => selectAgent(agent.id);
                    
                    // Determine status class
                    let statusClass = 'online';
                    if (agent.status === 'thinking') statusClass = 'thinking';
                    else if (agent.status === 'waiting_approval') statusClass = 'waiting_approval';

                    li.innerHTML = `
                        <div class="discord-agent-avatar">
                            ${agent.emoji}
                            <span class="discord-agent-status ${statusClass}"></span>
                        </div>
                        <span style="flex:1;">${agent.name}</span>
                    `;
                    box.appendChild(li);
                });

                // Update details for the active agent
                const activeAgent = registeredAgents.find(a => a.id === activeAgentId);
                if (activeAgent) {
                    document.getElementById('active-agent-avatar').innerText = activeAgent.emoji;
                    document.getElementById('active-agent-name').innerText = activeAgent.name;
                    document.getElementById('active-agent-status-badge').innerText = activeAgent.status;
                    document.getElementById('active-agent-status-badge').className = `discord-header-status ${activeAgent.status}`;

                    // Update autonomous control bar values
                    document.getElementById('autonomous-goal-input').value = activeAgent.autonomous_goal || '';
                    const autoBtn = document.getElementById('btn-toggle-auto');
                    if (activeAgent.is_autonomous) {
                        autoBtn.innerText = 'Stop Loop 🛑';
                        autoBtn.className = 'btn btn-danger';
                    } else {
                        autoBtn.innerText = 'Start Loop 🔁';
                        autoBtn.className = 'btn btn-approve';
                    }

                    // Populate model selector with downloaded GGUF options and select active one
                    populateModelSelector(activeAgent);
                }
            } catch (e) {
                console.error("Failed to load agents", e);
            }
        }

        function populateModelSelector(activeAgent) {
            const selector = document.getElementById('chat-model-selector');
            const groupGguf = document.getElementById('selector-group-gguf');
            if (!selector || !groupGguf) return;

            groupGguf.innerHTML = '';

            // Add all downloaded GGUF models
            downloadedModels.forEach(model => {
                const opt = document.createElement('option');
                opt.value = `camelid/${model}`;
                opt.innerText = model;
                groupGguf.appendChild(opt);
            });

            // Fallback default local option if none downloaded yet
            if (downloadedModels.length === 0) {
                const opt = document.createElement('option');
                opt.value = 'camelid/Llama-3.2-3B-Instruct-Q8_0.gguf';
                opt.innerText = 'Llama-3.2-3B-Instruct-Q8_0.gguf (Default)';
                groupGguf.appendChild(opt);
            }

            // Set selected value matching provider and model name
            const activeVal = `${activeAgent.model_provider}/${activeAgent.model_name}`;
            
            // Check if option exists, if not add it dynamically
            let optExists = false;
            for (let i = 0; i < selector.options.length; i++) {
                if (selector.options[i].value === activeVal) {
                    optExists = true;
                    break;
                }
            }

            if (!optExists) {
                const opt = document.createElement('option');
                opt.value = activeVal;
                opt.innerText = activeAgent.model_name;
                // Add to dynamic group depending on provider
                if (activeAgent.model_provider === 'camelid') {
                    groupGguf.appendChild(opt);
                } else {
                    document.getElementById('selector-group-apis').appendChild(opt);
                }
            }

            selector.value = activeVal;
        }

        async function handleModelSelectorChange() {
            const selector = document.getElementById('chat-model-selector');
            const val = selector.value;
            const parts = val.split('/');
            const provider = parts[0];
            const model = parts.slice(1).join('/');

            try {
                const res = await fetch('/api/agents/update_model', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agent_id: activeAgentId,
                        model_provider: provider,
                        model_name: model
                    })
                });
                const data = await res.json();
                if (data.status === 'updated') {
                    // Instantly reload agents list to refresh selector state
                    loadAgents();
                } else {
                    alert("Failed to update model: " + data.error);
                }
            } catch (e) {
                console.error("Error updating model selector", e);
            }
        }

        function selectAgent(agentId) {
            activeAgentId = agentId;
            // Highlight list selection
            document.querySelectorAll('.discord-agent-item').forEach(el => el.classList.remove('active'));
            loadAgents();
            loadChatHistory();
        }

        function selectChannel(channelType) {
            activeChannel = channelType;
            // Update highlights
            document.querySelectorAll('.discord-channel-item').forEach(el => el.classList.remove('active'));
            document.getElementById(`channel-${channelType}`).classList.add('active');

            // Show or hide sandbox gate and autonomous control bar depending on channel type
            const autoBar = document.getElementById('discord-autonomous-bar');
            const inputContainer = document.querySelector('.discord-input-container');
            
            if (channelType === 'sandbox') {
                autoBar.style.display = 'flex';
            } else {
                autoBar.style.display = 'none';
            }

            // Hide chat input container entirely for diagnostics view
            if (channelType === 'diagnostics') {
                if (inputContainer) inputContainer.style.display = 'none';
            } else {
                if (inputContainer) inputContainer.style.display = 'block';
            }

            loadChatHistory();
        }

        async function loadChatHistory() {
            try {
                const sessionId = `${activeAgentId}_${activeChannel}`;
                
                // If channel is diagnostics, render a beautiful live status dashboard instead of message bubble stream!
                if (activeChannel === 'diagnostics') {
                    renderDiagnosticsChannel();
                    return;
                }

                const res = await fetch(`/api/history?session_id=${sessionId}`);
                const data = await res.json();
                const box = document.getElementById('chat-messages-box');
                box.innerHTML = '';

                // Handle empty history
                if (data.length === 0) {
                    if (activeChannel === 'sandbox') {
                        box.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:4rem;">\
                            Autonomous sandbox is idle. Enter a goal below and hit <strong>Start Loop 🔁</strong> to trigger background runs!</div>`;
                    } else {
                        box.innerHTML = `<div style="color:var(--text-muted); text-align:center; padding:4rem;">\
                            Channel memory is empty. Start typing below to command your agent!</div>`;
                    }
                    return;
                }

                // Look for pending approvals and display gate
                checkPendingGate();

                data.forEach(msg => {
                    const row = document.createElement('div');
                    row.className = 'discord-message-row';

                    let avatar = '👤';
                    let sender = 'You';
                    
                    if (msg.role === 'user') {
                        if (msg.content.startsWith('Tool Command:')) {
                            // Extract tool name and outcomes
                            avatar = '🔧';
                            sender = 'System Firewall';
                        }
                    } else if (msg.role === 'assistant') {
                        const activeAgent = registeredAgents.find(a => a.id === activeAgentId);
                        avatar = activeAgent ? activeAgent.emoji : '🤖';
                        sender = activeAgent ? activeAgent.name : 'Agent';
                    }

                    // Format message body text (code blocks and tool outcomes)
                    let formattedText = msg.content;
                    if (formattedText.startsWith('Tool Command:')) {
                        // Render system execution feedback in a gorgeous terminal pane
                        const command = formattedText.split('\n')[0].replace('Tool Command: ', '').replace(/`/g, '');
                        const output = formattedText.split('\n').slice(2).join('\n');
                        
                        formattedText = `<div style="border-left:3px solid var(--accent-glow); padding:0.5rem 1rem; background:rgba(0,0,0,0.3); border-radius:8px; margin:0.5rem 0;">\
                            <div style="font-weight:600; color:#38bdf8; font-size:0.8rem; margin-bottom:0.25rem;">🔧 Executed Tool Command</div>\
                            <code style="font-family:'JetBrains Mono'; font-size:0.85rem; color:#a5b4fc;">$ ${command}</code>\
                            <pre style="margin-top:0.5rem; max-height:200px; overflow-y:auto; font-size:0.8rem; color:#d1d5db; font-family:'JetBrains Mono';">${output}</pre>\
                        </div>`;
                    } else {
                        // Replace simple markdown formatting
                        formattedText = formattedText
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(/\n/g, '<br>')
                            .replace(/```tool-exec<br>([\s\S]*?)```/g, '<div style="border-left:3px solid var(--accent-glow); padding:0.5rem 1rem; background:rgba(124,77,255,0.05); border-radius:8px; margin:0.5rem 0;"><div style="font-weight:600; color:var(--accent-glow); font-size:0.8rem; margin-bottom:0.25rem;">🚀 Requested Tool Execution</div><code style="font-family:\'JetBrains Mono\'; font-size:0.85rem; color:#a5b4fc;">$ $1</code></div>')
                            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                            .replace(/`([^`]+)`/g, '<code>$1</code>');
                    }

                    row.innerHTML = `
                        <div class="discord-message-avatar">${avatar}</div>
                        <div class="discord-message-content-wrapper">
                            <div class="discord-message-meta">
                                <span class="discord-message-sender" style="${msg.role === 'assistant' ? 'color:var(--accent-glow);' : (sender === 'System Firewall' ? 'color:#38bdf8;' : '')}">${sender}</span>
                                <span class="discord-message-time">${msg.timestamp || ''}</span>
                            </div>
                            <div class="discord-message-text">${formattedText}</div>
                        </div>
                    `;
                    box.appendChild(row);
                });

                box.scrollTop = box.scrollHeight;
            } catch (e) {
                console.error("Failed to load chat history", e);
            }
        }

        async function checkPendingGate() {
            try {
                const res = await fetch('/api/pending');
                const data = await res.json();
                const gate = document.getElementById('discord-sandbox-gate-container');
                const gateCmd = document.getElementById('discord-sandbox-gate-cmd');
                
                if (data.length > 0) {
                    gate.style.display = 'flex';
                    gateCmd.innerText = `Command: ${data[0].command}`;
                    
                    // Wire buttons to this pending log ID
                    document.getElementById('btn-gate-approve').onclick = () => approveAction(data[0].id);
                    document.getElementById('btn-gate-deny').onclick = () => denyAction(data[0].id);
                } else {
                    gate.style.display = 'none';
                }
            } catch (e) {
                console.error("Error checking pending approvals", e);
            }
        }

        function renderDiagnosticsChannel() {
            const box = document.getElementById('chat-messages-box');
            const activeAgent = registeredAgents.find(a => a.id === activeAgentId);
            if (!activeAgent) return;

            box.innerHTML = `
                <div style="padding:2rem; display:flex; flex-direction:column; gap:1.5rem;">
                    <h2 style="font-size:1.3rem; margin-top:0; color:white;">📊 Agent System Diagnostics</h2>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.5rem;">
                        <div class="glass-card" style="padding:1.25rem;">
                            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem;">LLM METRICS</div>
                            <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.85rem;">
                                <div style="display:flex; justify-content:space-between;"><span>Provider:</span><strong style="color:var(--accent-blue);">${activeAgent.model_provider}</strong></div>
                                <div style="display:flex; justify-content:space-between;"><span>Model:</span><strong style="color:white; word-break:break-all; text-align:right;">${activeAgent.model_name}</strong></div>
                            </div>
                        </div>
                        <div class="glass-card" style="padding:1.25rem;">
                            <div style="font-weight:700; font-size:0.85rem; color:var(--text-muted); margin-bottom:0.75rem;">AUTONOMOUS STATUS</div>
                            <div style="display:flex; flex-direction:column; gap:0.5rem; font-size:0.85rem;">
                                <div style="display:flex; justify-content:space-between;"><span>Running Background:</span><strong style="color:${activeAgent.is_autonomous ? 'var(--status-success)' : 'var(--text-muted)'};">${activeAgent.is_autonomous ? 'YES 🔁' : 'NO 🚫'}</strong></div>
                                <div style="display:flex; justify-content:space-between;"><span>Loop State:</span><strong style="color:white;">${activeAgent.status}</strong></div>
                            </div>
                        </div>
                    </div>
                    <div class="glass-card" style="padding:1.25rem; font-family:'JetBrains Mono', monospace; font-size:0.8rem; background:rgba(0,0,0,0.3); border-color:rgba(255,255,255,0.02);">
                        <div style="color:var(--text-muted); margin-bottom:0.5rem; font-weight:700;">AGENT PERSION DIRECTIVE (SOUL.md OVERRIDE):</div>
                        <div style="color:#d1d5db; line-height:1.6; white-space:pre-wrap; max-height:220px; overflow-y:auto; padding:0.5rem; background:rgba(0,0,0,0.2); border-radius:6px;">${activeAgent.persona}</div>
                    </div>
                </div>
            `;
        }

        async function approveAction(id) {
            await fetch('/api/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, approved: true })
            });
            document.getElementById('discord-sandbox-gate-container').style.display = 'none';
            loadChatHistory();
        }

        async function denyAction(id) {
            await fetch('/api/approve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, approved: false })
            });
            document.getElementById('discord-sandbox-gate-container').style.display = 'none';
            loadChatHistory();
        }

        async function toggleAutonomousLoop() {
            const activeAgent = registeredAgents.find(a => a.id === activeAgentId);
            if (!activeAgent) return;

            const isAuto = !activeAgent.is_autonomous;
            const goal = document.getElementById('autonomous-goal-input').value.trim();

            if (isAuto && !goal) {
                alert("Please specify an autonomous background goal before starting the loop.");
                return;
            }

            try {
                const res = await fetch('/api/agents/toggle_autonomous', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agent_id: activeAgentId,
                        is_autonomous: isAuto,
                        autonomous_goal: isAuto ? goal : null
                    })
                });
                const data = await res.json();
                if (data.status === 'toggled') {
                    loadAgents();
                } else {
                    alert("Toggle autonomous loop failed: " + data.error);
                }
            } catch (e) {
                console.error("Failed to toggle autonomous mode", e);
            }
        }

        function handleChatKey(e) {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        }

        async function sendChatMessage() {
            const input = document.getElementById('chat-input-field');
            const msg = input.value.trim();
            if (!msg) return;

            input.value = '';
            
            // Append client bubble instantly in General channel
            const box = document.getElementById('chat-messages-box');
            if (activeChannel !== 'diagnostics') {
                const row = document.createElement('div');
                row.className = 'discord-message-row';
                row.innerHTML = `
                    <div class="discord-message-avatar">👤</div>
                    <div class="discord-message-content-wrapper">
                        <div class="discord-message-meta">
                            <span class="discord-message-sender">You</span>
                            <span class="discord-message-time">just now</span>
                        </div>
                        <div class="discord-message-text">${msg}</div>
                    </div>
                `;
                box.appendChild(row);
                box.scrollTop = box.scrollHeight;
            }

            // Show indicator
            const indicator = document.getElementById('chat-thinking');
            indicator.style.display = 'flex';

            try {
                const sessionId = `${activeAgentId}_${activeChannel}`;
                const res = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message: msg,
                        session_id: sessionId
                    })
                });
                const data = await res.json();
                
                indicator.style.display = 'none';
                loadChatHistory();
            } catch(e) {
                console.error(e);
                indicator.style.display = 'none';
            }
        }

        // Custom Agent modal operations
        function openCreateAgentModal() {
            document.getElementById('new-agent-name').value = '';
            document.getElementById('new-agent-emoji').value = '🤖';
            document.getElementById('new-agent-persona').value = '';
            document.getElementById('create-agent-modal').classList.add('active');
        }

        function closeCreateAgentModal() {
            document.getElementById('create-agent-modal').classList.remove('active');
        }

        async function saveNewAgent() {
            const name = document.getElementById('new-agent-name').value.trim();
            const emoji = document.getElementById('new-agent-emoji').value.trim();
            const modelVal = document.getElementById('new-agent-model').value;
            const persona = document.getElementById('new-agent-persona').value.trim();

            if (!name || !persona) {
                alert("Agent Name and Persona directives are required.");
                return;
            }

            const parts = modelVal.split('/');
            const provider = parts[0];
            const model = parts.slice(1).join('/');

            try {
                const res = await fetch('/api/agents/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        emoji,
                        model_provider: provider,
                        model_name: model,
                        persona
                    })
                });
                const data = await res.json();
                if (data.status === 'created') {
                    closeCreateAgentModal();
                    activeAgentId = data.agent_id;
                    loadAgents();
                    loadChatHistory();
                } else {
                    alert("Failed to spawn agent: " + data.error);
                }
            } catch (e) {
                alert("Request error: " + e);
            }
        }

        // Skills Tab Management
        async function loadSkillsTab() {
            try {
                const res = await fetch('/api/skills');
                const data = await res.json();
                const grid = document.getElementById('skills-grid-box');
                grid.innerHTML = '';

                data.forEach(skill => {
                    const card = document.createElement('div');
                    card.className = 'glass-card';
                    card.style.display = 'flex';
                    card.style.flexDirection = 'column';
                    card.style.gap = '0.75rem';
                    card.innerHTML = `
                        <h2 style="color:var(--accent-glow); font-size:1.3rem;">${skill.name}</h2>
                        <p style="color:var(--text-muted); font-size:0.9rem; flex:1; line-height:1.5;">${skill.description}</p>
                        <div style="font-family:\'JetBrains Mono\'; font-size:0.75rem; border-top:1px solid var(--border-panel); padding-top:0.75rem; margin-top:0.5rem; word-break:break-all; color:#38bdf8;">
                            Path: ${skill.path}
                        </div>
                    `;
                    grid.appendChild(card);
                });
            } catch(e) {
                console.error(e);
            }
        }

        function openNewSkillModal() {
            document.getElementById('modal-skill-name').value = '';
            document.getElementById('modal-skill-desc').value = '';
            document.getElementById('modal-skill-content').value = `---
name: my-custom-skill
description: A short playbook to guide command orchestration.
---

# My Custom Skill
Describe when the agent should trigger this playbook.

## Workflow
1. Execute command:
   \`echo "Hello World"\`
`;
            document.getElementById('new-skill-modal').style.display = 'flex';
        }

        function closeNewSkillModal() {
            document.getElementById('new-skill-modal').style.display = 'none';
        }

        async function saveNewSkill() {
            const name = document.getElementById('modal-skill-name').value.trim();
            const desc = document.getElementById('modal-skill-desc').value.trim();
            const content = document.getElementById('modal-skill-content').value;

            if (!name || !content) {
                alert('Slug and skill playbook content are required.');
                return;
            }

            try {
                const res = await fetch('/api/skills/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, description: desc, content })
                });
                const data = await res.json();
                
                if (data.status === 'success') {
                    closeNewSkillModal();
                    loadSkillsTab();
                } else {
                    alert('Error saving skill: ' + data.error);
                }
            } catch(e) {
                alert('Save request failed: ' + e);
            }
        }

        // Settings and TOML configuration tab
        async function loadConfigTab() {
            try {
                const res = await fetch('/api/config');
                const data = await res.json();
                document.getElementById('config-editor-box').value = data.config;
            } catch(e) {
                console.error(e);
            }
        }

        async function saveConfiguration() {
            const text = document.getElementById('config-editor-box').value;
            try {
                const res = await fetch('/api/config/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ config: text })
                });
                const data = await res.json();
                if (data.status === 'success') {
                    alert('Configuration successfully written! Gateway adapters reloaded.');
                    loadConfigTab();
                } else {
                    alert('Invalid TOML structure:\n' + data.error);
                }
            } catch(e) {
                alert('Save failed: ' + e);
            }
        }

        function confirmResetDB() {
            if (confirm('⚠️ WARNING:\nAre you sure you want to wipe all session history, command audit trails, and execution states from SQLite?\nThis action cannot be undone!')) {
                resetDatabase();
            }
        }

        async function resetDatabase() {
            try {
                const res = await fetch('/api/database/reset', { method: 'POST' });
                const data = await res.json();
                if (data.status === 'success') {
                    alert('Database cleared successfully! Enjoy a fresh start.');
                    if (document.getElementById('tab-chat').style.display === 'flex') {
                        loadChatHistory();
                    } else {
                        refreshAudits();
                    }
                } else {
                    alert('Wipe operation failed: ' + data.error);
                }
            } catch(e) {
                alert('Database request failed: ' + e);
            }
        }

        // Onload
        window.onload = function() {
            refreshAudits();
            checkPending();
            loadSkillsBox();
            
            // Periodically check for pending approvals in the background
            setInterval(checkPending, 2000);
            setInterval(refreshAudits, 5000);
            
            // Also call status check on load
            refreshModels();

            // Load and poll agent profiles for multi-agent console
            loadAgents();
            setInterval(loadAgents, 3000);
        }

        // Local Models Manager JavaScript
        let activeModelName = "";
        let downloadedModels = [];

        async function refreshModels() {
            try {
                const res = await fetch('/api/models/status');
                const data = await res.json();
                
                activeModelName = data.active_model;
                downloadedModels = data.downloaded;

                // 1. Reset all cards styling and button states
                resetModelCards();

                // 2. Mark downloaded and active models
                updateModelCardsState();

                // 3. Handle active download state
                const ds = data.download_state;
                if (ds && ds.downloading) {
                    showDownloadProgress(ds.model, ds.progress);
                    // Poll status again in 1 second
                    setTimeout(refreshModels, 1000);
                } else if (ds && ds.progress === 100 && !ds.downloading) {
                    // Download completed
                    hideAllProgressBars();
                } else if (ds && ds.error) {
                    alert("Download failed: " + ds.error);
                    hideAllProgressBars();
                }
            } catch (e) {
                console.error("Failed to fetch model status", e);
            }
        }

        function resetModelCards() {
            const cardIds = {
                'tinyllama-1.1b-chat-v1.0.Q8_0.gguf': 'card-tinyllama',
                'Llama-3.2-1B-Instruct-Q8_0.gguf': 'card-llama1b',
                'Llama-3.2-3B-Instruct-Q8_0.gguf': 'card-llama3b',
                'Meta-Llama-3-8B-Instruct-Q8_0.gguf': 'card-llama8b',
                'Mistral-7B-Instruct-v0.3.Q8_0.gguf': 'card-mistral'
            };

            const btnIds = {
                'tinyllama-1.1b-chat-v1.0.Q8_0.gguf': 'btn-tinyllama',
                'Llama-3.2-1B-Instruct-Q8_0.gguf': 'btn-llama1b',
                'Llama-3.2-3B-Instruct-Q8_0.gguf': 'btn-llama3b',
                'Meta-Llama-3-8B-Instruct-Q8_0.gguf': 'btn-llama8b',
                'Mistral-7B-Instruct-v0.3.Q8_0.gguf': 'btn-mistral'
            };

            for (const key in cardIds) {
                const card = document.getElementById(cardIds[key]);
                if (card) card.classList.remove('active-model');

                const btn = document.getElementById(btnIds[key]);
                if (btn) {
                    btn.innerText = 'Download Model 📥';
                    btn.className = 'btn btn-primary';
                    btn.disabled = false;
                    btn.style.background = '';
                    btn.style.color = '';
                }
            }
        }

        function updateModelCardsState() {
            const btnIds = {
                'tinyllama-1.1b-chat-v1.0.Q8_0.gguf': 'btn-tinyllama',
                'Llama-3.2-1B-Instruct-Q8_0.gguf': 'btn-llama1b',
                'Llama-3.2-3B-Instruct-Q8_0.gguf': 'btn-llama3b',
                'Meta-Llama-3-8B-Instruct-Q8_0.gguf': 'btn-llama8b',
                'Mistral-7B-Instruct-v0.3.Q8_0.gguf': 'btn-mistral'
            };

            const cardIds = {
                'tinyllama-1.1b-chat-v1.0.Q8_0.gguf': 'card-tinyllama',
                'Llama-3.2-1B-Instruct-Q8_0.gguf': 'card-llama1b',
                'Llama-3.2-3B-Instruct-Q8_0.gguf': 'card-llama3b',
                'Meta-Llama-3-8B-Instruct-Q8_0.gguf': 'card-llama8b',
                'Mistral-7B-Instruct-v0.3.Q8_0.gguf': 'card-mistral'
            };

            // Set downloaded buttons to "Activate"
            downloadedModels.forEach(model => {
                const btn = document.getElementById(btnIds[model]);
                if (btn) {
                    btn.innerText = 'Activate Model 🚀';
                    btn.className = 'btn btn-approve';
                }
            });

            // Set active model card highlight
            if (activeModelName && cardIds[activeModelName]) {
                const card = document.getElementById(cardIds[activeModelName]);
                if (card) card.classList.add('active-model');

                const btn = document.getElementById(btnIds[activeModelName]);
                if (btn) {
                    btn.innerText = 'Active Local LLM ✓';
                    btn.className = 'btn';
                    btn.style.background = 'rgba(16, 185, 129, 0.2)';
                    btn.style.color = 'var(--status-success)';
                    btn.disabled = true;
                }
            }
        }

        function showDownloadProgress(modelFilename, progressPercent) {
            const progressIds = {
                'tinyllama-1.1b-chat-v1.0.Q8_0.gguf': 'progress-tinyllama',
                'Llama-3.2-1B-Instruct-Q8_0.gguf': 'progress-llama1b',
                'Llama-3.2-3B-Instruct-Q8_0.gguf': 'progress-llama3b',
                'Meta-Llama-3-8B-Instruct-Q8_0.gguf': 'progress-llama8b',
                'Mistral-7B-Instruct-v0.3.Q8_0.gguf': 'progress-mistral'
            };

            const progressInnerIds = {
                'tinyllama-1.1b-chat-v1.0.Q8_0.gguf': 'progress-inner-tinyllama',
                'Llama-3.2-1B-Instruct-Q8_0.gguf': 'progress-inner-llama1b',
                'Llama-3.2-3B-Instruct-Q8_0.gguf': 'progress-inner-llama3b',
                'Meta-Llama-3-8B-Instruct-Q8_0.gguf': 'progress-inner-llama8b',
                'Mistral-7B-Instruct-v0.3.Q8_0.gguf': 'progress-inner-mistral'
            };

            const btnIds = {
                'tinyllama-1.1b-chat-v1.0.Q8_0.gguf': 'btn-tinyllama',
                'Llama-3.2-1B-Instruct-Q8_0.gguf': 'btn-llama1b',
                'Llama-3.2-3B-Instruct-Q8_0.gguf': 'btn-llama3b',
                'Meta-Llama-3-8B-Instruct-Q8_0.gguf': 'btn-llama8b',
                'Mistral-7B-Instruct-v0.3.Q8_0.gguf': 'btn-mistral'
            };

            const pBar = document.getElementById(progressIds[modelFilename]);
            const pInner = document.getElementById(progressInnerIds[modelFilename]);
            const btn = document.getElementById(btnIds[modelFilename]);

            if (pBar && pInner && btn) {
                pBar.style.display = 'block';
                pInner.style.width = `${progressPercent}%`;
                btn.innerText = `Downloading ${progressPercent.toFixed(1)}% 📥`;
                btn.disabled = true;
            }
        }

        function hideAllProgressBars() {
            const progressIds = ['progress-tinyllama', 'progress-llama1b', 'progress-llama3b', 'progress-llama8b', 'progress-mistral'];
            progressIds.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }

        async function handleModelAction(modelId, modelFilename) {
            if (downloadedModels.includes(modelFilename)) {
                // Activate model
                try {
                    const res = await fetch('/api/models/activate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: modelFilename })
                    });
                    const data = await res.json();
                    if (data.status === 'activated') {
                        refreshModels();
                    } else {
                        alert("Activation failed: " + data.error);
                    }
                } catch (e) {
                    console.error("Failed to activate model", e);
                }
            } else {
                // Download model
                try {
                    const res = await fetch('/api/models/download', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model_id: modelId })
                    });
                    const data = await res.json();
                    if (data.status === 'started') {
                        refreshModels();
                    } else {
                        alert("Download failed to start: " + data.error);
                    }
                } catch (e) {
                    console.error("Failed to trigger download", e);
                }
            }
        }
    </script>
</body>
</html>
"#;
    html.to_string()
}
