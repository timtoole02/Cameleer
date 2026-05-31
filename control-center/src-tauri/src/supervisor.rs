use crate::event_bus::{emit_event, AppEvent};
use crate::storage::DbState;
use std::fs;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

pub struct DaemonState {
    pub child: Arc<Mutex<Option<Child>>>,
}

pub fn spawn_camelid_daemon(
    db_state: &DbState,
    daemon_state: &DaemonState,
    model_override: Option<String>,
) -> Result<(), String> {
    let mut child_guard = daemon_state.child.lock().map_err(|e| e.to_string())?;

    // 1. Kill old daemon if running
    if let Some(mut old_child) = child_guard.take() {
        println!("[DAEMON] Killing active camelid process...");
        let _ = old_child.kill();
    }

    // 2. Resolve executable path
    let exec_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or_else(|| "Cannot resolve executable directory".to_string())?
        .to_path_buf();

    let mut exec_path = exec_dir.join("camelid");

    // Fallbacks for local development testing
    if !exec_path.exists() {
        exec_path = PathBuf::from("./target/release/camelid");
    }
    if !exec_path.exists() {
        exec_path = PathBuf::from("./camelid/target/release/camelid");
    }
    if !exec_path.exists() {
        exec_path = PathBuf::from("../target/release/camelid");
    }
    if !exec_path.exists() {
        exec_path = PathBuf::from("../camelid/target/release/camelid");
    }
    if !exec_path.exists() {
        exec_path = PathBuf::from("camelid"); // Fallback to PATH lookup
    }

    println!(
        "[DAEMON] Spawning camelid daemon from path: {:?}",
        exec_path
    );

    // 3. Resolve GGUF model path
    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
    let models_dir = PathBuf::from(&home).join(".cameleer").join("models");

    if !models_dir.exists() {
        let _ = fs::create_dir_all(&models_dir);
    }

    // Get active model name from database or fallback to override or default
    let model_name = match model_override {
        Some(m) => m,
        None => {
            let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
            let active_local: Option<String> = conn
                .query_row(
                    "SELECT value FROM shared_state WHERE key = 'active_local_model'",
                    [],
                    |row| row.get(0),
                )
                .ok();
            active_local.unwrap_or_else(|| "Llama-3.2-1B-Instruct-Q8_0.gguf".to_string())
        }
    };

    let model_path = models_dir.join(&model_name);

    let mut cmd = Command::new(exec_path);
    cmd.arg("serve")
        .arg("--addr")
        .arg("127.0.0.1:8181")
        .arg("--metal-linear")
        .arg("--metal-q8");

    // Pass environment variables for Apple Silicon Metal acceleration
    cmd.env("CAMELID_METAL_LINEAR", "1");
    cmd.env("CAMELID_METAL_Q8", "1");
    cmd.env("CAMELID_METAL_Q8_RETAINED", "1");
    cmd.env("CAMELID_HYBRID_Q8_RETAINED", "1");
    cmd.env("CAMELID_HYBRID_Q8_GPU_PERCENT", "90");
    cmd.env("CAMELID_MAC_Q8_FFN_GATE_UP_DECODE_CONSUMER", "1");
    cmd.env("CAMELID_MAC_Q8_FFN_DOWN_DECODE_CONSUMER", "1");
    cmd.env("CAMELID_MAC_Q8_FFN_DOWN_DECODE_GROUP_CHUNKING", "1");
    cmd.env("CAMELID_APPLE_ACCELERATE_MIN_ELEMENTS", "1024");
    cmd.env("CAMELID_PARALLEL_LINEAR_MIN_OUTPUTS", "1");

    if model_path.exists() && model_path.is_file() {
        println!("[DAEMON] Loading model GGUF: {:?}", model_path);
        cmd.arg("--model").arg(model_path);
    } else {
        println!(
            "[DAEMON] WARNING: Model GGUF not found at {:?}. Spawning headless camelid.",
            model_path
        );
    }

    // Set stdout/stderr to ~/.cameleer/camelid.log
    let log_dir = PathBuf::from(&home).join(".cameleer");
    if !log_dir.exists() {
        let _ = fs::create_dir_all(&log_dir);
    }
    let log_file_path = log_dir.join("camelid.log");
    let log_file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_file_path);

    if let Ok(file) = log_file {
        cmd.stdout(Stdio::from(file.try_clone().unwrap()));
        cmd.stderr(Stdio::from(file));
    } else {
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
    }

    match cmd.spawn() {
        Ok(child) => {
            println!("[DAEMON] camelid daemon successfully spawned on 127.0.0.1:8181.");
            *child_guard = Some(child);
            Ok(())
        }
        Err(e) => {
            eprintln!("[DAEMON] ERROR: Failed to spawn camelid daemon: {}", e);
            Err(e.to_string())
        }
    }
}

