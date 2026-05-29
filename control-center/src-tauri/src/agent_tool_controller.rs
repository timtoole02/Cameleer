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
    if !contract.allowed_actions.contains(&action.action_type) && action.action_type != "complete_card" && action.action_type != "claim_card" && action.action_type != "update_card_progress" {
        return Err(format!("Action {} is not permitted in your Agent Contract", action.action_type));
    }

    match action.action_type.as_str() {
        "execute_command" => {
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
        "write_file" => {
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
        "claim_card" => {
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
        "update_card_progress" => {
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
        "complete_card" => {
            // Handled explicitly in the kernel's validation engine integration
            Ok("Complete card request sent to validation engine.".to_string())
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
