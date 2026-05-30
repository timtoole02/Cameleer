use rusqlite::{params, Connection};
use tauri::{AppHandle, State, Manager};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::storage::DbState;
use crate::agent_identity::{AgentIdentity, load_identity};
use crate::agent_contracts::{AgentContract, load_contract};
use crate::agent_state_machine::{AgentState, transition_agent_state};
use crate::agent_work_router::{get_agent_work_queue, select_next_work, KanbanCard};
use crate::context_engine::get_scoped_agent_context_snapshot;
use crate::event_bus::{emit_event, AppEvent};
use crate::router::{call_model, ChatMessage, ModelSettings};
use crate::chat_service::{parse_agent_action, DbMessage}; // Reusing the parser for now

pub async fn run_agent_cycle(agent_id: String, session_id: String, app_handle: AppHandle) -> Result<(), String> {
    let state = app_handle.state::<DbState>();
    
    // 1. Identify agent
    let identity = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        load_identity(&agent_id, &conn)?
    };

    // 2. Load agent contract
    let contract = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        load_contract(&agent_id, &identity.role, &conn)?
    };

    let mut current_state = AgentState::from_str(&identity.active_status);

    // 3. Load assigned Kanban work
    let work_queue = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        get_agent_work_queue(&agent_id, &conn)?
    };

    // 4. Select the correct task
    let selected_work = select_next_work(&agent_id, &work_queue);

    if selected_work.is_none() {
        if current_state != AgentState::Idle {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            let _ = transition_agent_state(&conn, &agent_id, current_state.clone(), AgentState::Idle, "No work available in queue");
            current_state = AgentState::Idle;
        }
        println!("[AGENT RUNTIME KERNEL] Agent {} has no work. Going idle.", agent_id);
    } else {
        // 5. Transition to Assigned/Working based on state
        if current_state == AgentState::Idle || current_state == AgentState::Stopped {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            let _ = transition_agent_state(&conn, &agent_id, current_state.clone(), AgentState::Working, "Pulled new task from queue");
            current_state = AgentState::Working;
        }
    }

    // 6. Compile relevant context (Scoped Context Compiler)
    let (context_snapshot, api_key, endpoint_url) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        
        // Scope context to agent's primary project if available
        let proj_id = identity.project_ids.first().map(|s| s.as_str());
        let team_id = identity.team_ids.first().map(|s| s.as_str());
        
        let ctx = get_scoped_agent_context_snapshot(&conn, Some(&agent_id), Some(&identity.workspace_id), proj_id, team_id)?;

        let parts: Vec<&str> = identity.default_model_id.split('/').collect();
        let provider = if parts.is_empty() { "curated" } else { parts[0] };
        
        let (key, ep) = conn.query_row(
            "SELECT api_key, endpoint_url FROM model_configs WHERE provider = ?1 AND is_default = 1",
            [provider],
            |row| Ok((row.get::<_, Option<String>>(0)?, row.get::<_, Option<String>>(1)?)),
        ).unwrap_or((None, None));

        (ctx, key, ep)
    };

    // 7. Check dependencies / blockers
    if let Some(ref work) = selected_work {
        if work.status == "Blocked" || work.blocked_by.is_some() {
            let conn = state.conn.lock().map_err(|e| e.to_string())?;
            let _ = transition_agent_state(&conn, &agent_id, current_state.clone(), AgentState::Blocked, "Task is blocked by dependencies");
            
            let msg = format!("My active task '{}' is currently blocked by {}. Entering blocked state.", work.title, work.blocked_by.as_deref().unwrap_or("unknown"));
            save_and_emit_message(&app_handle, &session_id, &agent_id, msg);
            return Ok(());
        }
    }

    // 8. Call Model for ONE deterministic safe step
    let system_instructions = build_system_prompt(&identity, &contract, selected_work.as_ref(), &context_snapshot);
    
    let mut history = vec![
        ChatMessage {
            role: "system".to_string(),
            content: system_instructions,
        }
    ];

    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn.prepare("SELECT role, content FROM messages WHERE session_id = ?1 ORDER BY timestamp ASC").map_err(|e| e.to_string())?;
        let msg_iter = stmt.query_map([&session_id], |row| Ok(ChatMessage { role: row.get(0)?, content: row.get(1)? })).unwrap();
        for msg in msg_iter {
            if let Ok(m) = msg {
                history.push(m);
            }
        }
    }

    let parts: Vec<&str> = identity.default_model_id.split('/').collect();
    let provider = if parts.len() > 1 { parts[0] } else { "curated" };
    let model_name = if parts.len() > 1 { parts[1] } else { parts[0] };
    
    let settings = ModelSettings { temperature: Some(0.7), max_tokens: Some(2048) };

    let response_text = match call_model(provider, model_name, history, settings, api_key, endpoint_url).await {
        Ok(text) => text,
        Err(e) => {
            let conn = state.conn.lock().map_err(|err| err.to_string())?;
            let _ = transition_agent_state(&conn, &agent_id, current_state.clone(), AgentState::Failed, &format!("Model inference failed: {}", e));
            save_and_emit_message(&app_handle, &session_id, &agent_id, format!("⚠️ Model Execution Failed: {}", e));
            return Err(e);
        }
    };

    save_and_emit_message(&app_handle, &session_id, &agent_id, response_text.clone());

    // 9. Execute Action & Guard
    let mut target_state = AgentState::Idle;
    let mut transition_reason = "Completed cycle iteration".to_string();

    if let Some(action) = parse_agent_action(&response_text) {
        println!("[AGENT RUNTIME KERNEL] Agent triggered Action: {}", action.action_type);
        
        if action.action_type == "complete_card" {
            if let Some(c_id) = action.card_id.as_ref() {
                let val_res = {
                    let conn = state.conn.lock().map_err(|e| e.to_string())?;
                    crate::agent_validation_engine::validate_task_completion(&conn, &agent_id, c_id, &action.evidence)
                };
                
                if let Ok(res) = val_res {
                    if res.is_valid {
                        println!("[VALIDATION] Task {} valid. Moving to {}", c_id, res.required_state);
                        let conn = state.conn.lock().map_err(|e| e.to_string())?;
                        let _ = conn.execute("UPDATE kanban_cards SET status = ?1 WHERE id = ?2", params![res.required_state, c_id]);
                        
                        transition_reason = format!("Successfully completed task {}", c_id);
                    } else {
                        println!("[VALIDATION FAILED] {:?}", res.errors);
                        let err_msg = format!("Validation failed. You must provide evidence or satisfy criteria:\n- {}", res.errors.join("\n- "));
                        save_and_emit_message(&app_handle, &session_id, "system", err_msg);
                        
                        // If validation fails, agent must remain in Working state to fix it
                        target_state = AgentState::Working;
                        transition_reason = "Validation failed, returning to work".to_string();
                    }
                }
            }
        } else {
            // Use tool controller for other actions
            match crate::agent_tool_controller::execute_tool(&app_handle, &agent_id, &session_id, &contract, &action) {
                Ok(result) => {
                    transition_reason = format!("Successfully executed {}", action.action_type);
                    target_state = AgentState::Working; // Usually want them to continue working after a tool call
                },
                Err(e) => {
                    let err_msg = format!("Tool execution failed: {}", e);
                    save_and_emit_message(&app_handle, &session_id, "system", err_msg);
                    transition_reason = format!("Tool {} failed", action.action_type);
                    target_state = AgentState::Working; // Keep working to recover
                }
            }
        }
        
    } else {
        println!("[AGENT RUNTIME KERNEL] Agent finished step with text response.");
        // If it's a text response, it implies idle
        target_state = AgentState::Idle;
    }

    // 10. Update state based on Validation Engine (Phase 2) and Recovery Engine (Phase 4)
    let conn = state.conn.lock().map_err(|err| err.to_string())?;
    let _ = transition_agent_state(&conn, &agent_id, current_state.clone(), target_state, &transition_reason);

    Ok(())
}

