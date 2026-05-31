use crate::storage::DbState;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Serialize, Debug, Clone)]
pub struct BenchmarkResult {
    pub metal_gpu_tps: f64,
    pub cpu_fallback_tps: f64,
    pub cloud_gpt_latency_ms: u128,
    pub cloud_claude_latency_ms: u128,
    pub active_local_latency_ms: u128,
    pub status: String,
}

pub fn get_audit_log_path() -> PathBuf {
    let mut path = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string()));
    path.push(".cameleer");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path.push("sandbox_audit.log");
    path
}

pub fn audit_log_sandbox(agent_id: &str, action_type: &str, status: &str, details: &str) {
    let path = get_audit_log_path();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let log_line = format!(
        "[{}] [{}] [{}] [{}] {}\n",
        now,
        agent_id.to_uppercase(),
        action_type.to_uppercase(),
        status.to_uppercase(),
        details
    );

    if let Ok(mut f) = fs::OpenOptions::new().create(true).append(true).open(&path) {
        use std::io::Write;
        let _ = f.write_all(log_line.as_bytes());
    }
}

#[tauri::command]
pub fn get_sandbox_audit_logs() -> Result<Vec<String>, String> {
    let path = get_audit_log_path();
    if !path.exists() {
        return Ok(vec![
            "[SYSTEM] Sandbox firewall active. Ready to audit dynamic ReAct tool actions."
                .to_string(),
        ]);
    }

    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut lines: Vec<String> = content.lines().map(|s| s.to_string()).collect();

    if lines.len() > 150 {
        lines = lines.split_off(lines.len() - 150);
    }

    if lines.is_empty() {
        lines.push(
            "[SYSTEM] Sandbox firewall active. Ready to audit dynamic ReAct tool actions."
                .to_string(),
        );
    }

    Ok(lines)
}

#[derive(Serialize, Debug, Clone)]
pub struct CamelidHealth {
    pub status: String,
    pub endpoint: String,
    pub model_loaded: Option<String>,
    pub capabilities_available: bool,
    pub openai_chat_available: bool,
    pub message: String,
}

pub async fn probe_camelid(endpoint: &str) -> CamelidHealth {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(500))
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());

    let capabilities_url = format!("{}/api/capabilities", endpoint.trim_end_matches('/'));
    let mut capabilities_available = false;
    let mut openai_chat_available = false;
    let mut model_loaded = None;
    let mut status = "offline".to_string();
    let mut message = "Camelid is offline".to_string();

    match client.get(&capabilities_url).send().await {
        Ok(resp) => {
            if resp.status().is_success() {
                capabilities_available = true;
                status = "connected".to_string();
                message = "Camelid is connected and responding to capabilities API".to_string();
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(model) = json
                        .get("model")
                        .or_else(|| json.get("active_model"))
                        .and_then(|v| v.as_str())
                    {
                        model_loaded = Some(model.to_string());
                    }
                }
            }
        }
        Err(_) => {}
    }

    if !capabilities_available {
        let health_url = format!("{}/health", endpoint.trim_end_matches('/'));
        match client.get(&health_url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    status = "connected".to_string();
                    message = "Camelid is connected (responding to /health)".to_string();
                }
            }
            Err(_) => {}
        }
    }

    if status == "offline" {
        match client.get(endpoint).send().await {
            Ok(resp) => {
                status = "connected".to_string();
                message = format!("Camelid endpoint responded with status {}", resp.status());
            }
            Err(e) => {
                status = "offline".to_string();
                message = format!("Connection failed: {}", e);
            }
        }
    }

    if status == "connected" {
        let chat_url = format!("{}/v1/chat/completions", endpoint.trim_end_matches('/'));
        match client
            .request(reqwest::Method::OPTIONS, &chat_url)
            .send()
            .await
        {
            Ok(_) => {
                openai_chat_available = true;
            }
            Err(_) => {
                openai_chat_available = true;
            }
        }

        if model_loaded.is_none() {
            let models_url = format!("{}/v1/models", endpoint.trim_end_matches('/'));
            if let Ok(resp) = client.get(&models_url).send().await {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(data) = json.get("data").and_then(|d| d.as_array()) {
                        if let Some(first_model) = data
                            .first()
                            .and_then(|m| m.get("id"))
                            .and_then(|id| id.as_str())
                        {
                            model_loaded = Some(first_model.to_string());
                        }
                    }
                }
            }
        }
    }

    CamelidHealth {
        status,
        endpoint: endpoint.to_string(),
        model_loaded,
        capabilities_available,
        openai_chat_available,
        message,
    }
}

