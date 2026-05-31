use crate::event_bus::{emit_event, AppEvent};
use rusqlite::{params, Connection, OptionalExtension, Result};
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
    let target_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM agents WHERE id = ?1)",
            [target_agent_id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !target_exists {
        return Err(format!("Target agent {} does not exist", target_agent_id));
    }

    // 2. Load card details
    let (title, old_assignee): (String, Option<String>) = conn
        .query_row(
            "SELECT title, assigned_agent_id FROM kanban_cards WHERE id = ?1",
            [card_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| e.to_string())?;

    if old_assignee.as_deref() != Some(current_agent_id) {
        return Err("You are not assigned to this card".to_string());
    }

    // 3. Fetch Context Package (Last 5 steps of the current agent on this task)
    let run_id_opt: Option<String> = conn.query_row(
        "SELECT id FROM agent_runs WHERE agent_id = ?1 AND task_id = ?2 ORDER BY created_at DESC LIMIT 1",
        [current_agent_id, card_id],
        |row| row.get(0),
    ).optional().unwrap_or(None);

    let mut context_package = String::new();
    if let Some(run_id) = run_id_opt {
        let mut stmt = conn.prepare("SELECT step_type, content FROM agent_run_steps WHERE run_id = ?1 ORDER BY created_at DESC LIMIT 5").unwrap();
        let step_iter = stmt
            .query_map([run_id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .unwrap();

        let mut steps = Vec::new();
        for step in step_iter {
            if let Ok((stype, scontent)) = step {
                steps.push(format!("[{}] {}", stype, scontent));
            }
        }
        steps.reverse(); // Chronological order

        if !steps.is_empty() {
            context_package.push_str("\n\n--- Previous Agent's Recent Context ---\n");
            context_package.push_str(&steps.join("\n"));
        }
    }

    // 4. Execute the handoff
    let handoff_note = format!(
        "\n--- Handoff from {} to {} ---\nNotes: {}",
        current_agent_id, target_agent_id, notes
    );

    conn.execute(
        "UPDATE kanban_cards 
         SET assigned_agent_id = ?1, status = 'Ready', comments = comments || ?2
         WHERE id = ?3",
        params![target_agent_id, handoff_note, card_id],
    )
    .map_err(|e| e.to_string())?;

    // 5. Inject system message into target agent's session
    let target_session_id = format!("task_{}", card_id);
    let sys_msg = format!(
        "Task '{}' has been handed off to you by {}.\nNotes: {}{}",
        title, current_agent_id, notes, context_package
    );

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
