use rusqlite::{Connection, params};
use tauri::{AppHandle, State, Manager};
use std::process::Command;

use crate::storage::DbState;
use crate::agent_contracts::AgentContract;
use crate::chat_service::AgentAction;
use crate::event_bus::{emit_event, AppEvent};
use crate::chat_service::DbMessage;

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
                // Check dangerous commands
                if cmd_str.contains("rm -rf /") {
                    return Err("Command execution rejected by safety rules".to_string());
                }

                println!("[TOOL CONTROLLER] Agent {} executing: {}", agent_id, cmd_str);
                
                let output = Command::new("sh")
                    .arg("-c")
                    .arg(cmd_str)
                    .output()
                    .map_err(|e| e.to_string())?;

                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();

                let mut result_text = String::new();
                if !stdout.is_empty() {
                    result_text.push_str(&format!("STDOUT:\n{}\n", stdout));
                }
                if !stderr.is_empty() {
                    result_text.push_str(&format!("STDERR:\n{}\n", stderr));
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
                // Here we would use `resolve_path` safely
                // But for safety in this stub, let's just log it or simulate it if it's restricted
                println!("[TOOL CONTROLLER] Agent {} writing file: {}", agent_id, path);
                
                std::fs::write(path, content).map_err(|e| format!("Failed to write file: {}", e))?;
                
                let msg = format!("Successfully wrote to {}", path);
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
                save_and_emit_message(app_handle, session_id, "system", format!("Message delivered: {}", content));
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
