use std::time::{SystemTime, UNIX_EPOCH, Duration};
use tauri::{AppHandle, Manager};
use crate::storage::DbState;
use crate::event_bus::{emit_event, AppEvent};

pub fn start_watchdog(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            
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
