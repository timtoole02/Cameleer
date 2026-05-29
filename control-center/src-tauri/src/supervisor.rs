use std::time::{SystemTime, UNIX_EPOCH, Duration};
use tauri::{AppHandle, Manager};
use crate::storage::DbState;
use crate::event_bus::{emit_event, AppEvent};
use std::process::{Command, Child, Stdio};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::fs;

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

    println!("[DAEMON] Spawning camelid daemon from path: {:?}", exec_path);

    // 3. Resolve GGUF model path
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/timtoole".to_string());
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
        println!("[DAEMON] WARNING: Model GGUF not found at {:?}. Spawning headless camelid.", model_path);
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

            // 1. Keep camelid background daemon alive and running
            if let Some(daemon_state) = app_handle.try_state::<DaemonState>() {
                let mut should_restart = false;
                if let Ok(mut child_guard) = daemon_state.child.try_lock() {
                    if let Some(ref mut child) = *child_guard {
                        match child.try_wait() {
                            Ok(Some(status)) => {
                                println!("[WATCHDOG] camelid daemon exited with status: {}. Restarting...", status);
                                should_restart = true;
                            }
                            Ok(None) => {
                                // Process is still running, perfect!
                            }
                            Err(e) => {
                                println!("[WATCHDOG] Error polling camelid status: {}. Restarting...", e);
                                should_restart = true;
                            }
                        }
                    } else {
                        // Daemon not started yet
                        should_restart = true;
                    }

                    if should_restart {
                        // Remove child process from state to ensure spawn has a clean slate
                        *child_guard = None;
                    }
                }

                if should_restart {
                    if let Some(db_state) = app_handle.try_state::<DbState>() {
                        println!("[WATCHDOG] Spawning background camelid local inference daemon...");
                        let _ = spawn_camelid_daemon(&db_state, &daemon_state, None);
                    }
                }
            }
            
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
                "SELECT id, name, role, last_heartbeat FROM agents WHERE status = 'working'"
            ) {
                Ok(s) => s,
                Err(_) => continue,
            };
            
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs();
                
            let mut crashed_agents = Vec::new();
            
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
                    
                    // Heartbeat timed out (> 15 seconds ago)
                    if hb_sec > 0 && now.saturating_sub(hb_sec) > 15 {
                        crashed_agents.push((id, name, role));
                    }
                }
            }
            
            drop(stmt);
            
            for (id, name, role) in crashed_agents {
                println!("[WATCHDOG] Agent {} ({}) crashed due to heartbeat timeout", name, role);
                
                let _ = conn.execute(
                    "UPDATE agents SET status = 'error' WHERE id = ?1",
                    [&id]
                );
                
                let _ = conn.execute(
                    "INSERT INTO events (event_type, agent_id, payload) 
                     VALUES ('run_crashed', ?1, ?2)",
                    rusqlite::params![id, format!("{{\"error\":\"Heartbeat timed out. Agent {} crashed.\"}}", name)]
                );
                
                emit_event(
                    &app_handle,
                    AppEvent {
                        event_type: "agent_run_status".to_string(),
                        agent_id: Some(id.clone()),
                        task_id: None,
                        payload: serde_json::json!({ "status": "error", "error": "Heartbeat timed out." }),
                    }
                );
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
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}