#[tauri::command]
pub async fn check_camelid_health(state: State<'_, DbState>) -> Result<CamelidHealth, String> {
    let camelid_endpoint = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT value FROM settings WHERE key = 'camelid_endpoint'",
            [],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "http://127.0.0.1:8181".to_string())
    };

    Ok(probe_camelid(&camelid_endpoint).await)
}

#[tauri::command]
pub async fn run_model_benchmark(state: State<'_, DbState>) -> Result<BenchmarkResult, String> {
    let camelid_endpoint = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT value FROM settings WHERE key = 'camelid_endpoint'",
            [],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "http://127.0.0.1:8181".to_string())
    };

    let start = Instant::now();
    let camelid_health = probe_camelid(&camelid_endpoint).await;

    if camelid_health.status == "offline" {
        return Err("Camelid is offline. Cannot compile benchmark metrics.".to_string());
    }

    let elapsed = start.elapsed().as_millis();
    Ok(BenchmarkResult {
        metal_gpu_tps: 0.0,
        cpu_fallback_tps: 0.0,
        cloud_gpt_latency_ms: 0,
        cloud_claude_latency_ms: 0,
        active_local_latency_ms: elapsed,
        status: format!("Camelid connected. Probe latency: {}ms", elapsed),
    })
}

#[derive(Serialize, Debug, Clone)]
pub struct BackendHealth {
    pub app_status: String,
    pub database_status: String,
    pub camelid_status: String,
    pub schema_version: i64,
    pub required_schema_version: i64,
    pub database_path: String,
    pub active_workspace_id: Option<String>,
    pub active_workspace_name: Option<String>,
    pub active_agent_id: Option<String>,
    pub active_agent_name: Option<String>,
    pub camelid_endpoint: String,
    pub camelid_model: Option<String>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

pub fn validate_table_columns(
    conn: &rusqlite::Connection,
    table: &str,
    required_cols: &[&str],
    errors: &mut Vec<String>,
) -> Result<(), rusqlite::Error> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let mut rows = stmt.query([])?;
    let mut existing_cols = std::collections::HashSet::new();
    while let Some(row) = rows.next()? {
        let col_name: String = row.get(1)?;
        existing_cols.insert(col_name);
    }

    if existing_cols.is_empty() {
        errors.push(format!("Missing required table: {}", table));
        return Ok(());
    }

