use crate::agent_state_machine::{transition_agent_state, AgentState};
use crate::checkpoint_store::get_latest_checkpoint;
use crate::event_bus::{emit_event, AppEvent};
use crate::storage::DbState;
use rusqlite::params;
use tauri::{AppHandle, Manager};

pub async fn attempt_recovery(app_handle: AppHandle, agent_id: String) -> Result<(), String> {
    println!(
        "[RECOVERY ENGINE] Attempting to recover agent: {}",
        agent_id
    );

    let state = app_handle.state::<DbState>();

    // 1. Identify active task for this agent to find its session/checkpoint
    let mut task_id = String::new();
    let mut session_id = format!("session_{}", agent_id); // Fallback

    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        if let Ok(tid) = conn.query_row(
            "SELECT id FROM kanban_cards WHERE assigned_agent_id = ?1 AND (status = 'in_progress' OR status = 'In Progress') LIMIT 1",
            [&agent_id],
            |row| row.get::<_, String>(0)
        ) {
            task_id = tid.clone();
            session_id = format!("task_{}", tid);
        }
    }

    // 2. Load latest checkpoint
    let checkpoint =
        get_latest_checkpoint(state.clone(), agent_id.clone(), task_id.clone()).unwrap_or(None);

    let mut recovery_msg = String::new();

    if let Some(cp) = checkpoint {
        println!(
            "[RECOVERY ENGINE] Found checkpoint {} for agent {}",
            cp.id.unwrap_or(0),
            agent_id
        );
        recovery_msg = format!(
            "⚠️ SYSTEM RECOVERY WARNING ⚠️\n\
             Your process crashed, timed out, or entered an invalid state.\n\
             Last Checkpoint Details:\n\
             - Completed Steps: {}\n\
             - Open Steps: {}\n\
             - Last Reasoning: {}\n\
             - Files Touched: {}\n\n\
             Please evaluate your last action. If a tool failed or caused a timeout, DO NOT repeat the exact same action. Adjust your approach.",
            cp.completed_steps, cp.open_steps, cp.reasoning_summary, cp.files_touched
        );
    } else {
        println!(
            "[RECOVERY ENGINE] No checkpoint found for agent {}. Initiating cold recovery.",
            agent_id
        );
        recovery_msg = "⚠️ SYSTEM RECOVERY WARNING ⚠️\n\
             Your process crashed or timed out. No checkpoint was found. Please restart your task from the beginning and avoid the previous action that caused the crash.".to_string();
    }

    // 3. Inject recovery message
    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let _ = conn.execute(
            "INSERT INTO messages (session_id, role, sender_id, content) VALUES (?1, 'system', 'supervisor', ?2)",
            params![session_id, recovery_msg],
        );
    }

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "agent_run_status".to_string(),
            agent_id: Some(agent_id.clone()),
            task_id: if task_id.is_empty() {
                None
            } else {
                Some(task_id.clone())
            },
            payload: serde_json::json!({ "status": "recovering", "message": recovery_msg }),
        },
    );

    // 4. Reset state to Idle so the runtime kernel can pull it again
    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let _ = transition_agent_state(
            &conn,
            &agent_id,
            AgentState::Recovering,
            AgentState::Idle,
            "Recovery engine rebooting agent",
        );
    }

    println!(
        "[RECOVERY ENGINE] Agent {} recovery sequence completed. Set to Idle.",
        agent_id
    );

    Ok(())
}
