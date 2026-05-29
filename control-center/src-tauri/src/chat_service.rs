use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Result, OptionalExtension};
use tauri::{State, AppHandle, Manager};
use crate::storage::DbState;
use crate::router::{call_model, ChatMessage, ModelSettings};
use crate::event_bus::{emit_event, AppEvent};
use std::time::{SystemTime, UNIX_EPOCH};
use std::process::Command;

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
pub fn get_messages(state: State<'_, DbState>, session_id: String) -> Result<Vec<DbMessage>, String> {
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

    let timestamp: String = conn.query_row(
        "SELECT timestamp FROM messages WHERE id = ?1",
        [id],
        |row| row.get(0),
    ).map_err(|e| e.to_string())?;

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
    // 1. Fetch agent profile data
    let (name, role, persona, provider, model_name, temp, max_t) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT name, role, persona, model_provider, model_name, temperature, max_tokens 
             FROM agents WHERE id = ?1",
            [&agent_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, f64>(5)?,
                    row.get::<_, i32>(6)?,
                ))
            },
        )
        .map_err(|e| format!("Agent not found: {}", e))?
    };

    // Get active provider config api keys/endpoints if available
    let (api_key, endpoint_url) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        conn.query_row(
            "SELECT api_key, endpoint_url FROM model_configs WHERE provider = ?1 AND is_default = 1",
            [&provider],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .unwrap_or((None, None))
    };

    // ReAct Execution Loop (Max 5 iterations to prevent runaway infinite execution)
    let mut iteration = 0;
    let max_iterations = 5;
    let mut is_finished = false;

    while !is_finished && iteration < max_iterations {
        iteration += 1;

        // Update status to working and update heartbeat
        {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            let now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs()
                .to_string();
            conn.execute(
                "UPDATE agents SET status = 'working', last_heartbeat = ?2 WHERE id = ?1",
                params![agent_id, now],
            )
            .map_err(|e| e.to_string())?;
        }

        emit_event(
            &app_handle,
            AppEvent {
                event_type: "agent_run_status".to_string(),
                agent_id: Some(agent_id.clone()),
                task_id: None,
                payload: serde_json::json!({ "status": "working", "role": role }),
            },
        );

        if iteration == 1 {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            let _ = conn.execute(
                "INSERT INTO events (event_type, agent_id, payload) VALUES ('task_started', ?1, '{}')",
                params![agent_id],
            );
        }

        // Fetch active task_id assigned to this agent that is 'in_progress'
        let task_id: Option<String> = {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            conn.query_row(
                "SELECT id FROM tasks WHERE assigned_agent_id = ?1 AND status = 'in_progress' LIMIT 1",
                [&agent_id],
                |row| row.get(0),
            )
            .optional()
            .unwrap_or(None)
        };

        let mut checkpoint_recovery_context = String::new();
        if let Some(ref t_id) = task_id {
            if let Ok(Some(cp)) = crate::checkpoint_store::get_latest_checkpoint(state.clone(), agent_id.clone(), t_id.clone()) {
                checkpoint_recovery_context = format!(
                    "\n### RECOVERY RESUME SNAPSHOT:\n\
                     The system watchdog recovered your execution from a stall or restart.\n\
                     - Last Reasoning Summary: {}\n\
                     - Last Plan Steps: {}\n\
                     - Completed Steps: {}\n\
                     - Open Steps: {}\n\
                     - Files Touched: {}\n\
                     Please resume work exactly from this snapshot. If the last command failed, analyze the error and self-heal.\n",
                    cp.reasoning_summary, cp.plan, cp.completed_steps, cp.open_steps, cp.files_touched
                );
            }
        }

        // Fetch dynamically compiled blackboard awareness context to inject
        let (context_packet, work_queue_str) = {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            let ctx = crate::context_engine::get_workspace_context_snapshot(&conn, Some(&agent_id), None, None).unwrap_or_default();
            
            // Compile agent active work queue
            let mut stmt = conn.prepare(
                "SELECT id, title, status, priority, acceptance_criteria, required_files 
                 FROM tasks 
                 WHERE (assigned_agent_id = ?1 OR owner_id = ?1) AND status != 'done'"
            ).map_err(|e| e.to_string())?;
            
            let iter = stmt.query_map([&agent_id], |row| {
                Ok(format!(
                    "- [Card ID: {}] \"{}\" | status={} | priority={} | criteria={}",
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<String>>(4)?.unwrap_or_default()
                ))
            }).map_err(|e| e.to_string())?;
            
            let mut q_list = Vec::new();
            for item in iter {
                if let Ok(s) = item {
                    q_list.push(s);
                }
            }
            let q_str = if q_list.is_empty() {
                "None - No active enqueued cards assigned to you.".to_string()
            } else {
                q_list.join("\n")
            };
            
            (ctx, q_str)
        };

        // 2. Build full conversation messages from database for this session_id
        let system_instructions = format!(
            "You are {} (Role: {}).\nYour Persona: {}\n\n\
             {}\n\n\
             {}\n\n\
             ### YOUR ACTIVE KANBAN WORK QUEUE:\n{}\n\n\
             You are operating inside a secure macOS agent workspace. You have direct access to execute shell commands and write files on the host computer.\n\n\
             CRITICAL: Before doing any work, you MUST check your Kanban work queue above and claim your highest priority enqueued card. When doing work, you must update the card progress and mark it done with validation evidence when finished.\n\n\
             To claim a card and start working on it, output:\n\
             ACTION: claim_card\n\
             CARD_ID: <card_id>\n\n\
             To update card progress (e.g. logging notes, files modified, validation checks):\n\
             ACTION: update_card_progress\n\
             CARD_ID: <card_id>\n\
             NOTES: <your progress note description here>\n\
             FILES: [\"<filepath_here>\"]\n\
             VALIDATION_STATUS: <passed or pending or failed>\n\n\
             To complete a card (only do this when all criteria are satisfied and evidence is attached):\n\
             ACTION: complete_card\n\
             CARD_ID: <card_id>\n\
             EVIDENCE: <your detailed completion explanation and paths to evidence files>\n\
             VALIDATION_PASSED: <true or false>\n\n\
             Format 1 (Strict ReAct block for file writes):\n\
             ACTION: write_file\n\
             PATH: <target filepath here (e.g. hello.rs or ~/Desktop/hello.rs)>\n\
             CONTENT:\n\
             <file contents here>\n\n\
             Format 2 (Annotated Markdown code block - highly recommended for natural writing):\n\
             ```rust\n\
             // filepath: ~/Desktop/hello.rs\n\
             fn main() {{\n\
                 println!(\"Hello\");\n\
             }}\n\
             ```\n\
             (Use '// filepath: <path>' or '# filepath: <path>' as the very first line inside the code block to automatically trigger a save to the host machine)\n\n\
             To execute a shell command, you MUST output either of these:\n\
             Format 1:\n\
             ACTION: execute_command\n\
             COMMAND: <your shell command here>\n\n\
             Format 2:\n\
             ```bash\n\
             // execute: <your shell command here>\n\
             ```\n\n\
             When you are completely finished with your task and have no more actions to run, speak directly to the user to deliver your final response.\n\n\
             Keep answers concise and let the tools do the heavy lifting.",
            name, role, persona, context_packet, checkpoint_recovery_context, work_queue_str
        );

        let mut history = vec![
            ChatMessage {
                role: "system".to_string(),
                content: system_instructions,
            }
        ];

        {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            let mut stmt = conn
                .prepare(
                    "SELECT role, content FROM messages 
                     WHERE session_id = ?1 
                     ORDER BY timestamp ASC",
                )
                .map_err(|e| e.to_string())?;

            let msg_iter = stmt
                .query_map([&session_id], |row| {
                    Ok(ChatMessage {
                        role: row.get(0)?,
                        content: row.get(1)?,
                    })
                })
                .map_err(|e| e.to_string())?;

            for msg in msg_iter {
                if let Ok(m) = msg {
                    history.push(m);
                }
            }
        }

        // 3. Call model router
        let settings = ModelSettings {
            temperature: Some(temp),
            max_tokens: Some(max_t),
        };

        // Call the model router asynchronously (NO locks held across this .await point!)
        let response_text = match call_model(&provider, &model_name, history, settings, api_key.clone(), endpoint_url.clone()).await {
            Ok(text) => text,
            Err(e) => {
                // Log crash, change status to error
                let conn = state.conn.lock().map_err(|e| e.to_string())?;
                conn.execute(
                    "UPDATE agents SET status = 'error' WHERE id = ?1",
                    [&agent_id],
                )
                .map_err(|e| e.to_string())?;
                
                emit_event(
                    &app_handle,
                    AppEvent {
                        event_type: "agent_run_status".to_string(),
                        agent_id: Some(agent_id.clone()),
                        task_id: None,
                        payload: serde_json::json!({ "status": "error" }),
                    },
                );

                // Insert a friendly system-level error message into the chat so the user is not left with silence
                let error_content = format!(
                    "⚠️ **[SYSTEM ERROR]:** Failed to generate response from model provider `{}` (model: `{}`).\n\n\
                    **Error Details:**\n\
                    ```\n\
                    {}\n\
                    ```\n\n\
                    **Common Troubleshooting Steps:**\n\
                    1. **Activate a Local GGUF Model:** Go to the **Models** tab, download a recommended model (such as *Llama 3.2 1B Instruct*), and click **Activate Global** to load it.\n\
                    2. **Check Supervisor Status:** Go to the **System** tab to verify that the Camelid backend service is running and healthy on port `8181`.\n\
                    3. **API Keys / Endpoint:** If you are using external APIs (Ollama, OpenAI, Anthropic), make sure your API keys or endpoint URLs are correct in the Settings.",
                    provider, model_name, e
                );

                let error_msg = {
                    let _ = conn.execute(
                        "INSERT INTO messages (session_id, role, sender_id, content) \
                         VALUES (?1, 'assistant', ?2, ?3)",
                        params![session_id, agent_id, error_content],
                    );
                    
                    let reply_id = conn.last_insert_rowid() as i32;
                    let timestamp: String = conn.query_row(
                        "SELECT timestamp FROM messages WHERE id = ?1",
                        [reply_id],
                        |row| row.get(0),
                    ).unwrap_or_default();

                    DbMessage {
                        id: Some(reply_id),
                        session_id: session_id.clone(),
                        role: "assistant".to_string(),
                        sender_id: Some(agent_id.clone()),
                        content: error_content,
                        timestamp,
                    }
                };

                emit_event(
                    &app_handle,
                    AppEvent {
                        event_type: "message".to_string(),
                        agent_id: Some(agent_id.clone()),
                        task_id: None,
                        payload: serde_json::to_value(&error_msg).unwrap_or(serde_json::Value::Null),
                    },
                );

                return Err(e);
            }
        };

        // Parse response for ReAct tool actions
        if let Some(action) = parse_agent_action(&response_text) {
            println!("[AGENT ReAct TOOL INTERCEPT] Selected Agent triggered: {}", action.action_type);

            // Save the Thought message locally inside its own db lock scope
            let reply_msg = {
                let conn = state.conn.lock().map_err(|e| e.to_string())?;
                conn.execute(
                    "INSERT INTO messages (session_id, role, sender_id, content) 
                     VALUES (?1, 'assistant', ?2, ?3)",
                    params![session_id, agent_id, response_text],
                )
                .map_err(|e| e.to_string())?;

                let reply_id = conn.last_insert_rowid() as i32;
                let timestamp: String = conn.query_row(
                    "SELECT timestamp FROM messages WHERE id = ?1",
                    [reply_id],
                    |row| row.get(0),
                ).map_err(|e| e.to_string())?;

                DbMessage {
                    id: Some(reply_id),
                    session_id: session_id.clone(),
                    role: "assistant".to_string(),
                    sender_id: Some(agent_id.clone()),
                    content: response_text,
                    timestamp,
                }
            };

            // Emit the agent's thought process message
            emit_event(
                &app_handle,
                AppEvent {
                    event_type: "message".to_string(),
                    agent_id: Some(agent_id.clone()),
                    task_id: None,
                    payload: serde_json::to_value(&reply_msg).unwrap_or(serde_json::Value::Null),
                },
            );

            // Execute parsed tool action
            let outcome_text = if action.action_type == "write_file" {
                if let Some(ref path) = action.path {
                    if let Some(ref content) = action.content {
                        let target_path = resolve_path(path);

                        if let Some(parent) = target_path.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }

                        match std::fs::write(&target_path, content) {
                            Ok(_) => {
                                let path_str = target_path.to_string_lossy().to_string();
                                let conn = state.conn.lock().map_err(|e| e.to_string())?;
                                let _ = conn.execute(
                                    "INSERT INTO artifacts (path, artifact_type) VALUES (?1, 'code')",
                                    [&path_str],
                                );
                                let _ = conn.execute(
                                    "INSERT INTO events (event_type, agent_id, payload) VALUES ('file_created', ?1, ?2)",
                                    params![agent_id, format!("{{\"path\":\"{}\"}}", path_str)],
                                );

                                // Auto-link file to active claimed card if one is in progress!
                                let active_card_id: Option<String> = conn.query_row(
                                    "SELECT id FROM tasks WHERE (assigned_agent_id = ?1 OR owner_id = ?1) AND status = 'in_progress' LIMIT 1",
                                    [&agent_id],
                                    |row| row.get(0),
                                ).ok();
                                
                                if let Some(c_id) = active_card_id {
                                    let db_state = app_handle.state::<crate::storage::DbState>();
                                    let _ = crate::task_manager::update_card_progress(
                                        db_state,
                                        app_handle.clone(),
                                        agent_id.clone(),
                                        c_id,
                                        Some(format!("Automatically linked created/modified file: {}", path_str)),
                                        Some(vec![path_str.clone()]),
                                        None,
                                        None,
                                        None,
                                    );
                                }

                                format!("SUCCESS: File successfully saved to: {:?}", target_path)
                            }
                            Err(e) => format!("ERROR: Failed to write file: {}", e)
                        }
                    } else {
                        "ERROR: Missing CONTENT block in write_file action".to_string()
                    }
                } else {
                    "ERROR: Missing PATH in write_file action".to_string()
                }
            } else if action.action_type == "execute_command" {
                if let Some(ref cmd) = action.command {
                    let t_id = task_id.clone().unwrap_or_else(|| "unassigned".to_string());
                    match crate::command_guard::check_command(&state, &agent_id, &t_id, cmd) {
                        Ok(crate::command_guard::GuardResult::Suspended(reason)) => {
                            is_finished = true; // Suspend agent ReAct execution loop
                            format!("SUSPENDED: The command requires human approval. Reason: {}", reason)
                        }
                        _ => {
                            // Execute shell command synchronously on host
                            println!("[SANDBOX EXECUTE] Command: {}", cmd);
                            let output_res = Command::new("sh")
                                .args(["-c", cmd])
                                .output();

                            match output_res {
                                Ok(output) => {
                                    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                                    if output.status.success() {
                                        format!("SUCCESS:\nstdout:\n{}\nstderr:\n{}", stdout, stderr)
                                    } else {
                                        format!(
                                            "FAILED (exit status {}):\nstdout:\n{}\nstderr:\n{}\n\n\
                                             ### ERROR DIAGNOSED:\n\
                                             The command failed. Analyze the stderr/stdout to diagnose compile errors, missing directories, or test failures. Self-heal by modifying files or taking corrective action.",
                                            output.status, stdout, stderr
                                        )
                                    }
                                }
                                Err(e) => format!("ERROR: Failed to launch shell command: {}", e)
                            }
                        }
                    }
                } else {
                    "ERROR: Missing COMMAND parameter in execute_command action".to_string()
                }
            } else if action.action_type == "record_decision" {
                if let Some(ref dec_text) = action.decision {
                    let active_ws_id: String = {
                        let conn = state.conn.lock().map_err(|e| e.to_string())?;
                        conn.query_row(
                            "SELECT id FROM workspaces WHERE active = 1 LIMIT 1",
                            [],
                            |row| row.get(0),
                        ).unwrap_or_else(|_| "default".to_string())
                    };
                    let conn = state.conn.lock().map_err(|e| e.to_string())?;
                    let insert_res = conn.execute(
                        "INSERT INTO decisions (workspace_id, decision, decided_by) VALUES (?1, ?2, ?3)",
                        params![active_ws_id, dec_text, agent_id],
                    );
                    if insert_res.is_ok() {
                        let _ = conn.execute(
                            "INSERT INTO events (event_type, agent_id, payload) VALUES ('decision_recorded', ?1, ?2)",
                            params![agent_id, format!("{{\"decision\":\"{}\"}}", dec_text)],
                        );
                        format!("SUCCESS: Decision successfully recorded: \"{}\"", dec_text)
                    } else {
                        "ERROR: Failed to save decision to database".to_string()
                    }
                } else {
                    "ERROR: Missing DECISION parameter in record_decision action".to_string()
                }
            } else if action.action_type == "report_blocker" {
                if let (Some(ref t_id), Some(ref blocked_by), Some(ref reason_val)) = (&action.task_id, &action.blocked_by_task_id, &action.reason) {
                    let conn = state.conn.lock().map_err(|e| e.to_string())?;
                    let insert_res = conn.execute(
                        "INSERT INTO task_blockers (task_id, blocked_by_task_id, reason) VALUES (?1, ?2, ?3)",
                        params![t_id, blocked_by, reason_val],
                    );
                    if insert_res.is_ok() {
                        let _ = conn.execute(
                            "UPDATE tasks SET status = 'blocked', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
                            [t_id],
                        );
                        let _ = conn.execute(
                            "INSERT INTO events (event_type, agent_id, task_id, payload) VALUES ('blocker_reported', ?1, ?2, ?3)",
                            params![agent_id, t_id, format!("{{\"blocked_by\":\"{}\",\"reason\":\"{}\"}}", blocked_by, reason_val)],
                        );
                        format!("SUCCESS: Blocker reported on task \"{}\" by task \"{}\": \"{}\"", t_id, blocked_by, reason_val)
                    } else {
                        "ERROR: Failed to save task blocker to database".to_string()
                    }
                } else {
                    "ERROR: Missing TASK_ID, BLOCKED_BY_TASK_ID, or REASON parameter in report_blocker action".to_string()
                }
            } else if action.action_type == "request_handoff" {
                if let (Some(ref target_id), Some(ref reason_val)) = (&action.target_agent_id, &action.reason) {
                    let conn = state.conn.lock().map_err(|e| e.to_string())?;
                    let insert_res = conn.execute(
                        "INSERT INTO handoffs (task_id, source_agent_id, target_agent_id, reason, status) 
                         VALUES (?1, ?2, ?3, ?4, 'pending')",
                        params![action.task_id, agent_id, target_id, reason_val],
                    );
                    if insert_res.is_ok() {
                        let _ = conn.execute(
                            "INSERT INTO events (event_type, agent_id, payload) VALUES ('handoff_requested', ?1, ?2)",
                            params![agent_id, format!("{{\"target_agent_id\":\"{}\",\"reason\":\"{}\"}}", target_id, reason_val)],
                        );
                        format!("SUCCESS: Handoff requested from you to {} for reason: \"{}\"", target_id, reason_val)
                    } else {
                        "ERROR: Failed to save handoff to database".to_string()
                    }
                } else {
                    "ERROR: Missing TARGET_AGENT_ID or REASON parameter in request_handoff action".to_string()
                }
            } else if action.action_type == "claim_card" {
                if let Some(ref card_id) = action.card_id {
                    let db_state = app_handle.state::<crate::storage::DbState>();
                    match crate::task_manager::claim_card(db_state, app_handle.clone(), agent_id.clone(), card_id.clone()) {
                        Ok(_) => format!("SUCCESS: You have successfully claimed Kanban card '{}'. Status is now In Progress.", card_id),
                        Err(e) => format!("ERROR: Failed to claim card '{}': {}", card_id, e)
                    }
                } else {
                    "ERROR: Missing CARD_ID parameter in claim_card action".to_string()
                }
            } else if action.action_type == "update_card_progress" {
                if let Some(ref card_id) = action.card_id {
                    let db_state = app_handle.state::<crate::storage::DbState>();
                    let progress_notes = action.notes.clone();
                    let files_list = action.files.clone();
                    let validation_stat = action.validation_status.clone();
                    match crate::task_manager::update_card_progress(
                        db_state,
                        app_handle.clone(),
                        agent_id.clone(),
                        card_id.clone(),
                        progress_notes,
                        files_list,
                        None,
                        None,
                        validation_stat,
                    ) {
                        Ok(_) => format!("SUCCESS: Kanban card '{}' progress has been successfully updated.", card_id),
                        Err(e) => format!("ERROR: Failed to update card '{}' progress: {}", card_id, e)
                    }
                } else {
                    "ERROR: Missing CARD_ID parameter in update_card_progress action".to_string()
                }
            } else if action.action_type == "complete_card" {
                if let (Some(ref card_id), Some(ref evidence), Some(val_passed)) = (&action.card_id, &action.evidence, action.validation_passed) {
                    let db_state = app_handle.state::<crate::storage::DbState>();
                    let val_notes = action.validation_notes.clone();
                    match crate::task_manager::complete_card(
                        db_state,
                        app_handle.clone(),
                        agent_id.clone(),
                        card_id.clone(),
                        evidence.clone(),
                        val_passed,
                        val_notes,
                    ) {
                        Ok(_) => format!("SUCCESS: Kanban card '{}' has been successfully completed and moved to review/done.", card_id),
                        Err(e) => format!("ERROR: Failed to complete card '{}': {}", card_id, e)
                    }
                } else {
                    "ERROR: Missing CARD_ID, EVIDENCE, or VALIDATION_PASSED parameter in complete_card action".to_string()
                }
            } else {
                format!("ERROR: Unsupported action type: {}", action.action_type)
            };

            // Save the System Tool Outcome message locally inside its own db lock scope
            let outcome_msg = {
                let conn = state.conn.lock().map_err(|e| e.to_string())?;
                conn.execute(
                    "INSERT INTO messages (session_id, role, sender_id, content) 
                     VALUES (?1, 'system', 'system', ?2)",
                    params![session_id, outcome_text],
                )
                .map_err(|e| e.to_string())?;

                let outcome_id = conn.last_insert_rowid() as i32;
                let outcome_timestamp: String = conn.query_row(
                    "SELECT timestamp FROM messages WHERE id = ?1",
                    [outcome_id],
                    |row| row.get(0),
                ).map_err(|e| e.to_string())?;

                DbMessage {
                    id: Some(outcome_id),
                    session_id: session_id.clone(),
                    role: "system".to_string(),
                    sender_id: Some("system".to_string()),
                    content: outcome_text,
                    timestamp: outcome_timestamp,
                }
            };

            // Emit the tool outcome message so the user sees it in the global feed!
            emit_event(
                &app_handle,
                AppEvent {
                    event_type: "message".to_string(),
                    agent_id: Some("system".to_string()),
                    task_id: None,
                    payload: serde_json::to_value(&outcome_msg).unwrap_or(serde_json::Value::Null),
                },
            );

        } else {
            // No action block parsed: This is the Final Response!
            is_finished = true;

            // Save final reply into database
            let reply_msg = {
                let conn = state.conn.lock().map_err(|e| e.to_string())?;
                conn.execute(
                    "INSERT INTO messages (session_id, role, sender_id, content) 
                     VALUES (?1, 'assistant', ?2, ?3)",
                    params![session_id, agent_id, response_text],
                )
                .map_err(|e| e.to_string())?;

                let reply_id = conn.last_insert_rowid() as i32;
                let timestamp: String = conn.query_row(
                    "SELECT timestamp FROM messages WHERE id = ?1",
                    [reply_id],
                    |row| row.get(0),
                ).map_err(|e| e.to_string())?;

                DbMessage {
                    id: Some(reply_id),
                    session_id: session_id.clone(),
                    role: "assistant".to_string(),
                    sender_id: Some(agent_id.clone()),
                    content: response_text,
                    timestamp,
                }
            };

            // Emit final message so UI displays it
            emit_event(
                &app_handle,
                AppEvent {
                    event_type: "message".to_string(),
                    agent_id: Some(agent_id.clone()),
                    task_id: None,
                    payload: serde_json::to_value(&reply_msg).unwrap_or(serde_json::Value::Null),
                },
            );
        }

        // Save execution checkpoint at the end of each ReAct iteration
        if let Some(ref t_id) = task_id {
            let plan_str = "[\"Analyze objectives\", \"Perform execution tools\", \"Verify code deliverables\"]".to_string();
            let completed_str = format!("[\"ReAct Iteration {}\"]", iteration);
            let open_str = format!("[\"Next ReAct step\"]");
            let touched_files = "[]".to_string();
            let reasoning = format!("Agent {} executing ReAct step {} under task '{}'.", name, iteration, t_id);
            let last_output = format!("Successfully finished iteration step {}", iteration);

            let cp = crate::checkpoint_store::Checkpoint {
                id: None,
                agent_id: agent_id.clone(),
                task_id: t_id.clone(),
                plan: plan_str,
                completed_steps: completed_str,
                open_steps: open_str,
                files_touched: touched_files,
                reasoning_summary: reasoning,
                last_tool_output: last_output,
                validation_status: "pending".to_string(),
                timestamp: None,
            };
            let _ = crate::checkpoint_store::save_agent_checkpoint(state.clone(), cp);
        }
    }

    // Set agent status back to idle
    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let _ = conn.execute(
            "INSERT INTO events (event_type, agent_id, payload) VALUES ('task_completed', ?1, '{}')",
            params![agent_id],
        );
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs()
            .to_string();
        conn.execute(
            "UPDATE agents SET status = 'idle', last_heartbeat = ?2 WHERE id = ?1",
            params![agent_id, now],
        )
        .map_err(|e| e.to_string())?;
    }

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "agent_run_status".to_string(),
            agent_id: Some(agent_id),
            task_id: None,
            payload: serde_json::json!({ "status": "idle" }),
        },
    );

    Ok(())
}