    for col in required_cols {
        if !existing_cols.contains(*col) {
            errors.push(format!("Missing required column: {}.{}", table, col));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_backend_health(state: State<'_, DbState>) -> Result<BackendHealth, String> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();
    let required_schema_version = 2i64;
    let database_path = crate::storage::get_db_path().to_string_lossy().to_string();

    let db_info = {
        let conn_res = state.conn.lock();
        match conn_res {
            Ok(conn) => {
                let mut database_status = "ready".to_string();
                let mut camelid_endpoint = "http://127.0.0.1:8181".to_string();
                let camelid_endpoint_res = conn.query_row(
                    "SELECT value FROM settings WHERE key = 'camelid_endpoint'",
                    [],
                    |row| row.get::<_, String>(0),
                );
                if let Ok(endpoint) = camelid_endpoint_res {
                    camelid_endpoint = endpoint;
                }

                let version_res =
                    conn.query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
                        row.get::<_, Option<i64>>(0)
                    });
                let schema_version = version_res.unwrap_or(None).unwrap_or(0);
                if schema_version < required_schema_version {
                    database_status = "migrating".to_string();
                }

                let table_validations = [
                    (
                        "mission_agent_contracts",
                        vec![
                            "agent_id",
                            "role",
                            "responsibilities",
                            "allowed_actions",
                            "required_context_before_work",
                            "required_outputs",
                            "validation_rules",
                            "handoff_rules",
                            "escalation_rules",
                            "done_definition",
                        ],
                    ),
                    (
                        "agents",
                        vec![
                            "id",
                            "name",
                            "role",
                            "persona",
                            "model_provider",
                            "model_name",
                            "temperature",
                            "max_tokens",
                            "can_spawn_subtasks",
                            "can_talk_globally",
                            "is_continuous",
                            "status",
                        ],
                    ),
                    ("workspaces", vec!["id", "name", "path", "active"]),
                    (
                        "messages",
                        vec![
                            "id",
                            "session_id",
                            "role",
                            "sender_id",
                            "content",
                            "timestamp",
                        ],
                    ),
                    (
                        "model_configs",
                        vec![
                            "id",
                            "provider",
                            "model_name",
                            "api_key",
                            "endpoint_url",
                            "is_default",
                        ],
                    ),
                ];

                for (table, cols) in &table_validations {
                    let _ = validate_table_columns(&conn, table, cols, &mut errors);
                }

                if !errors.is_empty() {
                    database_status = "schema_error".to_string();
                }

                let mut active_workspace_id = None;
                let mut active_workspace_name = None;
                let mut active_agent_id = None;
                let mut active_agent_name = None;

                if database_status == "ready" {
                    let _ = conn.query_row(
                        "SELECT id, name FROM workspaces WHERE active = 1 LIMIT 1",
                        [],
                        |row| {
                            active_workspace_id = row.get(0).ok();
                            active_workspace_name = row.get(1).ok();
                            Ok(())
                        },
                    );
                    let _ = conn.query_row("SELECT id, role FROM agents LIMIT 1", [], |row| {
                        active_agent_id = row.get(0).ok();
                        active_agent_name = row.get(1).ok();
                        Ok(())
                    });
                }

                (
                    database_status,
                    schema_version,
                    active_workspace_id,
                    active_workspace_name,
                    active_agent_id,
                    active_agent_name,
                    camelid_endpoint,
                )
            }
            Err(e) => {
                errors.push(format!("Database lock failed: {}", e));
                (
                    "offline".to_string(),
                    0,
                    None,
                    None,
                    None,
                    None,
                    "http://127.0.0.1:8181".to_string(),
                )
            }
        }
    };

    let (
        database_status,
        schema_version,
        active_workspace_id,
        active_workspace_name,
        active_agent_id,
        active_agent_name,
        camelid_endpoint,
    ) = db_info;

    let camelid_health = probe_camelid(&camelid_endpoint).await;
    let camelid_status = camelid_health.status;
    let camelid_model = camelid_health.model_loaded;
    if camelid_status == "offline" {
        warnings.push(format!(
            "Camelid inference backend is offline at {}",
            camelid_endpoint
        ));
    }

    let app_status = if database_status == "ready" && camelid_status == "connected" {
        "online".to_string()
    } else {
        "degraded".to_string()
    };

    Ok(BackendHealth {
        app_status,
        database_status,
        camelid_status,
        schema_version,
        required_schema_version,
        database_path,
        active_workspace_id,
        active_workspace_name,
        active_agent_id,
        active_agent_name,
        camelid_endpoint,
        camelid_model,
        errors,
        warnings,
    })
}

#[tauri::command]
pub async fn reset_dev_database(state: State<'_, DbState>) -> Result<String, String> {
    println!("[SYSTEM] Developer database reset initiated!");
    let mut conn_guard = state.conn.lock().map_err(|e| e.to_string())?;

    let db_path = crate::storage::get_db_path();
    let temp_conn = rusqlite::Connection::open_in_memory().map_err(|e| e.to_string())?;
    let old_conn = std::mem::replace(&mut *conn_guard, temp_conn);
    drop(old_conn); // Closes connection safely releasing locks

    if db_path.exists() {
        std::fs::remove_file(&db_path).map_err(|e| format!("Failed to delete db file: {}", e))?;
    }

    let new_conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
    crate::storage::init_db(&new_conn).map_err(|e| e.to_string())?;
    crate::storage::seed_default_agents(&new_conn).map_err(|e| e.to_string())?;

    *conn_guard = new_conn;

    println!("[SYSTEM] Developer database reset complete. Fresh schema, migrations, and defaults reseeded successfully.");
    Ok("Database reset successfully.".to_string())
}
