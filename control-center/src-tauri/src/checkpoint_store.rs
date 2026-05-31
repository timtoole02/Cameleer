use crate::storage::DbState;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Checkpoint {
    pub id: Option<i32>,
    pub agent_id: String,
    pub task_id: String,
    pub plan: String,            // JSON list of steps
    pub completed_steps: String, // JSON list of completed steps
    pub open_steps: String,      // JSON list of remaining steps
    pub files_touched: String,   // JSON list of paths modified
    pub reasoning_summary: String,
    pub last_tool_output: String,
    pub validation_status: String,
    pub timestamp: Option<String>,
}

#[tauri::command]
pub fn save_agent_checkpoint(
    state: State<'_, DbState>,
    checkpoint: Checkpoint,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO checkpoints (agent_id, task_id, plan, completed_steps, open_steps, files_touched, reasoning_summary, last_tool_output, validation_status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            checkpoint.agent_id,
            checkpoint.task_id,
            checkpoint.plan,
            checkpoint.completed_steps,
            checkpoint.open_steps,
            checkpoint.files_touched,
            checkpoint.reasoning_summary,
            checkpoint.last_tool_output,
            checkpoint.validation_status,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_latest_checkpoint(
    state: State<'_, DbState>,
    agent_id: String,
    task_id: String,
) -> Result<Option<Checkpoint>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let checkpoint = conn.query_row(
        "SELECT id, agent_id, task_id, plan, completed_steps, open_steps, files_touched, reasoning_summary, last_tool_output, validation_status, timestamp
         FROM checkpoints
         WHERE agent_id = ?1 AND task_id = ?2
         ORDER BY id DESC LIMIT 1",
        params![agent_id, task_id],
        |row| {
            Ok(Checkpoint {
                id: Some(row.get(0)?),
                agent_id: row.get(1)?,
                task_id: row.get(2)?,
                plan: row.get(3)?,
                completed_steps: row.get(4)?,
                open_steps: row.get(5)?,
                files_touched: row.get(6)?,
                reasoning_summary: row.get(7)?,
                last_tool_output: row.get(8)?,
                validation_status: row.get(9)?,
                timestamp: Some(row.get(10)?),
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())?;

    Ok(checkpoint)
}
