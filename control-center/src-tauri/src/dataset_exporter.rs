use crate::storage::DbState;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::Write;
use tauri::State;

#[derive(Serialize, Deserialize, Debug)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct ChatDatasetEntry {
    pub messages: Vec<ChatMessage>,
}

#[tauri::command]
pub fn export_finetuning_dataset(
    state: State<'_, DbState>,
    export_path: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // We query the agent_runs table where state is completed and we have input, plan, and final_answer
    let mut stmt = conn
        .prepare("SELECT input, plan, final_answer FROM agent_runs WHERE state = 'completed' AND error IS NULL")
        .map_err(|e| e.to_string())?;

    let runs_iter = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, Option<String>>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut file = File::create(&export_path).map_err(|e| e.to_string())?;

    let mut count = 0;
    for run in runs_iter {
        if let Ok((Some(input), plan, Some(final_answer))) = run {
            let plan_str = plan.unwrap_or_default();

            // Build the assistant response
            let assistant_response = if plan_str.trim().is_empty() {
                final_answer
            } else {
                format!("Plan:\n{}\n\nResponse:\n{}", plan_str, final_answer)
            };

            let entry = ChatDatasetEntry {
                messages: vec![
                    ChatMessage {
                        role: "system".to_string(),
                        content: "You are an expert AI software engineer and architect working autonomously on a complex task.".to_string(),
                    },
                    ChatMessage {
                        role: "user".to_string(),
                        content: input,
                    },
                    ChatMessage {
                        role: "assistant".to_string(),
                        content: assistant_response,
                    },
                ],
            };

            let json_line = serde_json::to_string(&entry).map_err(|e| e.to_string())?;
            writeln!(file, "{}", json_line).map_err(|e| e.to_string())?;
            count += 1;
        }
    }

    // Export a few agent_run_steps as well if needed? No, agent_runs holds the final input and plan.
    // If the user wants a large dataset, we could also format agent_run_steps, but agent_runs is the main loop.
    // For now, exporting agent_runs is enough.

    if count == 0 {
        return Err("No valid completed runs found to export.".to_string());
    }

    Ok(())
}
