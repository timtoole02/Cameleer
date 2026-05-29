use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Result};
use tauri::{State, AppHandle};
use crate::storage::DbState;
use crate::event_bus::{emit_event, AppEvent};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub owner_id: Option<String>,
    pub status: String,
    pub priority: String,
    pub parent_id: Option<String>,
    pub evidence_path: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskBlocker {
    pub id: Option<i32>,
    pub task_id: String,
    pub blocked_by_task_id: String,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Artifact {
    pub id: Option<i32>,
    pub task_id: Option<String>,
    pub path: String,
    pub artifact_type: String,
    pub size_bytes: Option<i32>,
    pub created_at: Option<String>,
}

#[tauri::command]
pub fn get_tasks(state: State<'_, DbState>) -> Result<Vec<Task>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, description, owner_id, status, priority, parent_id, evidence_path, created_at, updated_at 
             FROM tasks",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                title: row.get(1)?,
                description: row.get(2)?,
                owner_id: row.get(3)?,
                status: row.get(4)?,
                priority: row.get(5)?,
                parent_id: row.get(6)?,
                evidence_path: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for task in iter {
        tasks.push(task.map_err(|e| e.to_string())?);
    }
    Ok(tasks)
}

#[tauri::command]
pub fn create_task(state: State<'_, DbState>, app_handle: AppHandle, task: Task) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO tasks (id, title, description, owner_id, status, priority, parent_id, evidence_path)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            task.id,
            task.title,
            task.description,
            task.owner_id,
            task.status,
            task.priority,
            task.parent_id,
            task.evidence_path,
        ],
    )
    .map_err(|e| e.to_string())?;

    // Log the event
    conn.execute(
        "INSERT INTO events (event_type, agent_id, task_id, payload) VALUES ('task_created', ?1, ?2, '{}')",
        params![task.owner_id, task.id],
    )
    .map_err(|e| e.to_string())?;

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "task_updated".to_string(),
            agent_id: task.owner_id.clone(),
            task_id: Some(task.id.clone()),
            payload: serde_json::to_value(&task).unwrap_or(serde_json::Value::Null),
        },
    );

    Ok(())
}

#[tauri::command]
pub fn update_task_status(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    id: String,
    status: String,
    evidence_path: Option<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    if let Some(ref path) = evidence_path {
        conn.execute(
            "UPDATE tasks SET status = ?2, evidence_path = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![id, status, path],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE tasks SET status = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![id, status],
        )
        .map_err(|e| e.to_string())?;
    }

    // Get owner
    let owner_id: Option<String> = conn
        .query_row(
            "SELECT owner_id FROM tasks WHERE id = ?1",
            [&id],
            |row| row.get(0),
        )
        .unwrap_or(None);

    // Add event log
    conn.execute(
        "INSERT INTO events (event_type, agent_id, task_id, payload) 
         VALUES ('task_status_changed', ?1, ?2, ?3)",
        params![
            owner_id,
            id,
            format!("{{\"status\":\"{}\"}}", status)
        ],
    )
    .map_err(|e| e.to_string())?;

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "task_updated".to_string(),
            agent_id: owner_id,
            task_id: Some(id.clone()),
            payload: serde_json::json!({ "id": id, "status": status, "evidence_path": evidence_path }),
        },
    );

    Ok(())
}

#[tauri::command]
pub fn create_task_blocker(
    state: State<'_, DbState>,
    task_id: String,
    blocked_by_task_id: String,
    reason: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO task_blockers (task_id, blocked_by_task_id, reason) VALUES (?1, ?2, ?3)",
        params![task_id, blocked_by_task_id, reason],
    )
    .map_err(|e| e.to_string())?;

    // Set task status to blocked
    conn.execute(
        "UPDATE tasks SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        [task_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn register_artifact(
    state: State<'_, DbState>,
    task_id: Option<String>,
    path: String,
    artifact_type: String,
    size_bytes: Option<i32>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO artifacts (task_id, path, artifact_type, size_bytes) VALUES (?1, ?2, ?3, ?4)",
        params![task_id, path, artifact_type, size_bytes],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_artifacts(state: State<'_, DbState>) -> Result<Vec<Artifact>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, task_id, path, artifact_type, size_bytes, created_at FROM artifacts")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(Artifact {
                id: Some(row.get(0)?),
                task_id: row.get(1)?,
                path: row.get(2)?,
                artifact_type: row.get(3)?,
                size_bytes: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut artifacts = Vec::new();
    for art in iter {
        artifacts.push(art.map_err(|e| e.to_string())?);
    }
    Ok(artifacts)
}

#[tauri::command]
pub fn read_artifact_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
