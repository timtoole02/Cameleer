use rusqlite::Connection;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
pub fn get_blackboard_awareness(state: tauri::State<'_, crate::storage::DbState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    // 1. Fetch Shared World Summary
    let mut stmt_shared = conn.prepare("SELECT key, value FROM shared_state").map_err(|e| e.to_string())?;
    let shared_iter = stmt_shared.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    }).map_err(|e| e.to_string())?;
    
    let mut shared_summary = String::new();
    for item in shared_iter {
        if let Ok((k, v)) = item {
            shared_summary.push_str(&format!("- {}: {}\n", k, v));
        }
    }
    if shared_summary.is_empty() {
        shared_summary = "- No global goals registered yet.".to_string();
    }

    // 2. Fetch Active Agents & Statuses
    let mut stmt_agents = conn.prepare(
        "SELECT id, name, role, status, last_heartbeat FROM agents"
    ).map_err(|e| e.to_string())?;
    let agents_iter = stmt_agents.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
        ))
    }).map_err(|e| e.to_string())?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();

    let mut agents_summary = String::new();
    for agent in agents_iter {
        if let Ok((id, name, role, status, hb)) = agent {
            let hb_str = if let Some(h_val) = hb {
                if let Ok(secs) = h_val.parse::<u64>() {
                    format!("{}s ago", now.saturating_sub(secs))
                } else {
                    "never".to_string()
                }
            } else {
                "never".to_string()
            };
            agents_summary.push_str(&format!("- {} ({}): status=[{}], heartbeat=[{}]\n", name, role, status, hb_str));
        }
    }

    // 3. Fetch Tasks
    let mut stmt_tasks = conn.prepare(
        "SELECT title, owner_id, status FROM tasks LIMIT 5"
    ).map_err(|e| e.to_string())?;
    let tasks_iter = stmt_tasks.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, String>(2)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut tasks_summary = String::new();
    for task in tasks_iter {
        if let Ok((title, owner, status)) = task {
            let owner_str = owner.unwrap_or_else(|| "unassigned".to_string());
            tasks_summary.push_str(&format!("- Task: \"{}\" | owner=[{}] | status=[{}]\n", title, owner_str, status));
        }
    }
    if tasks_summary.is_empty() {
        tasks_summary = "- No tasks registered yet.".to_string();
    }

    // 4. Fetch Recent Events
    let mut stmt_events = conn.prepare(
        "SELECT event_type, agent_id, timestamp FROM events ORDER BY id DESC LIMIT 5"
    ).map_err(|e| e.to_string())?;
    let events_iter = stmt_events.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, String>(2)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut events_summary = String::new();
    for ev in events_iter {
        if let Ok((ev_type, agent, time)) = ev {
            let agent_str = agent.unwrap_or_else(|| "system".to_string());
            events_summary.push_str(&format!("- [{}] Agent {}: {}\n", time, agent_str, ev_type));
        }
    }
    if events_summary.is_empty() {
        events_summary = "- No events logged yet.".to_string();
    }

    let blackboard = format!(
        "### BLACKBOARD SHARED WORLD AWARENESS\n\n\
         #### PROJECT OBJECTIVE SUMMARY:\n{}\n\n\
         #### ACTIVE AGENTS & STATUSES:\n{}\n\n\
         #### RECENT WORKSPACE TASKS:\n{}\n\n\
         #### RECENT EVENTS:\n{}\n",
        shared_summary, agents_summary, tasks_summary, events_summary
    );

    Ok(blackboard)
}

#[tauri::command]
pub fn update_shared_state(
    state: tauri::State<'_, crate::storage::DbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO shared_state (key, value, updated_at) 
         VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = CURRENT_TIMESTAMP",
        [key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
