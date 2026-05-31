use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use crate::storage::DbState;
use crate::event_bus::{emit_event, AppEvent};
use tauri::{State, AppHandle};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendingApproval {
    pub task_id: String,
    pub agent_id: String,
    pub command: String,
    pub reason: String,
    pub timestamp: u64,
}

pub enum GuardResult {
    Allowed,
    Suspended(String),
}

pub fn check_command(
    state: &State<'_, DbState>,
    agent_id: &str,
    task_id: &str,
    command: &str,
) -> Result<GuardResult, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 1. Fetch agent safety settings
    let (safety_profile, command_permissions_str): (String, Option<String>) = conn
        .query_row(
            "SELECT safety_profile, command_permissions FROM agents WHERE id = ?1",
            [agent_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or_else(|_| ("moderate".to_string(), None));

    // 2. Check if this exact command has already been approved
    let cmd_clean = command.trim();
    let approved_key = format!("approved_command:{}:{}", task_id, cmd_clean);
    let is_approved: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM shared_state WHERE key = ?1)",
            [approved_key],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if is_approved {
        return Ok(GuardResult::Allowed);
    }

    // 3. Analyze command safety
    let first_token = cmd_clean
        .split_whitespace()
        .next()
        .unwrap_or("")
        .to_lowercase();

    // Dangerous shell commands
    let risky_commands = vec![
        "rm", "sudo", "chmod", "chown", "mv", "rmdir", "curl", "wget", "dd", "mkfs", "shutdown", "reboot", "ssh", "scp",
    ];

    let is_risky = risky_commands.contains(&first_token.as_str()) || cmd_clean.contains(" > ") || cmd_clean.contains(" >> ");

    // Verify whitelists
    let whitelist: Vec<String> = if let Some(ref wl_str) = command_permissions_str {
        serde_json::from_str(wl_str).unwrap_or_default()
    } else {
        Vec::new()
    };

    let outside_whitelist = !whitelist.is_empty() && !whitelist.contains(&first_token);

    let mut suspend_reason = None;

    if safety_profile == "strict" {
        // Strict: only allow standard non-mutating search/read tools
        let strictly_safe = vec!["ls", "cat", "grep", "pwd", "git"];
        if !strictly_safe.contains(&first_token.as_str()) || is_risky {
            suspend_reason = Some(format!("Strict Safety Profile blocks execution of command binary '{}'.", first_token));
        }
    } else if safety_profile == "moderate" {
        // Moderate: allow building and searching but block mutating actions
        if is_risky {
            suspend_reason = Some(format!("Moderate Safety Profile blocks risky shell execution for binary '{}'.", first_token));
        } else if outside_whitelist && !vec!["ls", "cat", "grep", "pwd"].contains(&first_token.as_str()) {
            suspend_reason = Some(format!("Command binary '{}' is outside the agent's whitelisted command permissions.", first_token));
        }
    } else {
        // Loose: only block recursive delete
        if first_token == "rm" && (cmd_clean.contains("-rf") || cmd_clean.contains("-r")) {
            suspend_reason = Some("Loose Safety Profile blocks dangerous recursive directory deletion.".to_string());
        }
    }

    if let Some(reason) = suspend_reason {
        drop(conn); // Release DB lock before executing inserts in helper
        suspend_execution(state, agent_id, task_id, cmd_clean, &reason)?;
        return Ok(GuardResult::Suspended(reason));
    }

    Ok(GuardResult::Allowed)
}

