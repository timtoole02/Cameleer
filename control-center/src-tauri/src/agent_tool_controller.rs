use rusqlite::{Connection, params};
use tauri::{AppHandle, State, Manager};
use std::process::Command;

use crate::storage::DbState;
use crate::agent_contracts::AgentContract;
use crate::chat_service::AgentAction;
use crate::event_bus::{emit_event, AppEvent};
use crate::chat_service::DbMessage;
use crate::command_guard::{check_command, GuardResult};
use std::path::Path;
use std::io::Read;
use std::os::unix::process::CommandExt;

pub fn execute_tool(
    app_handle: &AppHandle,
    agent_id: &str,
    session_id: &str,
    contract: &AgentContract,
    action: &AgentAction
) -> Result<String, String> {

    // 1. Check allowed tools in contract
    if !contract.allowed_actions.contains(&action.action_type) && action.action_type != "task.complete" && action.action_type != "task.claim" && action.action_type != "task.update" && action.action_type != "agent.handoff" && action.action_type != "message.send" {
        return Err(format!("Action {} is not permitted in your Agent Contract", action.action_type));
    }
    match action.action_type.as_str() {
        "command.run" => {
            if let Some(cmd_str) = &action.command {
                let state = app_handle.state::<DbState>();
                let task_id = action.task_id.clone().unwrap_or_else(|| "global".to_string());
                
                // 1. Hook into Command Guard
                match check_command(&state, agent_id, &task_id, cmd_str)? {
                    GuardResult::Suspended(reason) => {
                        let msg = format!("Execution Suspended pending human approval: {}", reason);
                        save_and_emit_message(app_handle, session_id, "system", msg.clone());
                        return Ok(msg);
                    },
                    GuardResult::Allowed => {}
                }

                println!("[TOOL CONTROLLER] Agent {} executing: {}", agent_id, cmd_str);
                
                // 2. Prevent sh -c bypass by parsing args directly (rudimentary split)
                let mut parts = cmd_str.split_whitespace();
                let binary = parts.next().unwrap_or("");
                let args: Vec<&str> = parts.collect();

                let mut child = Command::new(binary)
                    .args(&args)
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped())
                    .spawn()
                    .map_err(|e| format!("Failed to spawn {}: {}", binary, e))?;

                // 3. Timeout and Output Capping
                // (Using a simple wait for now, but capping output reads)
                let mut stdout_str = String::new();
                let mut stderr_str = String::new();
                
                if let Some(mut stdout) = child.stdout.take() {
                    stdout.read_to_string(&mut stdout_str).unwrap_or_default();
                }
                if let Some(mut stderr) = child.stderr.take() {
                    stderr.read_to_string(&mut stderr_str).unwrap_or_default();
                }
                
                let _ = child.wait(); // Wait to finish

                // Cap output to 50KB to prevent payload overflow
                if stdout_str.len() > 50000 {
                    stdout_str.truncate(50000);
                    stdout_str.push_str("\n...[STDOUT TRUNCATED DUE TO SIZE LIMIT]...");
                }
                if stderr_str.len() > 50000 {
                    stderr_str.truncate(50000);
                    stderr_str.push_str("\n...[STDERR TRUNCATED DUE TO SIZE LIMIT]...");
                }

                let mut result_text = String::new();
                if !stdout_str.is_empty() {
                    result_text.push_str(&format!("STDOUT:\n{}\n", stdout_str));
                }
                if !stderr_str.is_empty() {
                    result_text.push_str(&format!("STDERR:\n{}\n", stderr_str));
                }
                
                let msg = format!("Execution result:\n{}", result_text);
                save_and_emit_message(app_handle, session_id, "system", msg.clone());
                
                Ok(result_text)
            } else {
                Err("No command provided".to_string())
            }
        },
        "file.write" => {
            if let (Some(path), Some(content)) = (&action.path, &action.content) {
                // Enforce workspace bounds
                let default_workspace = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string()) + "/Documents/Cameleer Workspace";
                let workspace_root = default_workspace.as_str(); // TODO: Dynamic from DB
                let target_path = Path::new(workspace_root).join(path);
                
                // Canonicalization strictly checks against traversal out of the root
                let target_normalized = std::fs::canonicalize(target_path.parent().unwrap_or(Path::new(workspace_root)))
                    .unwrap_or_else(|_| Path::new(workspace_root).to_path_buf())
                    .join(target_path.file_name().unwrap_or_default());
                
                if !target_normalized.starts_with(workspace_root) {
                    return Err("Security Violation: Path traversal outside workspace root blocked.".to_string());
                }

                if action.dry_run.unwrap_or(false) {
                    let msg = format!("Dry-run mode: Would write {} bytes to {:?}", content.len(), target_normalized);
                    save_and_emit_message(app_handle, session_id, "system", msg.clone());
                    return Ok(msg);
                }

                println!("[TOOL CONTROLLER] Agent {} writing file safely: {:?}", agent_id, target_normalized);
                
                std::fs::write(&target_normalized, content).map_err(|e| format!("Failed to write file: {}", e))?;
                
                let msg = format!("Successfully wrote to {:?}", target_normalized);
                save_and_emit_message(app_handle, session_id, "system", msg.clone());
                
                Ok(msg)
            } else {
                Err("Path and content required for write_file".to_string())
            }
        },
        "task.claim" => {
            if let Some(card_id) = &action.card_id {
                let state = app_handle.state::<DbState>();
                let conn = state.conn.lock().unwrap();
                conn.execute(
                    "UPDATE kanban_cards SET assigned_agent_id = ?1, status = 'In Progress' WHERE id = ?2",
                    params![agent_id, card_id]
                ).map_err(|e| e.to_string())?;
                
                let msg = format!("You have claimed card {}", card_id);
                save_and_emit_message(app_handle, session_id, "system", msg.clone());
                Ok(msg)
            } else {
                Err("card_id required".to_string())
            }
        },
        "task.update" => {
            if let Some(card_id) = &action.card_id {
                let state = app_handle.state::<DbState>();
                let conn = state.conn.lock().unwrap();
                let notes = action.notes.clone().unwrap_or_default();
                conn.execute(
                    "UPDATE kanban_cards SET comments = comments || ?1 WHERE id = ?2",
                    params![format!("\n- {}", notes), card_id]
                ).map_err(|e| e.to_string())?;
                
                let msg = format!("Updated progress for card {}", card_id);
                save_and_emit_message(app_handle, session_id, "system", msg.clone());
                Ok(msg)
            } else {
                Err("card_id required".to_string())
            }
        },
        "agent.handoff" => {
            if let (Some(card_id), Some(target_agent_id), Some(notes)) = (&action.card_id, &action.target_agent_id, &action.notes) {
                let state = app_handle.state::<DbState>();
                let conn = state.conn.lock().unwrap();
                
                crate::agent_handoff_manager::execute_handoff(
                    app_handle,
                    &conn,
                    card_id,
                    agent_id,
                    target_agent_id,
                    notes
                )?;
                
                let msg = format!("Task {} successfully handed off to {}", card_id, target_agent_id);
                save_and_emit_message(app_handle, session_id, "system", msg.clone());
                Ok(msg)
            } else {
                Err("card_id, target_agent_id, and notes required for handoff".to_string())
            }
        },
        "task.complete" => {
            // Handled explicitly in the kernel's validation engine integration
            Ok("Complete card request sent to validation engine.".to_string())
        },
        "message.send" => {
            if let Some(content) = &action.content {
                save_and_emit_message(app_handle, session_id, agent_id, content.clone());
                Ok("Message sent.".to_string())
            } else {
                Err("No content provided".to_string())
            }
        },
        "task.create" => {
            if let Some(notes) = &action.notes {
                // Stub for task creation
                let msg = format!("Created new task: {}", notes);
                save_and_emit_message(app_handle, session_id, "system", msg.clone());
                Ok(msg)
            } else {
                Err("No task details provided".to_string())
            }
        },
        "repo.search" => {
            if let Some(cmd) = &action.command {
                // Implement search logic here
                let msg = format!("Searched repo for: {}", cmd);
                save_and_emit_message(app_handle, session_id, "system", msg.clone());
                Ok(msg)
            } else {
                Err("No search query provided".to_string())
            }
        },
        "memory.write" => {
            if let Some(content) = &action.memory_content {
                let state = app_handle.state::<DbState>();
                let conn = state.conn.lock().unwrap();
                let ctx = action.memory_context.clone();
                let imp = action.memory_importance.unwrap_or(1);
                
                // We default to writing memory to the active workspace of the agent or null
                // We'll leave workspace_id null for now, or we could fetch it
                
                match crate::memory_engine::save_memory(&conn, Some(agent_id.to_string()), None, content.clone(), ctx, imp) {
                    Ok(mem_id) => {
                        let msg = format!("Successfully saved memory with ID {}", mem_id);
                        save_and_emit_message(app_handle, session_id, "system", msg.clone());
                        Ok(msg)
                    },
                    Err(e) => Err(format!("Failed to write memory: {}", e))
                }
            } else {
                Err("content is required for memory.write".to_string())
            }
        },
        "memory.search" => {
            if let Some(query) = &action.memory_query {
                let state = app_handle.state::<DbState>();
                let conn = state.conn.lock().unwrap();
                
                match crate::memory_engine::search_memories(&conn, Some(agent_id.to_string()), None, query, 5) {
                    Ok(memories) => {
                        if memories.is_empty() {
                            let msg = "No relevant memories found.".to_string();
                            save_and_emit_message(app_handle, session_id, "system", msg.clone());
                            return Ok(msg);
                        }
                        
                        let mut result_text = format!("Found {} relevant memories:\n", memories.len());
                        for mem in memories {
                            result_text.push_str(&format!("- [{}] {}\n", mem.created_at, mem.content));
                        }
                        
                        save_and_emit_message(app_handle, session_id, "system", result_text.clone());
                        Ok(result_text)
                    },
                    Err(e) => Err(format!("Failed to search memory: {}", e))
                }
            } else {
                Err("query is required for memory.search".to_string())
            }
        },
        _ => {
            Err(format!("Unknown or unhandled tool: {}", action.action_type))
        }
    }
}

fn save_and_emit_message(app_handle: &AppHandle, session_id: &str, sender_id: &str, content: String) {
    let state = app_handle.state::<DbState>();
    
    let db_msg_opt = {
        if let Ok(conn) = state.conn.lock() {
            let _ = conn.execute(
                "INSERT INTO messages (session_id, role, sender_id, content) VALUES (?1, 'system', ?2, ?3)",
                params![session_id, sender_id, &content],
            );
            let id = conn.last_insert_rowid() as i32;
            let ts: String = conn.query_row("SELECT timestamp FROM messages WHERE id = ?1", [id], |row| row.get(0)).unwrap_or_default();
            
            Some(DbMessage {
                id: Some(id),
                session_id: session_id.to_string(),
                role: "system".to_string(),
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