fn get_blackboard_context(conn: &Connection) -> Result<String, rusqlite::Error> {
    // Shared objective
    let shared_obj: String = conn.query_row(
        "SELECT value FROM shared_state WHERE key = 'objective'",
        [],
        |row| row.get(0),
    ).unwrap_or_else(|_| "None".to_string());

    // Active crew
    let mut stmt = conn.prepare("SELECT name, role, status FROM agents")?;
    let agent_iter = stmt.query_map([], |row| {
        Ok(format!("- {} ({}): [{}]", row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
    })?;
    
    let mut agents = Vec::new();
    for agent in agent_iter {
        if let Ok(a) = agent {
            agents.push(a);
        }
    }

    // Latest tasks
    let mut stmt_tasks = conn.prepare("SELECT title, status FROM tasks LIMIT 3")?;
    let task_iter = stmt_tasks.query_map([], |row| {
        Ok(format!("- Task: \"{}\" | [{}]", row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?;

    let mut tasks = Vec::new();
    for task in task_iter {
        if let Ok(t) = task {
            tasks.push(t);
        }
    }

    let blackboard = format!(
        "### SHARED WORLD AWARENESS BLACKBOARD:\n\
         - Shared Global Goal: {}\n\n\
         Active crew status:\n{}\n\n\
         Recent task objectives:\n{}",
        shared_obj, agents.join("\n"), tasks.join("\n")
    );

    Ok(blackboard)
}

struct AgentAction {
    action_type: String,
    command: Option<String>,
    path: Option<String>,
    content: Option<String>,
    decision: Option<String>,
    reason: Option<String>,
    target_agent_id: Option<String>,
    task_id: Option<String>,
    blocked_by_task_id: Option<String>,
    card_id: Option<String>,
    notes: Option<String>,
    files: Option<Vec<String>>,
    validation_status: Option<String>,
    evidence: Option<String>,
    validation_passed: Option<bool>,
    validation_notes: Option<String>,
}

fn resolve_path(path: &str) -> std::path::PathBuf {
    let clean_path = path.trim();
    let mut resolved = std::path::PathBuf::new();
    
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/timtoole".to_string());
    
    if clean_path.starts_with("~/") {
        resolved.push(&home);
        resolved.push(&clean_path[2..]);
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
        "<!-- save:"
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
                if (path_part.starts_with('"') && path_part.ends_with('"')) || 
                   (path_part.starts_with('\'') && path_part.ends_with('\'')) {
                    if path_part.len() > 2 {
                        path_part = &path_part[1..path_part.len() - 1];
                    }
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
        "<!-- run:"
    ];
    
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
                if (cmd_part.starts_with('"') && cmd_part.ends_with('"')) || 
                   (cmd_part.starts_with('\'') && cmd_part.ends_with('\'')) {
                    if cmd_part.len() > 2 {
                        cmd_part = &cmd_part[1..cmd_part.len() - 1];
                    }
                }
                
                if !cmd_part.is_empty() {
                    return Some(AgentAction {
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
                    });
                }
            }
        }
    }
    
    None
}

fn parse_agent_action(text: &str) -> Option<AgentAction> {
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
            Some(files.split(',').map(|f| f.trim().to_string()).filter(|f| !f.is_empty()).collect())
        };

        let val_passed = if validation_passed.is_empty() {
            None
        } else {
            let clean_val = validation_passed.to_lowercase();
            Some(clean_val == "true" || clean_val == "yes" || clean_val == "1" || clean_val == "passed")
        };

        return Some(AgentAction {
            action_type,
            command: if command.is_empty() { None } else { Some(command) },
            path: if path.is_empty() { None } else { Some(path) },
            content: if content.is_empty() { None } else { Some(content) },
            decision: if decision.is_empty() { None } else { Some(decision) },
            reason: if reason.is_empty() { None } else { Some(reason) },
            target_agent_id: if target_agent_id.is_empty() { None } else { Some(target_agent_id) },
            task_id: if task_id.is_empty() { None } else { Some(task_id) },
            blocked_by_task_id: if blocked_by_task_id.is_empty() { None } else { Some(blocked_by_task_id) },
            card_id: if card_id.is_empty() { None } else { Some(card_id) },
            notes: if notes.is_empty() { None } else { Some(notes) },
            files: files_vec,
            validation_status: if validation_status.is_empty() { None } else { Some(validation_status) },
            evidence: if evidence.is_empty() { None } else { Some(evidence) },
            validation_passed: val_passed,
            validation_notes: if validation_notes.is_empty() { None } else { Some(validation_notes) },
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
