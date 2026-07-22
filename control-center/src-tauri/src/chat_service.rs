use crate::event_bus::{emit_event, AppEvent};
use crate::router::{call_model, ChatMessage, ModelSettings};
use crate::storage::DbState;
use crate::system_services::{inspect_database_health, probe_camelid};
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DbMessage {
    pub id: Option<i32>,
    pub session_id: String,
    pub role: String,
    pub sender_id: Option<String>,
    pub content: String,
    pub timestamp: String,
}

#[tauri::command]
pub fn get_messages(
    state: State<'_, DbState>,
    session_id: String,
) -> Result<Vec<DbMessage>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, session_id, role, sender_id, content, timestamp 
             FROM messages 
             WHERE session_id = ?1 
             ORDER BY timestamp ASC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([session_id], |row| {
            Ok(DbMessage {
                id: Some(row.get(0)?),
                session_id: row.get(1)?,
                role: row.get(2)?,
                sender_id: row.get(3)?,
                content: row.get(4)?,
                timestamp: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut messages = Vec::new();
    for msg in iter {
        messages.push(msg.map_err(|e| e.to_string())?);
    }
    Ok(messages)
}

#[tauri::command]
pub fn save_message(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    session_id: String,
    role: String,
    sender_id: Option<String>,
    content: String,
) -> Result<DbMessage, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO messages (session_id, role, sender_id, content) 
         VALUES (?1, ?2, ?3, ?4)",
        params![session_id, role, sender_id, content],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid() as i32;

    let timestamp: String = conn
        .query_row(
            "SELECT timestamp FROM messages WHERE id = ?1",
            [id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let db_msg = DbMessage {
        id: Some(id),
        session_id: session_id.clone(),
        role: role.clone(),
        sender_id: sender_id.clone(),
        content: content.clone(),
        timestamp,
    };

    // Emit event so the UI updates instantly
    emit_event(
        &app_handle,
        AppEvent {
            event_type: "message".to_string(),
            agent_id: sender_id,
            task_id: None,
            payload: serde_json::to_value(&db_msg).unwrap_or(serde_json::Value::Null),
        },
    );

    Ok(db_msg)
}

#[tauri::command]
pub async fn trigger_agent_reply(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    agent_id: String,
    session_id: String,
) -> Result<(), String> {
    let (database_status, camelid_endpoint) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let db_health = inspect_database_health(
            &conn,
            crate::storage::get_db_path().display().to_string(),
            2,
        );
        (db_health.database_status, db_health.camelid_endpoint)
    };

    if database_status != "ready" {
        return Err(format!(
            "Chat disabled: Database is not ready (Status: {}).",
            database_status
        ));
    }

    let camelid_health = probe_camelid(&camelid_endpoint).await;
    if let Some(reason) = chat_send_block_reason(
        &database_status,
        &camelid_health.status,
        camelid_health.model_loaded.as_deref(),
        &camelid_endpoint,
    ) {
        return Err(reason);
    }

    let history = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT role, content FROM messages
                 WHERE session_id = ?1 AND role IN ('user', 'assistant')
                 ORDER BY timestamp ASC, id ASC
                 LIMIT 24",
            )
            .map_err(|e| e.to_string())?;
        let iter = stmt
            .query_map([&session_id], |row| {
                Ok(ChatMessage {
                    role: row.get(0)?,
                    content: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut messages = Vec::new();
        for msg in iter {
            messages.push(msg.map_err(|e| e.to_string())?);
        }
        messages
    };

    if history.is_empty() {
        return Err("Chat disabled: No user message is available to send.".to_string());
    }

    let chat_endpoint = format!(
        "{}/v1/chat/completions",
        camelid_endpoint.trim_end_matches('/')
    );
    let response_text = call_model(
        "camelid",
        camelid_health.model_loaded.as_deref().unwrap_or("camelid"),
        history,
        ModelSettings {
            temperature: Some(0.7),
            max_tokens: Some(32),
        },
        None,
        Some(chat_endpoint),
    )
    .await?;

    save_assistant_message(
        &state,
        &app_handle,
        &session_id,
        &agent_id,
        response_text.trim(),
    )
}

fn save_assistant_message(
    state: &State<'_, DbState>,
    app_handle: &AppHandle,
    session_id: &str,
    agent_id: &str,
    content: &str,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO messages (session_id, role, sender_id, content)
         VALUES (?1, 'assistant', ?2, ?3)",
        params![session_id, agent_id, content],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid() as i32;
    let timestamp: String = conn
        .query_row(
            "SELECT timestamp FROM messages WHERE id = ?1",
            [id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let db_msg = DbMessage {
        id: Some(id),
        session_id: session_id.to_string(),
        role: "assistant".to_string(),
        sender_id: Some(agent_id.to_string()),
        content: content.to_string(),
        timestamp,
    };

    emit_event(
        app_handle,
        AppEvent {
            event_type: "message".to_string(),
            agent_id: Some(agent_id.to_string()),
            task_id: None,
            payload: serde_json::to_value(&db_msg).unwrap_or(serde_json::Value::Null),
        },
    );

    Ok(())
}

pub fn chat_send_block_reason(
    database_status: &str,
    camelid_status: &str,
    camelid_model: Option<&str>,
    camelid_endpoint: &str,
) -> Option<String> {
    if database_status != "ready" {
        return Some(format!(
            "Chat disabled: Database is not ready (Status: {}).",
            database_status
        ));
    }
    if camelid_status != "connected" {
        return Some(format!(
            "Chat disabled: Camelid is offline at {}.",
            camelid_endpoint
        ));
    }
    if camelid_model.is_none() {
        return Some("Chat disabled: No model is loaded.".to_string());
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chat_send_blocks_when_camelid_offline() {
        let reason = chat_send_block_reason("ready", "offline", None, "http://127.0.0.1:8181");

        assert_eq!(
            reason.as_deref(),
            Some("Chat disabled: Camelid is offline at http://127.0.0.1:8181.")
        );
    }

    #[test]
    fn chat_send_blocks_when_database_not_ready() {
        let reason = chat_send_block_reason(
            "schema_error",
            "connected",
            Some("camelid-default"),
            "http://127.0.0.1:8181",
        );

        assert_eq!(
            reason.as_deref(),
            Some("Chat disabled: Database is not ready (Status: schema_error).")
        );
    }

    #[test]
    fn chat_send_blocks_when_model_missing() {
        let reason = chat_send_block_reason("ready", "connected", None, "http://127.0.0.1:8181");

        assert_eq!(
            reason.as_deref(),
            Some("Chat disabled: No model is loaded.")
        );
    }
}

#[tauri::command]
pub async fn trigger_org_reply(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    org_node_type: String,
    org_node_id: String,
    session_id: String,
) -> Result<(), String> {
    let lead_agent_id_opt: Option<String> = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        if org_node_type == "team" {
            conn.query_row(
                "SELECT lead_agent_id FROM teams WHERE id = ?1",
                [&org_node_id],
                |row| row.get(0),
            )
            .ok()
            .flatten()
        } else if org_node_type == "project" {
            conn.query_row(
                "SELECT owner_agent_id FROM projects WHERE id = ?1",
                [&org_node_id],
                |row| row.get(0),
            )
            .ok()
            .flatten()
        } else {
            None
        }
    };

    if let Some(lead_agent_id) = lead_agent_id_opt {
        crate::agent_runtime_kernel::run_agent_cycle(lead_agent_id, session_id, app_handle).await
    } else {
        // No lead agent to route to, do nothing
        Ok(())
    }
}

#[allow(dead_code)] // unwired; reconciled in HARDPAN G5
fn get_blackboard_context(conn: &Connection) -> Result<String, rusqlite::Error> {
    // Shared objective
    let shared_obj: String = conn
        .query_row(
            "SELECT value FROM shared_state WHERE key = 'objective'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "None".to_string());

    // Active crew
    let mut stmt = conn.prepare("SELECT name, role, status FROM agents")?;
    let agent_iter = stmt.query_map([], |row| {
        Ok(format!(
            "- {} ({}): [{}]",
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?
        ))
    })?;

    let mut agents = Vec::new();
    for a in agent_iter.flatten() {
        agents.push(a);
    }

    // Latest tasks
    let mut stmt_tasks = conn.prepare("SELECT title, status FROM kanban_cards LIMIT 3")?;
    let task_iter = stmt_tasks.query_map([], |row| {
        Ok(format!(
            "- Task: \"{}\" | [{}]",
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?
        ))
    })?;

    let mut tasks = Vec::new();
    for t in task_iter.flatten() {
        tasks.push(t);
    }

    let blackboard = format!(
        "### SHARED WORLD AWARENESS BLACKBOARD:\n\
         - Shared Global Goal: {}\n\n\
         Active crew status:\n{}\n\n\
         Recent task objectives:\n{}",
        shared_obj,
        agents.join("\n"),
        tasks.join("\n")
    );

    Ok(blackboard)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentJsonOutput {
    pub summary: String,
    pub plan: Vec<String>,
    pub next_action: AgentNextAction,
    pub confidence: f64,
    pub blockers: Vec<String>,
    pub done_criteria: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentNextAction {
    #[serde(rename = "type")]
    pub action_type: String,
    pub target: Option<String>,
    pub input: String,
    pub dry_run: Option<bool>,
}

#[allow(dead_code)] // unwired; reconciled in HARDPAN G5
pub struct AgentAction {
    pub action_type: String,
    pub command: Option<String>,
    pub path: Option<String>,
    pub content: Option<String>,
    pub decision: Option<String>,
    pub reason: Option<String>,
    pub target_agent_id: Option<String>,
    pub task_id: Option<String>,
    pub blocked_by_task_id: Option<String>,
    pub card_id: Option<String>,
    pub notes: Option<String>,
    pub files: Option<Vec<String>>,
    pub validation_status: Option<String>,
    pub evidence: Option<String>,
    pub validation_passed: Option<bool>,
    pub validation_notes: Option<String>,
    pub raw_json: Option<AgentJsonOutput>, // Store the original parsed JSON if available

    // Memory System
    pub memory_content: Option<String>,
    pub memory_context: Option<String>,
    pub memory_importance: Option<i32>,
    pub memory_query: Option<String>,
    pub dry_run: Option<bool>,
}

#[allow(dead_code)] // unwired; reconciled in HARDPAN G5
fn resolve_path(path: &str) -> std::path::PathBuf {
    let clean_path = path.trim();
    let mut resolved = std::path::PathBuf::new();

    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());

    if let Some(rest) = clean_path.strip_prefix("~/") {
        resolved.push(&home);
        resolved.push(rest);
    } else if clean_path == "~" {
        resolved.push(&home);
    } else if clean_path.starts_with("/") {
        resolved.push(clean_path);
    } else {
        // Relative path: default to Desktop
        resolved.push(&home);
        resolved.push("Desktop");
        resolved.push(clean_path);
    }

    resolved
}

fn extract_json_from_text(text: &str) -> Option<String> {
    if let Some(start) = text.find('{') {
        if let Some(end) = text.rfind('}') {
            if end > start {
                return Some(text[start..=end].to_string());
            }
        }
    }
    None
}

fn parse_code_block_for_action(lines: &[String]) -> Option<AgentAction> {
    if lines.is_empty() {
        return None;
    }

    // Check first 3 lines
    let check_limit = std::cmp::min(lines.len(), 3);

    // 1. Check for file path patterns
    let filepath_prefixes = [
        "// filepath:",
        "// path:",
        "// save:",
        "# filepath:",
        "# path:",
        "# save:",
        "/* filepath:",
        "/* path:",
        "/* save:",
        "<!-- filepath:",
        "<!-- path:",
        "<!-- save:",
    ];

    for i in 0..check_limit {
        let line = lines[i].trim();
        for prefix in filepath_prefixes {
            if line.to_ascii_lowercase().starts_with(prefix) {
                let mut path_part = line[prefix.len()..].trim();
                // Clean up ending comments like */ or -->
                if path_part.ends_with("*/") {
                    path_part = path_part[..path_part.len() - 2].trim();
                } else if path_part.ends_with("-->") {
                    path_part = path_part[..path_part.len() - 3].trim();
                }

                // Remove surrounding quotes if any
                if ((path_part.starts_with('"') && path_part.ends_with('"'))
                    || (path_part.starts_with('\'') && path_part.ends_with('\'')))
                    && path_part.len() > 2
                {
                    path_part = &path_part[1..path_part.len() - 1];
                }

                if !path_part.is_empty() {
                    let mut content = String::new();
                    for (idx, l) in lines.iter().enumerate() {
                        if idx == i {
                            continue;
                        }
                        content.push_str(l);
                        content.push('\n');
                    }
                    return Some(AgentAction {
                        dry_run: None,
                        action_type: "write_file".to_string(),
                        command: None,
                        path: Some(path_part.to_string()),
                        content: Some(content),
                        decision: None,
                        reason: None,
                        target_agent_id: None,
                        task_id: None,
                        blocked_by_task_id: None,
                        card_id: None,
                        notes: None,
                        files: None,
                        validation_status: None,
                        evidence: None,
                        validation_passed: None,
                        validation_notes: None,
                        raw_json: None,
                        memory_content: None,
                        memory_context: None,
                        memory_importance: None,
                        memory_query: None,
                    });
                }
            }
        }
    }

    // 2. Check for execute/run patterns
    let run_prefixes = [
        "// execute:",
        "// run:",
        "# execute:",
        "# run:",
        "/* execute:",
        "/* run:",
        "<!-- execute:",
        "<!-- run:",
    ];

    #[allow(clippy::needless_range_loop)] // index-based loop mirrors panic-on-OOB semantics
    for i in 0..check_limit {
        let line = lines[i].trim();
        for prefix in run_prefixes {
            if line.to_ascii_lowercase().starts_with(prefix) {
                let mut cmd_part = line[prefix.len()..].trim();
                // Clean up ending comments like */ or -->
                if cmd_part.ends_with("*/") {
                    cmd_part = cmd_part[..cmd_part.len() - 2].trim();
                } else if cmd_part.ends_with("-->") {
                    cmd_part = cmd_part[..cmd_part.len() - 3].trim();
                }

                // Remove surrounding quotes if any
                if ((cmd_part.starts_with('"') && cmd_part.ends_with('"'))
                    || (cmd_part.starts_with('\'') && cmd_part.ends_with('\'')))
                    && cmd_part.len() > 2
                {
                    cmd_part = &cmd_part[1..cmd_part.len() - 1];
                }

                if !cmd_part.is_empty() {
                    return Some(AgentAction {
                        dry_run: None,
                        action_type: "execute_command".to_string(),
                        command: Some(cmd_part.to_string()),
                        path: None,
                        content: None,
                        decision: None,
                        reason: None,
                        target_agent_id: None,
                        task_id: None,
                        blocked_by_task_id: None,
                        card_id: None,
                        notes: None,
                        files: None,
                        validation_status: None,
                        evidence: None,
                        validation_passed: None,
                        validation_notes: None,
                        raw_json: None,
                        memory_content: None,
                        memory_context: None,
                        memory_importance: None,
                        memory_query: None,
                    });
                }
            }
        }
    }

    None
}

// justification: 15-branch prefix parser; per-field strip_prefix rewrite is risky, kept as-is
#[allow(clippy::manual_strip)]
pub fn parse_agent_action(text: &str) -> Option<AgentAction> {
    // 0. Try to parse JSON first (Epic 5 structured output)
    if let Some(json_str) = extract_json_from_text(text) {
        if let Ok(parsed_json) = serde_json::from_str::<AgentJsonOutput>(&json_str) {
            let mut action = AgentAction {
                action_type: parsed_json.next_action.action_type.clone(),
                command: None,
                path: None,
                content: Some(parsed_json.next_action.input.clone()),
                decision: None,
                reason: Some(parsed_json.summary.clone()),
                target_agent_id: None,
                task_id: parsed_json.next_action.target.clone(),
                blocked_by_task_id: None,
                card_id: parsed_json.next_action.target.clone(),
                notes: None,
                files: None,
                validation_status: None,
                evidence: None,
                validation_passed: None,
                validation_notes: None,
                raw_json: Some(parsed_json.clone()),
                memory_content: None,
                memory_context: None,
                memory_importance: None,
                memory_query: None,
                dry_run: parsed_json.next_action.dry_run,
            };

            // Map specific JSON actions back to standardized internal types
            if parsed_json.next_action.action_type == "tool_call"
                || parsed_json.next_action.action_type == "execute_command"
                || parsed_json.next_action.action_type == "command.run"
            {
                action.action_type = "command.run".to_string();
                action.command = Some(parsed_json.next_action.input.clone());
            } else if parsed_json.next_action.action_type == "write_file"
                || parsed_json.next_action.action_type == "file.write"
            {
                action.action_type = "file.write".to_string();
                action.path = parsed_json.next_action.target.clone();
                action.content = Some(parsed_json.next_action.input.clone());
            } else if parsed_json.next_action.action_type == "handoff"
                || parsed_json.next_action.action_type == "agent.handoff"
            {
                action.action_type = "agent.handoff".to_string();
                action.target_agent_id = parsed_json.next_action.target.clone();
                action.notes = Some(parsed_json.next_action.input.clone());
            } else if parsed_json.next_action.action_type == "update_task"
                || parsed_json.next_action.action_type == "task.update"
            {
                action.action_type = "task.update".to_string();
                action.notes = Some(parsed_json.next_action.input.clone());
            } else if parsed_json.next_action.action_type == "complete"
                || parsed_json.next_action.action_type == "task.complete"
            {
                action.action_type = "task.complete".to_string();
                action.evidence = Some(parsed_json.next_action.input.clone());
            } else if parsed_json.next_action.action_type == "claim_card"
                || parsed_json.next_action.action_type == "task.claim"
            {
                action.action_type = "task.claim".to_string();
                action.card_id = parsed_json.next_action.target.clone();
            } else if parsed_json.next_action.action_type == "task.create" {
                action.action_type = "task.create".to_string();
                action.notes = Some(parsed_json.next_action.input.clone()); // Assuming input contains task details
            } else if parsed_json.next_action.action_type == "repo.search" {
                action.action_type = "repo.search".to_string();
                action.command = Some(parsed_json.next_action.input.clone()); // Assuming input is search query
            } else if parsed_json.next_action.action_type == "memory.write" {
                action.action_type = "memory.write".to_string();
                action.memory_content = Some(parsed_json.next_action.input.clone());
                action.memory_context = parsed_json.next_action.target.clone(); // use target as context
                action.memory_importance = Some(1); // default
            } else if parsed_json.next_action.action_type == "memory.search" {
                action.action_type = "memory.search".to_string();
                action.memory_query = Some(parsed_json.next_action.input.clone());
            } else if parsed_json.next_action.action_type == "respond"
                || parsed_json.next_action.action_type == "message.send"
            {
                action.action_type = "message.send".to_string();
                action.content = Some(parsed_json.next_action.input.clone());
            }

            return Some(action);
        }
    }

    // 1. Try strict ReAct prefix parsing
    let mut action_type = String::new();
    let mut command = String::new();
    let mut path = String::new();
    let mut content = String::new();
    let mut decision = String::new();
    let mut reason = String::new();
    let mut target_agent_id = String::new();
    let mut task_id = String::new();
    let mut blocked_by_task_id = String::new();
    let mut card_id = String::new();
    let mut notes = String::new();
    let mut files = String::new();
    let mut validation_status = String::new();
    let mut evidence = String::new();
    let mut validation_passed = String::new();
    let mut validation_notes = String::new();
    let mut reading_content = false;

    for line in text.lines() {
        let clean = line.trim();
        if clean.starts_with("ACTION:") {
            action_type = clean[7..].trim().to_string();
        } else if clean.starts_with("COMMAND:") {
            command = clean[8..].trim().to_string();
        } else if clean.starts_with("PATH:") {
            path = clean[5..].trim().to_string();
        } else if clean.starts_with("DECISION:") {
            decision = clean[9..].trim().to_string();
        } else if clean.starts_with("REASON:") {
            reason = clean[7..].trim().to_string();
        } else if clean.starts_with("TARGET_AGENT_ID:") {
            target_agent_id = clean[16..].trim().to_string();
        } else if clean.starts_with("TASK_ID:") {
            task_id = clean[8..].trim().to_string();
        } else if clean.starts_with("BLOCKED_BY_TASK_ID:") {
            blocked_by_task_id = clean[19..].trim().to_string();
        } else if clean.starts_with("CARD_ID:") {
            card_id = clean[8..].trim().to_string();
        } else if clean.starts_with("NOTES:") {
            notes = clean[6..].trim().to_string();
        } else if clean.starts_with("FILES:") {
            files = clean[6..].trim().to_string();
        } else if clean.starts_with("VALIDATION_STATUS:") {
            validation_status = clean[18..].trim().to_string();
        } else if clean.starts_with("EVIDENCE:") {
            evidence = clean[9..].trim().to_string();
        } else if clean.starts_with("VALIDATION_PASSED:") {
            validation_passed = clean[18..].trim().to_string();
        } else if clean.starts_with("VALIDATION_NOTES:") {
            validation_notes = clean[17..].trim().to_string();
        } else if clean.starts_with("CONTENT:") {
            reading_content = true;
        } else if reading_content {
            content.push_str(line);
            content.push('\n');
        }
    }

    // Fallback task_id <-> card_id symmetry
    if card_id.is_empty() && !task_id.is_empty() {
        card_id = task_id.clone();
    }
    if task_id.is_empty() && !card_id.is_empty() {
        task_id = card_id.clone();
    }

    if !action_type.is_empty() {
        let files_vec = if files.is_empty() {
            None
        } else {
            Some(
                files
                    .split(',')
                    .map(|f| f.trim().to_string())
                    .filter(|f| !f.is_empty())
                    .collect(),
            )
        };

        let val_passed = if validation_passed.is_empty() {
            None
        } else {
            let clean_val = validation_passed.to_lowercase();
            Some(
                clean_val == "true"
                    || clean_val == "yes"
                    || clean_val == "1"
                    || clean_val == "passed",
            )
        };

        return Some(AgentAction {
            dry_run: None,
            action_type,
            command: if command.is_empty() {
                None
            } else {
                Some(command)
            },
            path: if path.is_empty() { None } else { Some(path) },
            content: if content.is_empty() {
                None
            } else {
                Some(content)
            },
            decision: if decision.is_empty() {
                None
            } else {
                Some(decision)
            },
            reason: if reason.is_empty() {
                None
            } else {
                Some(reason)
            },
            target_agent_id: if target_agent_id.is_empty() {
                None
            } else {
                Some(target_agent_id)
            },
            task_id: if task_id.is_empty() {
                None
            } else {
                Some(task_id)
            },
            blocked_by_task_id: if blocked_by_task_id.is_empty() {
                None
            } else {
                Some(blocked_by_task_id)
            },
            card_id: if card_id.is_empty() {
                None
            } else {
                Some(card_id)
            },
            notes: if notes.is_empty() { None } else { Some(notes) },
            files: files_vec,
            validation_status: if validation_status.is_empty() {
                None
            } else {
                Some(validation_status)
            },
            evidence: if evidence.is_empty() {
                None
            } else {
                Some(evidence)
            },
            validation_passed: val_passed,
            validation_notes: if validation_notes.is_empty() {
                None
            } else {
                Some(validation_notes)
            },
            raw_json: None,
            memory_content: None,
            memory_context: None,
            memory_importance: None,
            memory_query: None,
        });
    }

    // 2. Fallback: Parse markdown code blocks for filepath / run comments
    let mut in_block = false;
    let mut current_block_lines = Vec::new();

    for line in text.lines() {
        if line.trim().starts_with("```") {
            if in_block {
                // End of block: process it
                if let Some(parsed_action) = parse_code_block_for_action(&current_block_lines) {
                    return Some(parsed_action);
                }
                current_block_lines.clear();
                in_block = false;
            } else {
                in_block = true;
                current_block_lines.clear();
            }
        } else if in_block {
            current_block_lines.push(line.to_string());
        }
    }

    if in_block && !current_block_lines.is_empty() {
        if let Some(parsed_action) = parse_code_block_for_action(&current_block_lines) {
            return Some(parsed_action);
        }
    }

    None
}

#[cfg(test)]
mod parse_action_tests {
    //! Coverage for the ReAct loop's pure action-decision brain. The loop's
    //! exit/continue decisions are driven entirely by what this returns:
    //! task.complete / message.send -> exit, a tool action -> continue, and
    //! `None` (no parseable action) -> the loop finishes.
    use super::parse_agent_action;

    fn wrap(action_type: &str, target: &str, input: &str) -> String {
        let target_json = if target.is_empty() {
            "null".to_string()
        } else {
            format!("\"{target}\"")
        };
        format!(
            r#"{{"summary":"s","plan":[],"next_action":{{"type":"{action_type}","target":{target_json},"input":"{input}","dry_run":false}},"confidence":0.9,"blockers":[],"done_criteria":[]}}"#
        )
    }

    #[test]
    fn parses_task_complete_and_normalizes_alias() {
        let a = parse_agent_action(&wrap("task.complete", "", "all done")).expect("some");
        assert_eq!(a.action_type, "task.complete");
        assert_eq!(a.evidence.as_deref(), Some("all done"));
        let b = parse_agent_action(&wrap("complete", "", "done")).expect("some");
        assert_eq!(b.action_type, "task.complete");
    }

    #[test]
    fn normalizes_command_run_aliases() {
        for alias in ["command.run", "tool_call", "execute_command"] {
            let a = parse_agent_action(&wrap(alias, "", "ls -la")).expect("some");
            assert_eq!(a.action_type, "command.run", "alias {alias}");
            assert_eq!(a.command.as_deref(), Some("ls -la"));
        }
    }

    #[test]
    fn normalizes_file_write_and_sets_path() {
        let a = parse_agent_action(&wrap("write_file", "notes.txt", "hello")).expect("some");
        assert_eq!(a.action_type, "file.write");
        assert_eq!(a.path.as_deref(), Some("notes.txt"));
        assert_eq!(a.content.as_deref(), Some("hello"));
    }

    #[test]
    fn keeps_message_send_as_is() {
        let a = parse_agent_action(&wrap("message.send", "", "hi team")).expect("some");
        assert_eq!(a.action_type, "message.send");
    }

    #[test]
    fn extracts_json_embedded_in_prose() {
        let text = format!(
            "Sure! Here is my action:\n{}\nThanks.",
            wrap("task.complete", "", "ok")
        );
        let a = parse_agent_action(&text).expect("json extracted from prose");
        assert_eq!(a.action_type, "task.complete");
    }

    #[test]
    fn plain_text_without_json_returns_none() {
        assert!(parse_agent_action("I am still thinking about the problem.").is_none());
    }

    #[test]
    fn malformed_json_returns_none() {
        // Missing required AgentJsonOutput fields -> deserialize fails -> None.
        assert!(parse_agent_action("{\"next_action\": {\"type\": \"task.complete\"}}").is_none());
    }
}