fn suspend_execution(
    state: &State<'_, DbState>,
    agent_id: &str,
    task_id: &str,
    command: &str,
    reason: &str,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let approval = PendingApproval {
        task_id: task_id.to_string(),
        agent_id: agent_id.to_string(),
        command: command.to_string(),
        reason: reason.to_string(),
        timestamp: now,
    };

    let approval_str = serde_json::to_string(&approval).unwrap_or_default();

    // 1. Store pending approval in shared_state
    conn.execute(
        "INSERT OR REPLACE INTO shared_state (key, value) VALUES (?1, ?2)",
        [format!("pending_command_approval:{}", task_id), approval_str],
    )
    .map_err(|e| e.to_string())?;

    // 2. Set task status to 'waiting_for_approval'
    let log_str: Option<String> = conn
        .query_row(
            "SELECT activity_log FROM kanban_cards WHERE id = ?1",
            [task_id],
            |row| row.get(0),
        )
        .unwrap_or(None);

    let mut log_arr = match log_str {
        Some(ref s) if !s.trim().is_empty() => serde_json::from_str::<Vec<serde_json::Value>>(s).unwrap_or_default(),
        _ => Vec::new(),
    };

    log_arr.push(serde_json::json!({
        "timestamp": now,
        "agent_id": agent_id,
        "action": "kanban_card_paused_approval",
        "detail": format!("Command paused for human review: {}. Reason: {}", command, reason)
    }));
    let new_log_str = serde_json::to_string(&log_arr).unwrap_or_default();

    conn.execute(
        "UPDATE kanban_cards SET status = 'waiting_for_approval', activity_log = ?2 WHERE id = ?1",
        params![task_id, new_log_str],
    )
    .map_err(|e| e.to_string())?;

    // Update agent status to reflect waiting for tool
    conn.execute(
        "UPDATE agents SET status = 'waiting_for_tool' WHERE id = ?1",
        [agent_id],
    )
    .map_err(|e| e.to_string())?;

    // 3. Log event
    conn.execute(
        "INSERT INTO events (event_type, agent_id, task_id, payload) VALUES ('command_approval_paused', ?1, ?2, ?3)",
        params![agent_id, task_id, format!("{{\"command\":\"{}\",\"reason\":\"{}\"}}", command, reason)],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn get_pending_command_approval(
    state: State<'_, DbState>,
    task_id: String,
) -> Result<Option<PendingApproval>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let key = format!("pending_command_approval:{}", task_id);

    let val: Option<String> = conn
        .query_row(
            "SELECT value FROM shared_state WHERE key = ?1",
            [key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(s) = val {
        let approval: PendingApproval = serde_json::from_str(&s).map_err(|e| e.to_string())?;
        Ok(Some(approval))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn resolve_command_approval(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    task_id: String,
    approved: bool,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let pending_key = format!("pending_command_approval:{}", task_id);

    let val: Option<String> = conn
        .query_row(
            "SELECT value FROM shared_state WHERE key = ?1",
            [&pending_key],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let approval_data = match val {
        Some(s) => s,
        None => return Err("No pending command approval found for this task.".to_string()),
    };

    let approval: PendingApproval = serde_json::from_str(&approval_data).map_err(|e| e.to_string())?;

    // Delete pending record
    conn.execute("DELETE FROM shared_state WHERE key = ?1", [&pending_key])
        .map_err(|e| e.to_string())?;

    if approved {
        // 1. Mark command as approved
        let approved_key = format!("approved_command:{}:{}", task_id, approval.command.trim());
        conn.execute(
            "INSERT OR REPLACE INTO shared_state (key, value) VALUES (?1, 'approved')",
            [approved_key, "approved".to_string()],
        )
        .map_err(|e| e.to_string())?;

        // 2. Set task status back to 'in_progress'
        conn.execute(
            "UPDATE kanban_cards SET status = 'in_progress' WHERE id = ?1",
            [&task_id],
        )
        .map_err(|e| e.to_string())?;

        // 3. Log event
        conn.execute(
            "INSERT INTO events (event_type, agent_id, task_id, payload) VALUES ('command_approved', ?1, ?2, '{}')",
            params![approval.agent_id, task_id],
        )
        .map_err(|e| e.to_string())?;

        emit_event(
            &app_handle,
            AppEvent {
                event_type: "task_updated".to_string(),
                agent_id: Some(approval.agent_id.clone()),
                task_id: Some(task_id.clone()),
                payload: serde_json::json!({ "status": "in_progress" }),
            },
        );

        // 4. Set agent back to working
        conn.execute(
            "UPDATE agents SET status = 'working' WHERE id = ?1",
            [approval.agent_id.clone()],
        )
        .map_err(|e| e.to_string())?;
    } else {
        // Rejected: set task status back to 'ready'
        conn.execute(
            "UPDATE kanban_cards SET status = 'ready' WHERE id = ?1",
            [&task_id],
        )
        .map_err(|e| e.to_string())?;

        // Set agent back to idle
        conn.execute(
            "UPDATE agents SET status = 'idle' WHERE id = ?1",
            [approval.agent_id.clone()],
        )
        .map_err(|e| e.to_string())?;

        // Log event
        conn.execute(
            "INSERT INTO events (event_type, agent_id, task_id, payload) VALUES ('command_rejected', ?1, ?2, '{}')",
            params![approval.agent_id, task_id],
        )
        .map_err(|e| e.to_string())?;

        emit_event(
            &app_handle,
            AppEvent {
                event_type: "task_updated".to_string(),
                agent_id: None,
                task_id: Some(task_id.clone()),
                payload: serde_json::json!({ "status": "ready" }),
            },
        );
    }

    Ok(())
}
