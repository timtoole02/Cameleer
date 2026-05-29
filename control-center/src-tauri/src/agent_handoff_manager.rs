use rusqlite::{params, Connection, Result, OptionalExtension};
use crate::event_bus::{emit_event, AppEvent};
use tauri::AppHandle;

pub fn execute_handoff(
    app_handle: &AppHandle,
    conn: &Connection,
    card_id: &str,
    current_agent_id: &str,
    target_agent_id: &str,
    notes: &str,
) -> Result<(), String> {

    // 1. Verify target agent exists
    let target_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM agents WHERE id = ?1)",
        [target_agent_id],
        |row| row.get(0),
    ).unwrap_or(false);

    if !target_exists {
        return Err(format!("Target agent {} does not exist", target_agent_id));
    }

    // 2. Load card details
    let (title, old_assignee): (String, Option<String>) = conn.query_row(
        "SELECT title, assigned_agent_id FROM kanban_cards WHERE id = ?1",
        [card_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| e.to_string())?;

    if old_assignee.as_deref() != Some(current_agent_id) {
        return Err("You are not assigned to this card".to_string());
    }

    // 3. Execute the handoff
    let handoff_note = format!("\n--- Handoff from {} to {} ---\nNotes: {}", current_agent_id, target_agent_id, notes);
    
    conn.execute(
        "UPDATE kanban_cards 
         SET assigned_agent_id = ?1, status = 'Ready', comments = comments || ?2
         WHERE id = ?3",
        params![target_agent_id, handoff_note, card_id],
    ).map_err(|e| e.to_string())?;

    // 4. Inject system message into target agent's session
    let target_session_id = format!("task_{}", card_id);
    let sys_msg = format!("Task '{}' has been handed off to you by {}.\nNotes: {}", title, current_agent_id, notes);
    
    let _ = conn.execute(
        "INSERT INTO messages (session_id, role, sender_id, content) VALUES (?1, 'system', 'handoff_manager', ?2)",
        params![target_session_id, sys_msg],
    );

    // 5. Emit event to UI
    emit_event(
        app_handle,
        AppEvent {
            event_type: "agent_handoff".to_string(),
            agent_id: Some(target_agent_id.to_string()),
            task_id: Some(card_id.to_string()),
            payload: serde_json::json!({
                "from": current_agent_id,
                "to": target_agent_id,
                "card": card_id,
                "notes": notes,
            }),
        },
    );

    Ok(())
}
