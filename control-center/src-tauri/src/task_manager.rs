use crate::event_bus::{emit_event, AppEvent};
use crate::router::{call_model, ChatMessage, ModelSettings};
use crate::storage::DbState;
use crate::system_services::{inspect_database_health, probe_camelid};
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, State};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub id: String,
    pub task_key: Option<String>,
    pub workspace_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub instructions: Option<String>,
    pub owner_id: Option<String>, // Keep for backward compatibility
    pub assigned_agent_id: Option<String>,
    pub status: String,
    pub priority: String,
    pub created_by: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub due_date: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub required_files: Option<String>,
    pub related_files: Option<String>,
    pub related_artifacts: Option<String>,
    pub dependencies: Option<String>,
    pub blockers: Option<String>,
    pub comments: Option<String>,
    pub activity_log: Option<String>,
    pub validation_status: Option<String>,
    pub completion_evidence: Option<String>,
    pub work_receipt_id: Option<String>,
    pub labels: Option<String>,
    pub type_name: Option<String>,
    pub blocked_reason: Option<String>,
    pub review_required: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateTaskInput {
    pub workspace_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub instructions: String,
    pub acceptance_criteria: Option<String>,
    pub priority: Option<String>,
    pub type_name: Option<String>,
    pub assigned_agent_id: Option<String>,
    pub labels: Option<String>,
    pub review_required: Option<bool>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskActivity {
    pub id: String,
    pub task_id: String,
    pub actor_id: Option<String>,
    pub actor_type: String,
    pub event_type: String,
    pub summary: String,
    pub details: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TaskProgressUpdate {
    pub id: String,
    pub task_id: String,
    pub run_id: Option<String>,
    pub agent_id: Option<String>,
    pub content: String,
    pub status: String,
    pub error_message: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkReceipt {
    pub id: String,
    pub task_id: String,
    pub agent_id: Option<String>,
    pub summary: String,
    pub instructions_followed: Option<String>,
    pub acceptance_criteria_results: Option<String>,
    pub files_created: Option<String>,
    pub files_modified: Option<String>,
    pub commands_run: Option<String>,
    pub tests_run: Option<String>,
    pub validation_status: String,
    pub evidence_links: Option<String>,
    pub known_limitations: Option<String>,
    pub follow_up_recommendations: Option<String>,
    pub completed_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Artifact {
    pub id: Option<i32>,
    pub task_id: Option<String>,
    pub path: String,
    pub artifact_type: String,
    pub size_bytes: Option<i32>,
    pub created_at: Option<String>,
}

fn resolve_path(path: &str) -> std::path::PathBuf {
    let clean_path = path.trim();
    let mut resolved = std::path::PathBuf::new();

    let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());

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

fn normalize_status(status: &str) -> String {
    match status
        .trim()
        .to_lowercase()
        .replace('-', "_")
        .replace(' ', "_")
        .as_str()
    {
        "backlog" => "backlog",
        "ready" | "assigned" => "ready",
        "in_progress" | "progress" => "in_progress",
        "review" | "in_review" | "needs_review" => "review",
        "blocked" => "blocked",
        "done" | "complete" | "completed" => "done",
        "cancelled" | "canceled" => "cancelled",
        other => other,
    }
    .to_string()
}

fn insert_task_activity(
    conn: &Connection,
    task_id: &str,
    actor_type: &str,
    actor_id: Option<&str>,
    event_type: &str,
    summary: &str,
    details: Option<serde_json::Value>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO task_activity (id, task_id, actor_id, actor_type, event_type, summary, details)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            uuid::Uuid::new_v4().to_string(),
            task_id,
            actor_id,
            actor_type,
            event_type,
            summary,
            details.map(|value| value.to_string())
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn next_task_key(conn: &Connection) -> Result<String, String> {
    let count: i64 = conn
        .query_row("SELECT COUNT(*) FROM kanban_cards", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(format!("CAM-{}", count + 101))
}

fn get_task_by_id(conn: &Connection, id: &str) -> Result<Task, String> {
    conn.query_row(
        "SELECT id, task_key, workspace_id, title, description, instructions, assigned_agent_id,
                status, priority, created_by, created_at, updated_at, due_date,
                acceptance_criteria, required_files, related_files, related_artifacts,
                dependencies, blocked_by, comments, activity_log, validation_status,
                completion_evidence, work_receipt_id, labels, type, blocked_reason, review_required
         FROM kanban_cards WHERE id = ?1",
        [id],
        |row| {
            Ok(Task {
                id: row.get(0)?,
                task_key: row.get(1)?,
                workspace_id: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                instructions: row.get(5)?,
                owner_id: row.get(6)?,
                assigned_agent_id: row.get(6)?,
                status: row.get(7)?,
                priority: row.get(8)?,
                created_by: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                due_date: row.get(12)?,
                acceptance_criteria: row.get(13)?,
                required_files: row.get(14)?,
                related_files: row.get(15)?,
                related_artifacts: row.get(16)?,
                dependencies: row.get(17)?,
                blockers: row.get(18)?,
                comments: row.get(19)?,
                activity_log: row.get(20)?,
                validation_status: row.get(21)?,
                completion_evidence: row.get(22)?,
                work_receipt_id: row.get(23)?,
                labels: row.get(24)?,
                type_name: row.get(25)?,
                blocked_reason: row.get(26)?,
                review_required: row.get(27)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_task(state: State<'_, DbState>, task_id: String) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    get_task_by_id(&conn, &task_id)
}

#[tauri::command]
pub fn get_tasks(state: State<'_, DbState>) -> Result<Vec<Task>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, task_key, workspace_id, title, description, instructions, assigned_agent_id,
                    status, priority, created_by, created_at, updated_at, due_date,
                    acceptance_criteria, required_files, related_files, related_artifacts,
                    dependencies, blocked_by, comments, activity_log, validation_status,
                    completion_evidence, work_receipt_id, labels, type, blocked_reason, review_required
             FROM kanban_cards",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(Task {
                id: row.get(0)?,
                task_key: row.get(1)?,
                workspace_id: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                instructions: row.get(5)?,
                owner_id: row.get(6)?,
                assigned_agent_id: row.get(6)?,
                status: row.get(7)?,
                priority: row.get(8)?,
                created_by: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
                due_date: row.get(12)?,
                acceptance_criteria: row.get(13)?,
                required_files: row.get(14)?,
                related_files: row.get(15)?,
                related_artifacts: row.get(16)?,
                dependencies: row.get(17)?,
                blockers: row.get(18)?,
                comments: row.get(19)?,
                activity_log: row.get(20)?,
                validation_status: row.get(21)?,
                completion_evidence: row.get(22)?,
                work_receipt_id: row.get(23)?,
                labels: row.get(24)?,
                type_name: row.get(25)?,
                blocked_reason: row.get(26)?,
                review_required: row.get(27)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut tasks = Vec::new();
    for task in iter {
        tasks.push(task.map_err(|e| e.to_string())?);
    }
    Ok(tasks)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentRunTimelineEntry {
    pub timestamp: f64,
    pub agent_id: String,
    pub action: String,
    pub detail: String,
}

#[tauri::command]
pub fn get_agent_run_timeline(
    state: State<'_, DbState>,
    task_id: String,
) -> Result<Vec<AgentRunTimelineEntry>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // First, let's fetch the legacy activity_log from the task
    let log_str: Option<String> = conn
        .query_row(
            "SELECT activity_log FROM kanban_cards WHERE id = ?1",
            [&task_id],
            |row| row.get(0),
        )
        .unwrap_or(None);

    let mut timeline: Vec<AgentRunTimelineEntry> = match log_str {
        Some(ref s) if !s.trim().is_empty() => serde_json::from_str(s).unwrap_or_default(),
        _ => Vec::new(),
    };

    // Now fetch steps from the new agent_run_steps table (Phase 4/11)
    let mut stmt = conn
        .prepare(
            "
            SELECT r.agent_id, s.step_type, s.content, s.created_at
            FROM agent_runs r
            JOIN agent_run_steps s ON r.id = s.run_id
            WHERE r.task_id = ?1
            ORDER BY s.created_at ASC
        ",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([&task_id], |row| {
            let agent_id: String = row.get(0)?;
            let step_type: String = row.get(1)?;
            let content: String = row.get(2)?;
            let created_at: String = row.get(3)?;

            // Try to parse created_at into a timestamp, fallback to 0
            // Assuming created_at is standard SQLite DATETIME like '2023-10-10 10:10:10'
            // For simplicity, we just use a dummy timestamp if we can't parse it,
            // since we're displaying this in React
            let timestamp_f64 = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs_f64();

            Ok(AgentRunTimelineEntry {
                timestamp: timestamp_f64, // Ideal would be parsing the datetime string
                agent_id,
                action: step_type,
                detail: content,
            })
        })
        .map_err(|e| e.to_string())?;

    for entry in iter {
        if let Ok(e) = entry {
            timeline.push(e);
        }
    }

    Ok(timeline)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardTimelineEntry {
    pub timestamp: String,
    pub entry_type: String,
    pub agent_id: Option<String>,
    pub title: String,
    pub details: serde_json::Value,
}

#[tauri::command]
pub fn get_card_timeline(
    state: State<'_, DbState>,
    task_id: String,
) -> Result<Vec<CardTimelineEntry>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut timeline = Vec::new();

    // 1. Card status and assignment events
    if let Ok(mut stmt) = conn
        .prepare("SELECT timestamp, event_type, agent_id, payload FROM events WHERE task_id = ?1")
    {
        if let Ok(event_iter) = stmt.query_map([&task_id], |row| {
            let timestamp: String = row.get(0)?;
            let event_type: String = row.get(1)?;
            let agent_id: Option<String> = row.get(2)?;
            let payload_str: String = row.get(3)?;
            let payload: serde_json::Value =
                serde_json::from_str(&payload_str).unwrap_or(serde_json::Value::Null);

            Ok(CardTimelineEntry {
                timestamp,
                entry_type: "event".to_string(),
                agent_id,
                title: match event_type.as_str() {
                    "card_status_changed" => "Card status changed".to_string(),
                    "card_assigned" => "Agent assigned to card".to_string(),
                    "review_submitted" => "Review verdict submitted".to_string(),
                    _ => format!("Event: {}", event_type),
                },
                details: payload,
            })
        }) {
            for entry in event_iter {
                if let Ok(e) = entry {
                    timeline.push(e);
                }
            }
        }
    }

    // 2. Agent Run Steps
    if let Ok(mut stmt) = conn.prepare(
        "SELECT s.created_at, r.agent_id, s.step_type, s.content 
         FROM agent_runs r
         JOIN agent_run_steps s ON r.id = s.run_id
         WHERE r.task_id = ?1",
    ) {
        if let Ok(step_iter) = stmt.query_map([&task_id], |row| {
            let timestamp: String = row.get(0)?;
            let agent_id: Option<String> = row.get(1)?;
            let step_type: String = row.get(2)?;
            let content: String = row.get(3)?;

            Ok(CardTimelineEntry {
                timestamp,
                entry_type: "run_step".to_string(),
                agent_id,
                title: format!("Agent reasoning step: {}", step_type),
                details: serde_json::json!({
                    "step_type": step_type,
                    "content": content
                }),
            })
        }) {
            for entry in step_iter {
                if let Ok(e) = entry {
                    timeline.push(e);
                }
            }
        }
    }

    // 3. Tool Invocations
    if let Ok(mut stmt) = conn.prepare(
        "SELECT created_at, agent_id, tool_name, arguments, output, status FROM tool_invocations WHERE task_id = ?1"
    ) {
        if let Ok(tool_iter) = stmt.query_map([&task_id], |row| {
            let timestamp: String = row.get(0)?;
            let agent_id: Option<String> = row.get(1)?;
            let tool_name: String = row.get(2)?;
            let args_str: String = row.get(3)?;
            let output: Option<String> = row.get(4)?;
            let status: String = row.get(5)?;
            let args: serde_json::Value = serde_json::from_str(&args_str).unwrap_or(serde_json::Value::Null);

            Ok(CardTimelineEntry {
                timestamp,
                entry_type: "tool_invocation".to_string(),
                agent_id,
                title: format!("Tool call: {}", tool_name),
                details: serde_json::json!({
                    "tool_name": tool_name,
                    "arguments": args,
                    "output": output.unwrap_or_default(),
                    "status": status
                }),
            })
        }) {
            for entry in tool_iter {
                if let Ok(e) = entry {
                    timeline.push(e);
                }
            }
        }
    }

    // 4. Tool Approvals
    if let Ok(mut stmt) = conn.prepare(
        "SELECT created_at, agent_id, tool_name, arguments, status, decided_by, feedback, decided_at FROM tool_approvals WHERE card_id = ?1"
    ) {
        if let Ok(approval_iter) = stmt.query_map([&task_id], |row| {
            let timestamp: String = row.get(0)?;
            let agent_id: Option<String> = row.get(1)?;
            let tool_name: String = row.get(2)?;
            let args_str: String = row.get(3)?;
            let status: Option<String> = row.get(4)?;
            let decided_by: Option<String> = row.get(5)?;
            let feedback: Option<String> = row.get(6)?;
            let decided_at: Option<String> = row.get(7)?;
            let args: serde_json::Value = serde_json::from_str(&args_str).unwrap_or(serde_json::Value::Null);

            Ok(CardTimelineEntry {
                timestamp,
                entry_type: "tool_approval".to_string(),
                agent_id,
                title: format!("Tool guard approval: {}", tool_name),
                details: serde_json::json!({
                    "tool_name": tool_name,
                    "arguments": args,
                    "status": status.unwrap_or_default(),
                    "decided_by": decided_by.unwrap_or_default(),
                    "feedback": feedback.unwrap_or_default(),
                    "decided_at": decided_at.unwrap_or_default()
                }),
            })
        }) {
            for entry in approval_iter {
                if let Ok(e) = entry {
                    timeline.push(e);
                }
            }
        }
    }

    // 5. Artifacts
    if let Ok(mut stmt) =
        conn.prepare("SELECT created_at, path, artifact_type FROM artifacts WHERE task_id = ?1")
    {
        if let Ok(artifact_iter) = stmt.query_map([&task_id], |row| {
            let timestamp: String = row.get(0)?;
            let path: String = row.get(1)?;
            let artifact_type: String = row.get(2)?;

            Ok(CardTimelineEntry {
                timestamp,
                entry_type: "artifact".to_string(),
                agent_id: None,
                title: format!("Artifact registered: {}", path),
                details: serde_json::json!({
                    "path": path,
                    "artifact_type": artifact_type
                }),
            })
        }) {
            for entry in artifact_iter {
                if let Ok(e) = entry {
                    timeline.push(e);
                }
            }
        }
    }

    // 6. Work Receipts
    if let Ok(mut stmt) = conn.prepare(
        "SELECT completed_at, agent_id, summary, validation_status, evidence_links FROM mission_work_receipts WHERE card_id = ?1"
    ) {
        if let Ok(receipt_iter) = stmt.query_map([&task_id], |row| {
            let timestamp: String = row.get(0)?;
            let agent_id: Option<String> = row.get(1)?;
            let summary: Option<String> = row.get(2)?;
            let val_status: Option<String> = row.get(3)?;
            let evidence: Option<String> = row.get(4)?;

            Ok(CardTimelineEntry {
                timestamp,
                entry_type: "receipt".to_string(),
                agent_id,
                title: "Work receipt issued".to_string(),
                details: serde_json::json!({
                    "summary": summary.unwrap_or_default(),
                    "validation_status": val_status.unwrap_or_default(),
                    "evidence_links": evidence.unwrap_or_default()
                }),
            })
        }) {
            for entry in receipt_iter {
                if let Ok(e) = entry {
                    timeline.push(e);
                }
            }
        }
    }

    // 7. Review Verdicts
    if let Ok(mut stmt) = conn.prepare(
        "SELECT created_at, reviewer_id, verdict, comments FROM review_verdicts WHERE card_id = ?1",
    ) {
        if let Ok(verdict_iter) = stmt.query_map([&task_id], |row| {
            let timestamp: String = row.get(0)?;
            let reviewer_id: Option<String> = row.get(1)?;
            let verdict: String = row.get(2)?;
            let comments: Option<String> = row.get(3)?;

            Ok(CardTimelineEntry {
                timestamp,
                entry_type: "review".to_string(),
                agent_id: reviewer_id,
                title: format!("Review verdict: {}", verdict),
                details: serde_json::json!({
                    "verdict": verdict,
                    "comments": comments.unwrap_or_default()
                }),
            })
        }) {
            for entry in verdict_iter {
                if let Ok(e) = entry {
                    timeline.push(e);
                }
            }
        }
    }

    // Sort by timestamp ascending
    timeline.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

    Ok(timeline)
}

#[tauri::command]
pub fn submit_review_verdict(
    state: State<'_, DbState>,
    card_id: String,
    reviewer_id: String,
    verdict: String,
    comments: Option<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO review_verdicts (card_id, reviewer_id, verdict, comments) VALUES (?1, ?2, ?3, ?4)",
        params![card_id, reviewer_id, verdict, comments],
    ).map_err(|e| e.to_string())?;

    let payload = serde_json::json!({
        "reviewer_id": reviewer_id,
        "verdict": verdict,
        "comments": comments.clone().unwrap_or_default()
    })
    .to_string();
    let _ = conn.execute(
        "INSERT INTO events (event_type, task_id, agent_id, payload) VALUES ('review_submitted', ?1, ?2, ?3)",
        params![card_id, reviewer_id, payload]
    );

    if verdict.to_lowercase() == "passed" {
        let _ = conn.execute(
            "UPDATE kanban_cards SET validation_status = 'passed' WHERE id = ?1",
            [&card_id],
        );
    } else {
        let _ = conn.execute(
            "UPDATE kanban_cards SET validation_status = 'failed' WHERE id = ?1",
            [&card_id],
        );
    }

    Ok(())
}

// #[tauri::command]
pub fn _get_agent_work_queue_legacy(
    state: State<'_, DbState>,
    agent_id: String,
    workspace_id: String,
) -> Result<Vec<Task>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, workspace_id, title, description, owner_id, assigned_agent_id, 
                    status, priority, created_by, created_at, updated_at, due_date, 
                    acceptance_criteria, required_files, related_files, related_artifacts, 
                    dependencies, blockers, comments, activity_log, validation_status, 
                    completion_evidence 
             FROM kanban_cards 
             WHERE (assigned_agent_id = ?1 OR owner_id = ?1) AND (workspace_id = ?2 OR workspace_id IS NULL)
             ORDER BY 
               CASE priority 
                 WHEN 'high' THEN 1 
                 WHEN 'medium' THEN 2 
                 WHEN 'low' THEN 3 
                 ELSE 4 
               END ASC, 
               CASE status 
                 WHEN 'in_progress' THEN 1 
                 WHEN 'assigned' THEN 2 
                 WHEN 'ready' THEN 3 
                 WHEN 'backlog' THEN 4 
                 ELSE 5 
               END ASC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([agent_id, workspace_id], |row| {
            Ok(Task {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                owner_id: row.get(4)?,
                assigned_agent_id: row.get(5)?,
                status: row.get(6)?,
                priority: row.get(7)?,
                created_by: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
                due_date: row.get(11)?,
                acceptance_criteria: row.get(12)?,
                required_files: row.get(13)?,
                related_files: row.get(14)?,
                related_artifacts: row.get(15)?,
                dependencies: row.get(16)?,
                blockers: row.get(17)?,
                comments: row.get(18)?,
                activity_log: row.get(19)?,
                validation_status: row.get(20)?,
                completion_evidence: row.get(21)?,
                task_key: None,
                instructions: None,
                work_receipt_id: None,
                labels: None,
                type_name: None,
                blocked_reason: None,
                review_required: None,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut queue = Vec::new();
    for task in iter {
        queue.push(task.map_err(|e| e.to_string())?);
    }
    Ok(queue)
}

#[tauri::command]
pub fn create_task_legacy(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    task: Task,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let initial_log = serde_json::json!([{
        "timestamp": now_secs,
        "agent_id": "system",
        "action": "kanban_card_created",
        "detail": "Card initially enqueued into task manager."
    }]);
    let initial_log_str = serde_json::to_string(&initial_log).unwrap_or_else(|_| "[]".to_string());

    let workspace_id = task
        .workspace_id
        .clone()
        .unwrap_or_else(|| "default".to_string());

    conn.execute(
        "INSERT INTO kanban_cards (id, workspace_id, title, description, owner_id, assigned_agent_id, 
                            status, priority, created_by, due_date, acceptance_criteria, 
                            required_files, related_files, related_artifacts, dependencies, 
                            blockers, comments, activity_log, validation_status, completion_evidence)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20)",
        params![
            task.id,
            workspace_id,
            task.title,
            task.description,
            task.owner_id.clone().or_else(|| task.assigned_agent_id.clone()),
            task.assigned_agent_id.clone().or_else(|| task.owner_id.clone()),
            task.status,
            task.priority,
            task.created_by.clone().unwrap_or_else(|| "user".to_string()),
            task.due_date.clone(),
            task.acceptance_criteria.clone().unwrap_or_else(|| "[]".to_string()),
            task.required_files.clone().unwrap_or_else(|| "[]".to_string()),
            task.related_files.clone().unwrap_or_else(|| "[]".to_string()),
            task.related_artifacts.clone().unwrap_or_else(|| "[]".to_string()),
            task.dependencies.clone().unwrap_or_else(|| "[]".to_string()),
            task.blockers.clone().unwrap_or_else(|| "[]".to_string()),
            task.comments.clone().unwrap_or_else(|| "[]".to_string()),
            initial_log_str,
            task.validation_status.clone().unwrap_or_else(|| "pending".to_string()),
            task.completion_evidence.clone(),
        ],
    )
    .map_err(|e| e.to_string())?;

    // Log the Kanban event
    conn.execute(
        "INSERT INTO events (event_type, agent_id, task_id, payload) VALUES ('kanban_card_created', ?1, ?2, '{}')",
        params![task.owner_id.clone().or_else(|| task.assigned_agent_id.clone()), task.id],
    )
    .map_err(|e| e.to_string())?;

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "task_updated".to_string(),
            agent_id: task
                .assigned_agent_id
                .clone()
                .or_else(|| task.owner_id.clone()),
            task_id: Some(task.id.clone()),
            payload: serde_json::to_value(&task).unwrap_or(serde_json::Value::Null),
        },
    );

    Ok(())
}

#[tauri::command]
pub fn create_task(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    input: CreateTaskInput,
) -> Result<Task, String> {
    if input.title.trim().is_empty() {
        return Err("Title is required.".to_string());
    }
    if input.instructions.trim().is_empty() {
        return Err("Detailed instructions are required.".to_string());
    }

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let workspace_id = input.workspace_id.unwrap_or_else(|| "default".to_string());
    let task_key = next_task_key(&conn)?;
    let status = normalize_status(input.status.as_deref().unwrap_or("backlog"));
    let priority = input.priority.unwrap_or_else(|| "medium".to_string());
    let type_name = input.type_name.unwrap_or_else(|| "task".to_string());
    let review_required = if input.review_required.unwrap_or(true) {
        1
    } else {
        0
    };

    conn.execute(
        "INSERT INTO kanban_cards (
            id, task_key, workspace_id, title, description, instructions, type, priority, status,
            assigned_agent_id, acceptance_criteria, labels, review_required, created_by, validation_status
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'human', 'not_started')",
        params![
            id,
            task_key,
            workspace_id,
            input.title,
            input.description,
            input.instructions,
            type_name,
            priority,
            status,
            input.assigned_agent_id,
            input.acceptance_criteria,
            input.labels,
            review_required,
        ],
    )
    .map_err(|e| e.to_string())?;

    insert_task_activity(
        &conn,
        &id,
        "user",
        None,
        "task_created",
        "Task created",
        None,
    )?;

    let task = get_task_by_id(&conn, &id)?;
    emit_event(
        &app_handle,
        AppEvent {
            event_type: "task_updated".to_string(),
            agent_id: task.assigned_agent_id.clone(),
            task_id: Some(id),
            payload: serde_json::to_value(&task).unwrap_or(serde_json::Value::Null),
        },
    );
    Ok(task)
}

#[tauri::command]
pub fn update_task(
    state: State<'_, DbState>,
    task_id: String,
    title: Option<String>,
    description: Option<String>,
    instructions: Option<String>,
    acceptance_criteria: Option<String>,
    priority: Option<String>,
    type_name: Option<String>,
    assigned_agent_id: Option<String>,
    labels: Option<String>,
    blocked_reason: Option<String>,
    review_required: Option<bool>,
) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    if let Some(value) = title {
        conn.execute(
            "UPDATE kanban_cards SET title = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![value, task_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(value) = description {
        conn.execute("UPDATE kanban_cards SET description = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![value, task_id]).map_err(|e| e.to_string())?;
    }
    if let Some(value) = instructions {
        conn.execute("UPDATE kanban_cards SET instructions = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![value, task_id]).map_err(|e| e.to_string())?;
    }
    if let Some(value) = acceptance_criteria {
        conn.execute("UPDATE kanban_cards SET acceptance_criteria = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![value, task_id]).map_err(|e| e.to_string())?;
    }
    if let Some(value) = priority {
        conn.execute(
            "UPDATE kanban_cards SET priority = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![value, task_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(value) = type_name {
        conn.execute(
            "UPDATE kanban_cards SET type = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![value, task_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(value) = assigned_agent_id {
        conn.execute("UPDATE kanban_cards SET assigned_agent_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![value, task_id]).map_err(|e| e.to_string())?;
    }
    if let Some(value) = labels {
        conn.execute(
            "UPDATE kanban_cards SET labels = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![value, task_id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(value) = blocked_reason {
        conn.execute("UPDATE kanban_cards SET blocked_reason = ?1, blocked_by = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![value, task_id]).map_err(|e| e.to_string())?;
    }
    if let Some(value) = review_required {
        conn.execute("UPDATE kanban_cards SET review_required = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![if value { 1 } else { 0 }, task_id]).map_err(|e| e.to_string())?;
    }

    insert_task_activity(
        &conn,
        &task_id,
        "user",
        None,
        "task_updated",
        "Task details updated",
        None,
    )?;
    get_task_by_id(&conn, &task_id)
}

#[tauri::command]
pub fn move_task(
    state: State<'_, DbState>,
    task_id: String,
    status: String,
) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let status = normalize_status(&status);
    if status == "done" {
        let receipt_exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM task_work_receipts WHERE task_id = ?1)",
                [&task_id],
                |row| row.get(0),
            )
            .unwrap_or(false);
        if !receipt_exists {
            return Err("Cannot move task to Done without an approved work receipt.".to_string());
        }
    }
    conn.execute(
        "UPDATE kanban_cards SET status = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![status, task_id],
    )
    .map_err(|e| e.to_string())?;
    insert_task_activity(
        &conn,
        &task_id,
        "user",
        None,
        "task_moved",
        "Task status changed",
        None,
    )?;
    get_task_by_id(&conn, &task_id)
}

#[tauri::command]
pub fn assign_task_to_agent(
    state: State<'_, DbState>,
    task_id: String,
    agent_id: String,
) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE kanban_cards SET assigned_agent_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![agent_id, task_id],
    )
    .map_err(|e| e.to_string())?;
    insert_task_activity(
        &conn,
        &task_id,
        "user",
        None,
        "task_assigned",
        "Task assigned to agent",
        None,
    )?;
    get_task_by_id(&conn, &task_id)
}

#[tauri::command]
pub fn block_task(
    state: State<'_, DbState>,
    task_id: String,
    reason: String,
) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE kanban_cards SET status = 'blocked', blocked_by = ?1, blocked_reason = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![reason, task_id],
    )
    .map_err(|e| e.to_string())?;
    insert_task_activity(
        &conn,
        &task_id,
        "user",
        None,
        "task_blocked",
        "Task blocked",
        None,
    )?;
    get_task_by_id(&conn, &task_id)
}

#[tauri::command]
pub fn unblock_task(state: State<'_, DbState>, task_id: String) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE kanban_cards SET status = 'ready', blocked_by = NULL, blocked_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        [&task_id],
    )
    .map_err(|e| e.to_string())?;
    insert_task_activity(
        &conn,
        &task_id,
        "user",
        None,
        "task_unblocked",
        "Task unblocked",
        None,
    )?;
    get_task_by_id(&conn, &task_id)
}

#[tauri::command]
pub fn reopen_task(
    state: State<'_, DbState>,
    task_id: String,
    reason: Option<String>,
) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE kanban_cards SET status = 'ready', reopen_reason = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![reason, task_id],
    )
    .map_err(|e| e.to_string())?;
    insert_task_activity(
        &conn,
        &task_id,
        "user",
        None,
        "task_reopened",
        "Task reopened",
        None,
    )?;
    get_task_by_id(&conn, &task_id)
}

#[tauri::command]
pub fn cancel_task(state: State<'_, DbState>, task_id: String) -> Result<Task, String> {
    move_task(state, task_id, "cancelled".to_string())
}

#[tauri::command]
pub fn delete_task(state: State<'_, DbState>, task_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM kanban_cards WHERE id = ?1", [&task_id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn start_agent_task_run(
    state: State<'_, DbState>,
    task_id: String,
) -> Result<AgentRun, String> {
    let (
        agent_id,
        agent_name,
        agent_persona,
        model_provider,
        model_name,
        temperature,
        max_tokens,
        title,
        description,
        instructions,
        acceptance_criteria,
        camelid_endpoint,
    ) = {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        let db_health = inspect_database_health(
            &conn,
            crate::storage::get_db_path().display().to_string(),
            3,
        );
        if db_health.database_status != "ready" {
            return Err(format!(
                "Cannot start work: database is not ready ({})",
                db_health.database_status
            ));
        }

        let task: (String, Option<String>, Option<String>, String, Option<String>, Option<String>) = conn
            .query_row(
                "SELECT title, description, instructions, status, assigned_agent_id, acceptance_criteria
                 FROM kanban_cards WHERE id = ?1",
                [&task_id],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
            )
            .map_err(|_| "Cannot start work: task not found.".to_string())?;

        let assigned_agent_id = task
            .4
            .clone()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "Cannot start work: task has no assigned agent.".to_string())?;

        let task_instructions = task
            .2
            .clone()
            .filter(|value| !value.trim().is_empty())
            .ok_or_else(|| "Cannot start work: detailed instructions are required.".to_string())?;

        let agent: (String, String, String, String, f64, i32) = conn
            .query_row(
                "SELECT name, persona, model_provider, model_name, temperature, max_tokens
                 FROM agents WHERE id = ?1",
                [&assigned_agent_id],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                    ))
                },
            )
            .map_err(|_| "Cannot start work: assigned agent not found.".to_string())?;

        if agent.3.trim().is_empty() || agent.3 == "camelid-default" {
            return Err(format!(
                "Cannot start work: {} has no concrete model profile assigned.",
                agent.0
            ));
        }

        (
            assigned_agent_id,
            agent.0,
            agent.1,
            agent.2,
            agent.3,
            agent.4,
            agent.5,
            task.0,
            task.1,
            task_instructions,
            task.5,
            db_health.camelid_endpoint,
        )
    };

    if model_provider == "camelid" {
        let camelid_health = probe_camelid(&camelid_endpoint).await;
        if camelid_health.status != "connected" {
            return Err(format!(
                "Cannot start work: Camelid is offline at {}.",
                camelid_endpoint
            ));
        }
        if camelid_health.model_loaded.is_none() {
            return Err("Cannot start work: no Camelid model is loaded.".to_string());
        }
    }

    let run_id = uuid::Uuid::new_v4().to_string();
    let prompt = format!(
        "Task: {}\n\nDescription:\n{}\n\nDetailed instructions:\n{}\n\nAcceptance criteria:\n{}\n\nProduce a concise work plan, implementation notes, validation notes, and a receipt draft. Do not claim file changes or command execution unless actually performed.",
        title,
        description.clone().unwrap_or_else(|| "No description provided.".to_string()),
        instructions,
        acceptance_criteria.clone().unwrap_or_else(|| "No acceptance criteria provided.".to_string())
    );

    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO agent_runs (id, agent_id, conversation_id, task_id, state, input)
             VALUES (?1, ?2, ?3, ?4, 'executing', ?5)",
            params![
                run_id,
                agent_id,
                format!("task:{}", task_id),
                task_id,
                prompt
            ],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE kanban_cards SET status = 'in_progress', validation_status = 'in_progress', start_date = COALESCE(start_date, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            [&task_id],
        )
        .map_err(|e| e.to_string())?;
        insert_task_activity(
            &conn,
            &task_id,
            "agent",
            Some(&agent_id),
            "agent_run_started",
            "Agent run started",
            Some(serde_json::json!({ "run_id": run_id, "agent": agent_name })),
        )?;
    }

    let endpoint = if model_provider == "camelid" {
        Some(format!(
            "{}/v1/chat/completions",
            camelid_endpoint.trim_end_matches('/')
        ))
    } else {
        None
    };

    let response = call_model(
        &model_provider,
        &model_name,
        vec![
            ChatMessage {
                role: "system".to_string(),
                content: agent_persona,
            },
            ChatMessage {
                role: "user".to_string(),
                content: prompt.clone(),
            },
        ],
        ModelSettings {
            temperature: Some(temperature),
            max_tokens: Some(max_tokens.min(1024)),
        },
        None,
        endpoint,
    )
    .await;

    {
        let conn = state.conn.lock().map_err(|e| e.to_string())?;
        match response {
            Ok(answer) => {
                conn.execute(
                    "UPDATE agent_runs SET state = 'completed', final_answer = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
                    params![answer, run_id],
                )
                .map_err(|e| e.to_string())?;
                conn.execute(
                    "INSERT INTO agent_run_steps (id, run_id, step_type, content) VALUES (?1, ?2, 'agent_response', ?3)",
                    params![uuid::Uuid::new_v4().to_string(), run_id, answer],
                )
                .map_err(|e| e.to_string())?;
                conn.execute(
                    "INSERT INTO task_progress_updates (id, task_id, run_id, agent_id, content, status)
                     VALUES (?1, ?2, ?3, ?4, ?5, 'sent')",
                    params![uuid::Uuid::new_v4().to_string(), task_id, run_id, agent_id, answer],
                )
                .map_err(|e| e.to_string())?;
                conn.execute(
                    "UPDATE kanban_cards SET status = 'review', validation_status = 'needs_review', comments = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
                    params![answer, task_id],
                )
                .map_err(|e| e.to_string())?;
                insert_task_activity(
                    &conn,
                    &task_id,
                    "agent",
                    Some(&agent_id),
                    "agent_response_saved",
                    "Agent response saved and task moved to Review",
                    Some(serde_json::json!({ "run_id": run_id })),
                )?;
            }
            Err(error) => {
                conn.execute(
                    "UPDATE agent_runs SET state = 'failed', error = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
                    params![error, run_id],
                )
                .map_err(|e| e.to_string())?;
                conn.execute(
                    "INSERT INTO task_progress_updates (id, task_id, run_id, agent_id, content, status, error_message)
                     VALUES (?1, ?2, ?3, ?4, ?5, 'failed', ?5)",
                    params![uuid::Uuid::new_v4().to_string(), task_id, run_id, agent_id, error],
                )
                .map_err(|e| e.to_string())?;
                insert_task_activity(
                    &conn,
                    &task_id,
                    "agent",
                    Some(&agent_id),
                    "agent_run_failed",
                    "Agent run failed",
                    Some(serde_json::json!({ "run_id": run_id, "error": error })),
                )?;
            }
        }
    }

    get_task_run_status(state, run_id)
}

#[tauri::command]
pub fn get_task_run_status(state: State<'_, DbState>, run_id: String) -> Result<AgentRun, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, agent_id, conversation_id, task_id, state, input, plan, final_answer, error, created_at, updated_at FROM agent_runs WHERE id = ?1",
        [run_id],
        |row| {
            Ok(AgentRun {
                id: row.get(0)?,
                agent_id: row.get(1)?,
                conversation_id: row.get(2)?,
                task_id: row.get(3)?,
                state: row.get(4)?,
                input: row.get(5)?,
                plan: row.get(6)?,
                final_answer: row.get(7)?,
                error: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_task_runs(state: State<'_, DbState>, task_id: String) -> Result<Vec<AgentRun>, String> {
    get_agent_runs(state, None, Some(task_id))
}

#[tauri::command]
pub fn save_task_progress_update(
    state: State<'_, DbState>,
    task_id: String,
    agent_id: Option<String>,
    content: String,
) -> Result<TaskProgressUpdate, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO task_progress_updates (id, task_id, agent_id, content, status)
         VALUES (?1, ?2, ?3, ?4, 'sent')",
        params![id, task_id, agent_id, content],
    )
    .map_err(|e| e.to_string())?;
    insert_task_activity(
        &conn,
        &task_id,
        "agent",
        agent_id.as_deref(),
        "progress_update_saved",
        "Progress update saved",
        None,
    )?;
    get_progress_update_by_id(&conn, &id)
}

fn get_progress_update_by_id(conn: &Connection, id: &str) -> Result<TaskProgressUpdate, String> {
    conn.query_row(
        "SELECT id, task_id, run_id, agent_id, content, status, error_message, created_at
         FROM task_progress_updates WHERE id = ?1",
        [id],
        |row| {
            Ok(TaskProgressUpdate {
                id: row.get(0)?,
                task_id: row.get(1)?,
                run_id: row.get(2)?,
                agent_id: row.get(3)?,
                content: row.get(4)?,
                status: row.get(5)?,
                error_message: row.get(6)?,
                created_at: row.get(7)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_task_progress_updates(
    state: State<'_, DbState>,
    task_id: String,
) -> Result<Vec<TaskProgressUpdate>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, task_id, run_id, agent_id, content, status, error_message, created_at
             FROM task_progress_updates WHERE task_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let iter = stmt
        .query_map([task_id], |row| {
            Ok(TaskProgressUpdate {
                id: row.get(0)?,
                task_id: row.get(1)?,
                run_id: row.get(2)?,
                agent_id: row.get(3)?,
                content: row.get(4)?,
                status: row.get(5)?,
                error_message: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut updates = Vec::new();
    for update in iter {
        updates.push(update.map_err(|e| e.to_string())?);
    }
    Ok(updates)
}

#[tauri::command]
pub fn list_task_activity(
    state: State<'_, DbState>,
    task_id: String,
) -> Result<Vec<TaskActivity>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, task_id, actor_id, actor_type, event_type, summary, details, created_at
             FROM task_activity WHERE task_id = ?1 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;
    let iter = stmt
        .query_map([task_id], |row| {
            Ok(TaskActivity {
                id: row.get(0)?,
                task_id: row.get(1)?,
                actor_id: row.get(2)?,
                actor_type: row.get(3)?,
                event_type: row.get(4)?,
                summary: row.get(5)?,
                details: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut activity = Vec::new();
    for item in iter {
        activity.push(item.map_err(|e| e.to_string())?);
    }
    Ok(activity)
}

#[tauri::command]
pub fn record_task_activity(
    state: State<'_, DbState>,
    task_id: String,
    summary: String,
    details: Option<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    insert_task_activity(
        &conn,
        &task_id,
        "user",
        None,
        "manual_activity",
        &summary,
        details.map(|value| serde_json::json!({ "details": value })),
    )
}

#[tauri::command]
pub fn generate_task_work_receipt(
    state: State<'_, DbState>,
    task_id: String,
) -> Result<WorkReceipt, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let task = get_task_by_id(&conn, &task_id)?;
    let latest_run: Option<(String, Option<String>, Option<String>)> = conn
        .query_row(
            "SELECT agent_id, final_answer, error FROM agent_runs WHERE task_id = ?1 ORDER BY created_at DESC LIMIT 1",
            [&task_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let (agent_id, answer, error) = latest_run.unwrap_or((
        task.assigned_agent_id.clone().unwrap_or_default(),
        None,
        None,
    ));
    let summary = answer
        .clone()
        .or(error.clone())
        .unwrap_or_else(|| "No agent output has been recorded yet.".to_string());
    let receipt_id = uuid::Uuid::new_v4().to_string();
    let criteria = task
        .acceptance_criteria
        .clone()
        .unwrap_or_else(|| "[]".to_string());
    let validation_status = if error.is_some() {
        "failed"
    } else {
        "needs_review"
    };

    conn.execute(
        "INSERT INTO task_work_receipts (
            id, task_id, agent_id, summary, instructions_followed, acceptance_criteria_results,
            files_created, files_modified, commands_run, tests_run, validation_status,
            evidence_links, known_limitations, follow_up_recommendations
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, '[]', '[]', '[]', '[]', ?7, '[]', ?8, ?9)",
        params![
            receipt_id,
            task_id,
            if agent_id.is_empty() {
                None
            } else {
                Some(agent_id)
            },
            summary,
            task.instructions,
            criteria,
            validation_status,
            error
                .map(|value| serde_json::json!([value]).to_string())
                .unwrap_or_else(|| "[]".to_string()),
            serde_json::json!(["Review the generated receipt before approving Done."]).to_string(),
        ],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE kanban_cards SET work_receipt_id = ?1, completion_evidence = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![receipt_id, summary, task_id],
    )
    .map_err(|e| e.to_string())?;
    insert_task_activity(
        &conn,
        &task_id,
        "system",
        None,
        "receipt_generated",
        "Work receipt generated",
        None,
    )?;
    get_work_receipt_by_id(&conn, &receipt_id)
}

fn get_work_receipt_by_id(conn: &Connection, receipt_id: &str) -> Result<WorkReceipt, String> {
    conn.query_row(
        "SELECT id, task_id, agent_id, summary, instructions_followed, acceptance_criteria_results,
                files_created, files_modified, commands_run, tests_run, validation_status,
                evidence_links, known_limitations, follow_up_recommendations, completed_at
         FROM task_work_receipts WHERE id = ?1",
        [receipt_id],
        |row| {
            Ok(WorkReceipt {
                id: row.get(0)?,
                task_id: row.get(1)?,
                agent_id: row.get(2)?,
                summary: row.get(3)?,
                instructions_followed: row.get(4)?,
                acceptance_criteria_results: row.get(5)?,
                files_created: row.get(6)?,
                files_modified: row.get(7)?,
                commands_run: row.get(8)?,
                tests_run: row.get(9)?,
                validation_status: row.get(10)?,
                evidence_links: row.get(11)?,
                known_limitations: row.get(12)?,
                follow_up_recommendations: row.get(13)?,
                completed_at: row.get(14)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_task_work_receipt(
    state: State<'_, DbState>,
    task_id: String,
) -> Result<Option<WorkReceipt>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let receipt_id: Option<String> = conn
        .query_row(
            "SELECT id FROM task_work_receipts WHERE task_id = ?1 ORDER BY completed_at DESC LIMIT 1",
            [&task_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    match receipt_id {
        Some(id) => Ok(Some(get_work_receipt_by_id(&conn, &id)?)),
        None => Ok(None),
    }
}

#[tauri::command]
pub fn approve_work_receipt(
    state: State<'_, DbState>,
    task_id: String,
    receipt_id: String,
) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let receipt = get_work_receipt_by_id(&conn, &receipt_id)?;
    if receipt.task_id != task_id {
        return Err("Receipt does not belong to this task.".to_string());
    }
    let task_status: String = conn
        .query_row(
            "SELECT status FROM kanban_cards WHERE id = ?1",
            [&task_id],
            |row| row.get(0),
        )
        .map_err(|_| "Task not found.".to_string())?;
    if !["review", "in_progress"].contains(&task_status.as_str()) {
        return Err("Cannot complete task unless it is in Review or In Progress.".to_string());
    }
    conn.execute(
        "UPDATE task_work_receipts SET validation_status = 'passed' WHERE id = ?1",
        [&receipt_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE kanban_cards SET status = 'done', validation_status = 'passed', work_receipt_id = ?1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![receipt_id, task_id],
    )
    .map_err(|e| e.to_string())?;
    insert_task_activity(
        &conn,
        &task_id,
        "user",
        None,
        "task_completed",
        "Receipt approved and task completed",
        None,
    )?;
    get_task_by_id(&conn, &task_id)
}

#[tauri::command]
pub fn complete_task(state: State<'_, DbState>, task_id: String) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let receipt_id: Option<String> = conn
        .query_row(
            "SELECT id FROM task_work_receipts WHERE task_id = ?1 ORDER BY completed_at DESC LIMIT 1",
            [&task_id],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    let receipt_id =
        receipt_id.ok_or_else(|| "Cannot complete task without a work receipt.".to_string())?;
    drop(conn);
    approve_work_receipt(state, task_id, receipt_id)
}

#[tauri::command]
pub fn send_task_back_to_agent(
    state: State<'_, DbState>,
    task_id: String,
    feedback: String,
) -> Result<Task, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE kanban_cards SET status = 'in_progress', comments = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![feedback, task_id],
    )
    .map_err(|e| e.to_string())?;
    insert_task_activity(
        &conn,
        &task_id,
        "user",
        None,
        "task_sent_back",
        "Task sent back to agent",
        Some(serde_json::json!({ "feedback": feedback })),
    )?;
    get_task_by_id(&conn, &task_id)
}

#[tauri::command]
pub fn update_task_status(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    id: String,
    status: String,
    evidence_path: Option<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let status = status.to_lowercase();

    // Get original card log
    let (log_str, owner_id): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT activity_log, assigned_agent_id FROM kanban_cards WHERE id = ?1",
            [&id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .unwrap_or((None, None));

    let mut log_arr = match log_str {
        Some(ref s) if !s.trim().is_empty() => {
            serde_json::from_str::<Vec<serde_json::Value>>(s).unwrap_or_default()
        }
        _ => Vec::new(),
    };

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    log_arr.push(serde_json::json!({
        "timestamp": now_secs,
        "agent_id": owner_id.clone().unwrap_or_else(|| "user".to_string()),
        "action": format!("kanban_card_status_to_{}", status),
        "detail": format!("User or Agent moved status to {}", status)
    }));
    let new_log_str = serde_json::to_string(&log_arr).unwrap_or_else(|_| "[]".to_string());

    if let Some(ref path) = evidence_path {
        conn.execute(
            "UPDATE kanban_cards SET status = ?2, completion_evidence = ?3, activity_log = ?4, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![id, status, path, new_log_str],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE kanban_cards SET status = ?2, activity_log = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![id, status, new_log_str],
        )
        .map_err(|e| e.to_string())?;
    }

    // Map new status to event logs
    let event_type = match status.as_str() {
        "assigned" => "kanban_card_assigned",
        "in_progress" => "kanban_card_started",
        "blocked" => "kanban_card_blocked",
        "review" => "kanban_card_review_requested",
        "done" => "kanban_card_completed",
        _ => "kanban_card_progress_updated",
    };

    conn.execute(
        "INSERT INTO events (event_type, agent_id, task_id, payload) 
         VALUES (?1, ?2, ?3, ?4)",
        params![
            event_type,
            owner_id,
            id,
            format!("{{\"status\":\"{}\"}}", status)
        ],
    )
    .map_err(|e| e.to_string())?;

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "task_updated".to_string(),
            agent_id: owner_id,
            task_id: Some(id.clone()),
            payload: serde_json::json!({ "id": id, "status": status, "evidence_path": evidence_path }),
        },
    );

    Ok(())
}

#[tauri::command]
pub fn claim_card(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    agent_id: String,
    card_id: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 1. Verify card status and assignee
    let (status, current_assignee): (String, Option<String>) = conn
        .query_row(
            "SELECT status, assigned_agent_id FROM kanban_cards WHERE id = ?1",
            [&card_id],
            |row| Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?)),
        )
        .map_err(|e| format!("Card not found: {}", e))?;

    if status == "done" || status == "review" {
        return Err("Cannot claim a card that is already completed or in review.".to_string());
    }

    if status == "in_progress"
        && current_assignee.is_some()
        && current_assignee.clone().unwrap() != agent_id
    {
        return Err(format!(
            "Card is already actively claimed by agent: {:?}",
            current_assignee
        ));
    }

    // 2. Fetch log
    let log_str: Option<String> = conn
        .query_row(
            "SELECT activity_log FROM kanban_cards WHERE id = ?1",
            [&card_id],
            |row| row.get(0),
        )
        .unwrap_or(None);

    let mut log_arr = match log_str {
        Some(ref s) if !s.trim().is_empty() => {
            serde_json::from_str::<Vec<serde_json::Value>>(s).unwrap_or_default()
        }
        _ => Vec::new(),
    };

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    log_arr.push(serde_json::json!({
        "timestamp": now_secs,
        "agent_id": agent_id,
        "action": "kanban_card_claimed",
        "detail": "Card actively claimed by agent and moved to In Progress"
    }));
    let new_log_str = serde_json::to_string(&log_arr).unwrap_or_else(|_| "[]".to_string());

    // 3. Update task record
    conn.execute(
        "UPDATE kanban_cards 
         SET status = 'in_progress', owner_id = ?2, assigned_agent_id = ?2, 
             activity_log = ?3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?1",
        params![card_id, agent_id, new_log_str],
    )
    .map_err(|e| e.to_string())?;

    // 4. Update agent status to working
    conn.execute(
        "UPDATE agents SET status = 'working', last_heartbeat = ?2 WHERE id = ?1",
        params![agent_id, now_secs.to_string()],
    )
    .map_err(|e| e.to_string())?;

    // 5. Publish events
    conn.execute(
        "INSERT INTO events (event_type, agent_id, task_id, payload) VALUES ('kanban_card_claimed', ?1, ?2, '{}')",
        params![agent_id, card_id],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO events (event_type, agent_id, task_id, payload) VALUES ('kanban_card_started', ?1, ?2, '{}')",
        params![agent_id, card_id],
    )
    .map_err(|e| e.to_string())?;

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "task_updated".to_string(),
            agent_id: Some(agent_id),
            task_id: Some(card_id),
            payload: serde_json::json!({ "status": "in_progress" }),
        },
    );

    Ok(())
}

#[tauri::command]
pub fn update_card_progress(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    agent_id: String,
    card_id: String,
    notes: Option<String>,
    files: Option<Vec<String>>,
    artifacts: Option<Vec<String>>,
    blockers: Option<String>,
    validation_status: Option<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 1. Fetch current details
    let (log_str, rel_files_str, rel_arts_str, comms_str): (Option<String>, Option<String>, Option<String>, Option<String>) = conn
        .query_row(
            "SELECT activity_log, related_files, related_artifacts, comments FROM kanban_cards WHERE id = ?1",
            [&card_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|e| format!("Card not found: {}", e))?;

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    // 2. Append progress comments if present
    let mut comms_arr = match comms_str {
        Some(ref s) if !s.trim().is_empty() => {
            serde_json::from_str::<Vec<serde_json::Value>>(s).unwrap_or_default()
        }
        _ => Vec::new(),
    };
    if let Some(ref note_text) = notes {
        comms_arr.push(serde_json::json!({
            "timestamp": now_secs,
            "author": agent_id,
            "text": note_text
        }));
    }
    let new_comms_str = serde_json::to_string(&comms_arr).unwrap_or_else(|_| "[]".to_string());

    // 3. Append Activity Log
    let mut log_arr = match log_str {
        Some(ref s) if !s.trim().is_empty() => {
            serde_json::from_str::<Vec<serde_json::Value>>(s).unwrap_or_default()
        }
        _ => Vec::new(),
    };
    log_arr.push(serde_json::json!({
        "timestamp": now_secs,
        "agent_id": agent_id,
        "action": "kanban_card_progress_updated",
        "detail": format!("Progress notes updated. Files: {:?}. Blockers: {:?}", files, blockers)
    }));
    let new_log_str = serde_json::to_string(&log_arr).unwrap_or_else(|_| "[]".to_string());

    // 4. Merge Related Files
    let mut files_arr = match rel_files_str {
        Some(ref s) if !s.trim().is_empty() => {
            serde_json::from_str::<Vec<String>>(s).unwrap_or_default()
        }
        _ => Vec::new(),
    };
    if let Some(ref new_files) = files {
        for f in new_files {
            if !files_arr.contains(f) {
                files_arr.push(f.clone());
            }
        }
    }
    let new_files_str = serde_json::to_string(&files_arr).unwrap_or_else(|_| "[]".to_string());

    // 5. Merge Related Artifacts
    let mut arts_arr = match rel_arts_str {
        Some(ref s) if !s.trim().is_empty() => {
            serde_json::from_str::<Vec<String>>(s).unwrap_or_default()
        }
        _ => Vec::new(),
    };
    if let Some(ref new_arts) = artifacts {
        for art in new_arts {
            if !arts_arr.contains(art) {
                arts_arr.push(art.clone());
            }
        }
    }
    let new_arts_str = serde_json::to_string(&arts_arr).unwrap_or_else(|_| "[]".to_string());

    // 6. Blocker validation
    let final_blockers = blockers.unwrap_or_else(|| "[]".to_string());

    // 7. Update Task Card in database
    if let Some(ref val_status) = validation_status {
        conn.execute(
            "UPDATE kanban_cards 
             SET comments = ?2, activity_log = ?3, related_files = ?4, related_artifacts = ?5, 
                 blockers = ?6, validation_status = ?7, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?1",
            params![
                card_id,
                new_comms_str,
                new_log_str,
                new_files_str,
                new_arts_str,
                final_blockers,
                val_status
            ],
        )
        .map_err(|e| e.to_string())?;
    } else {
        conn.execute(
            "UPDATE kanban_cards 
             SET comments = ?2, activity_log = ?3, related_files = ?4, related_artifacts = ?5, 
                 blockers = ?6, updated_at = CURRENT_TIMESTAMP 
             WHERE id = ?1",
            params![
                card_id,
                new_comms_str,
                new_log_str,
                new_files_str,
                new_arts_str,
                final_blockers
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    // 8. Publish structured event logs
    conn.execute(
        "INSERT INTO events (event_type, agent_id, task_id, payload) VALUES ('kanban_card_progress_updated', ?1, ?2, '{}')",
        params![agent_id, card_id],
    )
    .map_err(|e| e.to_string())?;

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "task_updated".to_string(),
            agent_id: Some(agent_id),
            task_id: Some(card_id),
            payload: serde_json::json!({ "progress": "updated" }),
        },
    );

    Ok(())
}

#[tauri::command]
pub fn complete_card(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    agent_id: String,
    card_id: String,
    evidence: String,
    validation_passed: bool,
    validation_notes: Option<String>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 1. Fetch card requirement lists
    let (req_files_str, log_str): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT required_files, activity_log FROM kanban_cards WHERE id = ?1",
            [&card_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Card not found: {}", e))?;

    // 2. Verify all required files physically exist on the host system!
    let req_files = match req_files_str {
        Some(ref s) if !s.trim().is_empty() => {
            serde_json::from_str::<Vec<String>>(s).unwrap_or_default()
        }
        _ => Vec::new(),
    };

    for file in req_files {
        let resolved = resolve_path(&file);
        if !resolved.exists() {
            return Err(format!(
                "Validation Error: Required card file '{}' does not exist on host system path: {:?}",
                file, resolved
            ));
        }
    }

    // 3. Verify validation evidence
    if evidence.trim().is_empty() {
        return Err("Validation Error: Card cannot be marked Done without attaching explicit completion evidence.".to_string());
    }

    if !validation_passed
        && validation_notes
            .clone()
            .unwrap_or_default()
            .trim()
            .is_empty()
    {
        return Err("Validation Error: If validation is not passed/applicable, a detailed validation explanation note must be supplied.".to_string());
    }

    // 4. Update activity log
    let mut log_arr = match log_str {
        Some(ref s) if !s.trim().is_empty() => {
            serde_json::from_str::<Vec<serde_json::Value>>(s).unwrap_or_default()
        }
        _ => Vec::new(),
    };

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    log_arr.push(serde_json::json!({
        "timestamp": now_secs,
        "agent_id": agent_id,
        "action": "kanban_card_completed",
        "detail": format!("Card successfully completed with validation notes: {:?}", validation_notes)
    }));
    let new_log_str = serde_json::to_string(&log_arr).unwrap_or_else(|_| "[]".to_string());

    let val_status_str = if validation_passed {
        "passed"
    } else {
        "not_applicable"
    };

    // 5. Update SQLite Card
    conn.execute(
        "UPDATE kanban_cards 
         SET status = 'in_review', validation_status = ?2, completion_evidence = ?3, 
             activity_log = ?4, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?1",
        params![card_id, val_status_str, evidence, new_log_str],
    )
    .map_err(|e| e.to_string())?;

    // 5b. Generate Work Receipt relational record
    let _ = crate::mission_builder::generate_work_receipt(
        state.clone(),
        card_id.clone(),
        agent_id.clone(),
    );

    // 6. Reset agent status back to idle
    conn.execute(
        "UPDATE agents SET status = 'idle', last_heartbeat = ?2 WHERE id = ?1",
        params![agent_id, now_secs.to_string()],
    )
    .map_err(|e| e.to_string())?;

    // 7. Publish events
    conn.execute(
        "INSERT INTO events (event_type, agent_id, task_id, payload) VALUES ('kanban_card_completed', ?1, ?2, '{}')",
        params![agent_id, card_id],
    )
    .map_err(|e| e.to_string())?;

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "task_updated".to_string(),
            agent_id: Some(agent_id),
            task_id: Some(card_id.clone()),
            payload: serde_json::json!({ "status": "in_review" }),
        },
    );

    Ok(())
}

#[tauri::command]
pub fn submit_review(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    reviewer_id: String,
    card_id: String,
    approved: bool,
    notes: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // 1. Fetch card details
    let (log_str, assigned_agent): (Option<String>, Option<String>) = conn
        .query_row(
            "SELECT activity_log, assigned_agent_id FROM kanban_cards WHERE id = ?1",
            [&card_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Card not found: {}", e))?;

    let mut log_arr = match log_str {
        Some(ref s) if !s.trim().is_empty() => {
            serde_json::from_str::<Vec<serde_json::Value>>(s).unwrap_or_default()
        }
        _ => Vec::new(),
    };

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let new_status = if approved { "done" } else { "ready" };

    log_arr.push(serde_json::json!({
        "timestamp": now_secs,
        "agent_id": reviewer_id,
        "action": "kanban_card_reviewed",
        "detail": format!("Review submitted. Approved: {}. Notes: {}", approved, notes)
    }));
    let new_log_str = serde_json::to_string(&log_arr).unwrap_or_else(|_| "[]".to_string());

    // Update Card
    conn.execute(
        "UPDATE kanban_cards 
         SET status = ?2, activity_log = ?3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?1",
        params![card_id, new_status, new_log_str],
    )
    .map_err(|e| e.to_string())?;

    // Fire Event
    emit_event(
        &app_handle,
        AppEvent {
            event_type: "task_updated".to_string(),
            agent_id: Some(reviewer_id.clone()),
            task_id: Some(card_id.clone()),
            payload: serde_json::json!({ "status": new_status, "approved": approved }),
        },
    );

    if approved {
        // Cross-Agent Dependency Unblocking
        let mut stmt_blocked = conn
            .prepare("SELECT task_id FROM task_blockers WHERE blocked_by_task_id = ?1")
            .unwrap();
        let blocked_tasks_iter = stmt_blocked
            .query_map([&card_id], |row| row.get::<_, String>(0))
            .unwrap();

        let mut unblocked_candidates = Vec::new();
        for t_id in blocked_tasks_iter {
            if let Ok(tid) = t_id {
                unblocked_candidates.push(tid);
            }
        }

        if !unblocked_candidates.is_empty() {
            // Delete the resolved blockers
            conn.execute(
                "DELETE FROM task_blockers WHERE blocked_by_task_id = ?1",
                params![&card_id],
            )
            .unwrap();

            for tid in unblocked_candidates {
                // Check if it's completely unblocked
                let remaining_blockers: i64 = conn
                    .query_row(
                        "SELECT COUNT(*) FROM task_blockers WHERE task_id = ?1",
                        params![&tid],
                        |row| row.get(0),
                    )
                    .unwrap_or(1);

                if remaining_blockers == 0 {
                    // Update task status back to ready
                    let assigned_opt: Option<String> = conn
                        .query_row(
                            "SELECT assigned_agent_id FROM kanban_cards WHERE id = ?1",
                            params![&tid],
                            |row| row.get(0),
                        )
                        .unwrap_or(None);

                    conn.execute(
                        "UPDATE kanban_cards SET status = 'ready', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
                        params![&tid],
                    ).unwrap();

                    // Inject notification to target agent if assigned
                    if let Some(_target_agent) = assigned_opt {
                        let session_id = format!("task_{}", tid);
                        let sys_msg = format!("System Notification: The blocker '{}' has been completed. Your task '{}' is now UNBLOCKED and ready to resume.", card_id, tid);

                        let _ = conn.execute(
                            "INSERT INTO messages (session_id, role, sender_id, content) VALUES (?1, 'system', 'unblock_manager', ?2)",
                            params![session_id, sys_msg],
                        );
                    }

                    emit_event(
                        &app_handle,
                        AppEvent {
                            event_type: "task_updated".to_string(),
                            agent_id: None,
                            task_id: Some(tid.clone()),
                            payload: serde_json::json!({ "status": "ready", "unblocked": true }),
                        },
                    );
                }
            }
        }
    } else {
        // If rejected, inject a message to the original assignee
        if let Some(target_agent) = assigned_agent {
            let session_id = format!("task_{}", card_id);
            let sys_msg = format!("System Notification: Your task '{}' was REJECTED in review by {}. Notes: {}. It has been moved back to 'ready'.", card_id, reviewer_id, notes);

            let _ = conn.execute(
                "INSERT INTO messages (session_id, role, sender_id, content) VALUES (?1, 'system', 'review_tribunal', ?2)",
                params![session_id, sys_msg],
            );
        }
    }

    Ok(())
}

#[tauri::command]
pub fn create_task_blocker(
    state: State<'_, DbState>,
    task_id: String,
    blocked_by_task_id: String,
    reason: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Add blocker mapping record
    conn.execute(
        "INSERT INTO task_blockers (task_id, blocked_by_task_id, reason) VALUES (?1, ?2, ?3)",
        params![task_id, blocked_by_task_id, reason],
    )
    .map_err(|e| e.to_string())?;

    // Update log
    let log_str: Option<String> = conn
        .query_row(
            "SELECT activity_log FROM kanban_cards WHERE id = ?1",
            [&task_id],
            |row| row.get(0),
        )
        .unwrap_or(None);

    let mut log_arr = match log_str {
        Some(ref s) if !s.trim().is_empty() => {
            serde_json::from_str::<Vec<serde_json::Value>>(s).unwrap_or_default()
        }
        _ => Vec::new(),
    };

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    log_arr.push(serde_json::json!({
        "timestamp": now_secs,
        "agent_id": "system",
        "action": "kanban_card_blocked",
        "detail": format!("Card blocked by dependency card '{}' due to: {}", blocked_by_task_id, reason)
    }));
    let new_log_str = serde_json::to_string(&log_arr).unwrap_or_else(|_| "[]".to_string());

    // Update status to blocked
    conn.execute(
        "UPDATE kanban_cards SET status = 'blocked', activity_log = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![task_id, new_log_str],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn register_artifact(
    state: State<'_, DbState>,
    task_id: Option<String>,
    path: String,
    artifact_type: String,
    size_bytes: Option<i32>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO artifacts (task_id, path, artifact_type, size_bytes) VALUES (?1, ?2, ?3, ?4)",
        params![task_id, path, artifact_type, size_bytes],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_artifacts(state: State<'_, DbState>) -> Result<Vec<Artifact>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, task_id, path, artifact_type, size_bytes, created_at FROM artifacts")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(Artifact {
                id: Some(row.get(0)?),
                task_id: row.get(1)?,
                path: row.get(2)?,
                artifact_type: row.get(3)?,
                size_bytes: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut artifacts = Vec::new();
    for art in iter {
        artifacts.push(art.map_err(|e| e.to_string())?);
    }
    Ok(artifacts)
}

#[tauri::command]
pub fn read_artifact_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SubtaskProposal {
    pub id: String,
    pub title: String,
    pub description: String,
    pub priority: String,
    pub preferred_role: String,
    pub required_files: String,
}

#[tauri::command]
pub fn decompose_task(
    state: State<'_, DbState>,
    parent_task_id: String,
) -> Result<Vec<SubtaskProposal>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Fetch parent details
    let (title, description): (String, Option<String>) = conn
        .query_row(
            "SELECT title, description FROM kanban_cards WHERE id = ?1",
            [&parent_task_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Parent task not found: {}", e))?;

    let desc_str = description.unwrap_or_default().to_lowercase();
    let title_str = title.to_lowercase();

    let proposals = if title_str.contains("tetris") || desc_str.contains("tetris") {
        vec![
            SubtaskProposal {
                id: format!("{}-sub-1", parent_task_id),
                title: "Blueprint Tetris Matrix State".to_string(),
                description: "Design and verify the 10x20 coordinate array representation and falling piece matrices.".to_string(),
                priority: "high".to_string(),
                preferred_role: "Architect".to_string(),
                required_files: "[\"architecture.md\"]".to_string(),
            },
            SubtaskProposal {
                id: format!("{}-sub-2", parent_task_id),
                title: "Build Core Falling Piece Loop".to_string(),
                description: "Program piece translations (left, right, down) and automatic tick drops.".to_string(),
                priority: "high".to_string(),
                preferred_role: "Software Engineer".to_string(),
                required_files: "[\"src/game.ts\"]".to_string(),
            },
            SubtaskProposal {
                id: format!("{}-sub-3", parent_task_id),
                title: "Implement Complete Row Clears".to_string(),
                description: "Evaluate active rows, trigger clears, flash animation, and update score increments.".to_string(),
                priority: "high".to_string(),
                preferred_role: "Software Engineer".to_string(),
                required_files: "[\"src/game.ts\"]".to_string(),
            },
            SubtaskProposal {
                id: format!("{}-sub-4", parent_task_id),
                title: "QA Test Boundaries & Speed Ramping".to_string(),
                description: "Assert collision matrices, boundary collisions, row score metrics, and level drop intervals.".to_string(),
                priority: "medium".to_string(),
                preferred_role: "QA Engineer".to_string(),
                required_files: "[\"tests/game.test.ts\"]".to_string(),
            },
            SubtaskProposal {
                id: format!("{}-sub-5", parent_task_id),
                title: "Compose Tetris Manual & Setup Guides".to_string(),
                description: "Draft comprehensive README.md detailing local boot commands, features, and shortcuts.".to_string(),
                priority: "medium".to_string(),
                preferred_role: "Technical Writer".to_string(),
                required_files: "[\"README.md\"]".to_string(),
            },
        ]
    } else {
        vec![
            SubtaskProposal {
                id: format!("{}-sub-1", parent_task_id),
                title: format!("Architect: Blueprint Design for '{}'", title),
                description: "Design structural design documents and file layout guidelines."
                    .to_string(),
                priority: "high".to_string(),
                preferred_role: "Architect".to_string(),
                required_files: "[\"architecture.md\"]".to_string(),
            },
            SubtaskProposal {
                id: format!("{}-sub-2", parent_task_id),
                title: format!("Developer: Functional Code Core for '{}'", title),
                description:
                    "Implement the primary logic and data handlers matching system design."
                        .to_string(),
                priority: "high".to_string(),
                preferred_role: "Software Engineer".to_string(),
                required_files: "[\"src/main.ts\"]".to_string(),
            },
            SubtaskProposal {
                id: format!("{}-sub-3", parent_task_id),
                title: format!("QA: Unit Integration Tests for '{}'", title),
                description: "Draft complete mock testing rigs and execute assertion validations."
                    .to_string(),
                priority: "medium".to_string(),
                preferred_role: "QA Engineer".to_string(),
                required_files: "[\"tests/main.test.ts\"]".to_string(),
            },
            SubtaskProposal {
                id: format!("{}-sub-4", parent_task_id),
                title: format!("Writer: Readme Documentation for '{}'", title),
                description:
                    "Compose user reference guides and deployment walkthroughs in markdown."
                        .to_string(),
                priority: "low".to_string(),
                preferred_role: "Technical Writer".to_string(),
                required_files: "[\"README.md\"]".to_string(),
            },
        ]
    };

    Ok(proposals)
}

#[tauri::command]
pub fn approve_subtasks(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    parent_task_id: String,
    proposals: Vec<SubtaskProposal>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Get parent task details
    let (workspace_id, _parent_priority): (Option<String>, String) = conn
        .query_row(
            "SELECT workspace_id, priority FROM kanban_cards WHERE id = ?1",
            [&parent_task_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|e| format!("Parent task not found: {}", e))?;

    let ws_id = workspace_id.unwrap_or_else(|| "default".to_string());

    for sub in proposals {
        // Find matching agent
        let assigned_agent_id: Option<String> = conn
            .query_row(
                "SELECT id FROM agents WHERE role LIKE ?1 LIMIT 1",
                [format!("%{}%", sub.preferred_role)],
                |row| row.get(0),
            )
            .optional()
            .unwrap_or(None);

        let now_secs = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let initial_log = serde_json::json!([{
            "timestamp": now_secs,
            "agent_id": "system",
            "action": "kanban_card_created",
            "detail": format!("Subtask card created under parent '{}'", parent_task_id)
        }]);
        let initial_log_str =
            serde_json::to_string(&initial_log).unwrap_or_else(|_| "[]".to_string());

        let agent_id_val = assigned_agent_id.unwrap_or_else(|| "".to_string());

        let smart_criteria = match sub.preferred_role.to_lowercase().as_str() {
            "software engineer" | "coder" | "developer" => {
                vec![
                    "Build compiles cleanly".to_string(),
                    "Core functionality satisfies criteria".to_string(),
                ]
            }
            "technical writer" | "writer" => {
                vec![
                    "README.md updated with run instructions".to_string(),
                    "Known limitations documented".to_string(),
                ]
            }
            "qa engineer" | "qa" => {
                vec![
                    "Test suite execution logs attached".to_string(),
                    "All assertions pass successfully".to_string(),
                ]
            }
            "architect" => {
                vec![
                    "System architecture blueprints mapped".to_string(),
                    "Tradeoffs and risks documented".to_string(),
                ]
            }
            _ => {
                vec!["Task completed successfully".to_string()]
            }
        };
        let smart_criteria_str =
            serde_json::to_string(&smart_criteria).unwrap_or_else(|_| "[]".to_string());

        conn.execute(
            "INSERT OR REPLACE INTO kanban_cards (id, workspace_id, title, description, owner_id, assigned_agent_id, status, priority, created_by, acceptance_criteria, required_files, related_files, related_artifacts, dependencies, blockers, comments, activity_log, validation_status)
             VALUES (?1, ?2, ?3, ?4, NULLIF(?5, ''), NULLIF(?5, ''), 'backlog', ?6, 'system', ?7, ?8, '[]', '[]', ?9, '[]', '[]', ?10, 'pending')",
            params![
                sub.id,
                ws_id,
                sub.title,
                sub.description,
                agent_id_val,
                sub.priority,
                smart_criteria_str,
                sub.required_files,
                format!("[\"{}\"]", parent_task_id), // Dependency array
                initial_log_str,
            ],
        )
        .map_err(|e| e.to_string())?;

        // Map dependency blocker
        conn.execute(
            "INSERT INTO task_blockers (task_id, blocked_by_task_id, reason) VALUES (?1, ?2, 'Parent task requires complete implementation of child subtask')",
            params![parent_task_id, sub.id],
        )
        .map_err(|e| e.to_string())?;
    }

    // Set parent task status to 'blocked'
    let parent_log_str: Option<String> = conn
        .query_row(
            "SELECT activity_log FROM kanban_cards WHERE id = ?1",
            [&parent_task_id],
            |row| row.get(0),
        )
        .unwrap_or(None);

    let mut parent_log = match parent_log_str {
        Some(ref s) if !s.trim().is_empty() => {
            serde_json::from_str::<Vec<serde_json::Value>>(s).unwrap_or_default()
        }
        _ => Vec::new(),
    };

    let now_secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    parent_log.push(serde_json::json!({
        "timestamp": now_secs,
        "agent_id": "system",
        "action": "kanban_card_blocked",
        "detail": "Parent task split into subtasks and set to blocked pending child completions."
    }));
    let new_parent_log_str =
        serde_json::to_string(&parent_log).unwrap_or_else(|_| "[]".to_string());

    conn.execute(
        "UPDATE kanban_cards SET status = 'blocked', activity_log = ?2 WHERE id = ?1",
        params![parent_task_id, new_parent_log_str],
    )
    .map_err(|e| e.to_string())?;

    // Emit event to update UI
    emit_event(
        &app_handle,
        AppEvent {
            event_type: "task_updated".to_string(),
            agent_id: None,
            task_id: Some(parent_task_id.clone()),
            payload: serde_json::json!({ "id": parent_task_id, "status": "blocked" }),
        },
    );

    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentRun {
    pub id: String,
    pub agent_id: Option<String>,
    pub conversation_id: Option<String>,
    pub task_id: Option<String>,
    pub state: String,
    pub input: Option<String>,
    pub plan: Option<String>,
    pub final_answer: Option<String>,
    pub error: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentRunStep {
    pub id: String,
    pub run_id: Option<String>,
    pub step_type: String,
    pub content: String,
    pub created_at: Option<String>,
}

#[tauri::command]
pub fn get_agent_runs(
    state: State<'_, DbState>,
    agent_id: Option<String>,
    task_id: Option<String>,
) -> Result<Vec<AgentRun>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut query = "SELECT id, agent_id, conversation_id, task_id, state, input, plan, final_answer, error, created_at, updated_at FROM agent_runs WHERE 1=1".to_string();
    let mut params: Vec<String> = vec![];

    if let Some(aid) = agent_id {
        query.push_str(&format!(" AND agent_id = '?{}'", params.len() + 1));
        params.push(aid);
    }

    if let Some(tid) = task_id {
        query.push_str(&format!(" AND task_id = '?{}'", params.len() + 1));
        params.push(tid);
    }

    query.push_str(" ORDER BY created_at DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
            Ok(AgentRun {
                id: row.get(0)?,
                agent_id: row.get(1)?,
                conversation_id: row.get(2)?,
                task_id: row.get(3)?,
                state: row.get(4)?,
                input: row.get(5)?,
                plan: row.get(6)?,
                final_answer: row.get(7)?,
                error: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut runs = Vec::new();
    for run in iter {
        if let Ok(r) = run {
            runs.push(r);
        }
    }
    Ok(runs)
}

#[tauri::command]
pub fn get_run_steps(
    state: State<'_, DbState>,
    run_id: String,
) -> Result<Vec<AgentRunStep>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT id, run_id, step_type, content, created_at FROM agent_run_steps WHERE run_id = ?1 ORDER BY created_at ASC").map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([run_id], |row| {
            Ok(AgentRunStep {
                id: row.get(0)?,
                run_id: row.get(1)?,
                step_type: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut steps = Vec::new();
    for step in iter {
        if let Ok(s) = step {
            steps.push(s);
        }
    }
    Ok(steps)
}