pub fn start_watchdog(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;

            let mut crashed_agents = Vec::new();

            {
                let state = match app_handle.try_state::<DbState>() {
                    Some(s) => s,
                    None => continue,
                };

                let conn = match state.conn.lock() {
                    Ok(c) => c,
                    Err(_) => continue,
                };

                // Query agents currently working
                let mut stmt = match conn.prepare(
                    "SELECT id, name, role, last_heartbeat FROM agents WHERE status = 'working'",
                ) {
                    Ok(s) => s,
                    Err(_) => continue,
                };

                let now = SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_secs();

                let iter = match stmt.query_map([], |row| {
                    Ok((
                        row.get::<_, String>(0)?,
                        row.get::<_, String>(1)?,
                        row.get::<_, String>(2)?,
                        row.get::<_, Option<String>>(3)?,
                    ))
                }) {
                    Ok(it) => it,
                    Err(_) => continue,
                };

                for agent in iter {
                    if let Ok((id, name, role, hb)) = agent {
                        let hb_sec = hb.and_then(|h| h.parse::<u64>().ok()).unwrap_or(0);

                        // Heartbeat timed out (> 20 seconds ago)
                        if hb_sec > 0 && now.saturating_sub(hb_sec) > 20 {
                            crashed_agents.push((id, name, role));
                        }
                    }
                }
            } // conn and stmt drop here

            for (id, name, role) in crashed_agents {
                println!("[WATCHDOG] Agent {} ({}) stalled due to heartbeat timeout. Initiating recovery...", name, role);

                {
                    let state = match app_handle.try_state::<DbState>() {
                        Some(s) => s,
                        None => continue,
                    };
                    let conn = match state.conn.lock() {
                        Ok(c) => c,
                        Err(_) => continue,
                    };
                    let _ = conn.execute(
                        "UPDATE agents SET status = 'recovering' WHERE id = ?1",
                        [&id],
                    );

                    let _ = conn.execute(
                        "INSERT INTO events (event_type, agent_id, payload) 
                         VALUES ('agent_stalled_recovery', ?1, ?2)",
                        rusqlite::params![id, format!("{{\"status\":\"recovering\",\"error\":\"Heartbeat timed out. Agent {} stalled for >20s. Rolling back to last checkpoint.\"}}", name)]
                    );
                }

                emit_event(
                    &app_handle,
                    AppEvent {
                        event_type: "agent_run_status".to_string(),
                        agent_id: Some(id.clone()),
                        task_id: None,
                        payload: serde_json::json!({ "status": "recovering", "error": "Heartbeat timed out. Stalled for >20s. Recovering state." }),
                    },
                );

                let _ =
                    crate::agent_recovery_engine::attempt_recovery(app_handle.clone(), id.clone())
                        .await;
            }
        }
    });
}

#[tauri::command]
pub fn update_heartbeat(state: tauri::State<'_, DbState>, agent_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();

    conn.execute(
        "UPDATE agents SET last_heartbeat = ?2 WHERE id = ?1",
        [agent_id, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