fn build_system_prompt(identity: &AgentIdentity, contract: &AgentContract, work: Option<&KanbanCard>, context: &str) -> String {
    let mut prompt = format!(
        "You are {} (Role: {}).\nYour Persona: {}\n\n",
        identity.name, identity.role, identity.persona
    );

    prompt.push_str("### AGENT CONTRACT (STRICT ENFORCEMENT)\n");
    prompt.push_str("Responsibilities:\n");
    for res in &contract.responsibilities {
        prompt.push_str(&format!("- {}\n", res));
    }
    
    prompt.push_str("\nForbidden Actions (DO NOT DO THESE):\n");
    for forb in &contract.forbidden_actions {
        prompt.push_str(&format!("- {}\n", forb));
    }

    prompt.push_str("\nDefinition of Done (Requires Validation):\n");
    for done in &contract.done_definition {
        prompt.push_str(&format!("- {}\n", done));
    }

    if let Some(w) = work {
        prompt.push_str(&format!("\n### ACTIVE KANBAN TASK\nID: {}\nTitle: {}\nStatus: {}\nPriority: {}\nValidation Status: {}\n\n", 
            w.id, w.title, w.status, w.priority, w.validation_status));
    } else {
        prompt.push_str("\n### ACTIVE KANBAN TASK\nNo active tasks assigned to you right now. You are currently in an Idle state. You may chat freely with the user.\n\n");
    }

    prompt.push_str(context);

    prompt.push_str("\n\n### EXECUTION INSTRUCTIONS\n\
        You must follow the Agent Runtime Kernel loop.\n\
        You are executing ONE safe step for your active task. Analyze context, perform work via tools, and then STOP.\n\n\
        Available Tools:\n\
        - ACTION: write_file (PATH, CONTENT)\n\
        - ACTION: execute_command (COMMAND)\n\
        - ACTION: claim_card (CARD_ID)\n\
        - ACTION: update_card_progress (CARD_ID, NOTES, FILES, VALIDATION_STATUS)\n\
        - ACTION: complete_card (CARD_ID, EVIDENCE, VALIDATION_PASSED)\n\n\
        CRITICAL: Output an ACTION block or speak directly to the user if finished.");

    prompt
}

fn save_and_emit_message(app_handle: &AppHandle, session_id: &str, sender_id: &str, content: String) {
    let state = app_handle.state::<DbState>();
    
    let db_msg_opt = {
        if let Ok(conn) = state.conn.lock() {
            let _ = conn.execute(
                "INSERT INTO messages (session_id, role, sender_id, content) VALUES (?1, 'assistant', ?2, ?3)",
                params![session_id, sender_id, &content],
            );
            let id = conn.last_insert_rowid() as i32;
            let ts: String = conn.query_row("SELECT timestamp FROM messages WHERE id = ?1", [id], |row| row.get(0)).unwrap_or_default();
            
            Some(DbMessage {
                id: Some(id),
                session_id: session_id.to_string(),
                role: "assistant".to_string(),
                sender_id: Some(sender_id.to_string()),
                content: content.clone(),
                timestamp: ts,
            })
        } else {
            None
        }
    };

    if let Some(msg) = db_msg_opt {
        emit_event(
            app_handle,
            AppEvent {
                event_type: "message".to_string(),
                agent_id: Some(sender_id.to_string()),
                task_id: None,
                payload: serde_json::to_value(&msg).unwrap_or(serde_json::Value::Null),
            },
        );
    }
}
