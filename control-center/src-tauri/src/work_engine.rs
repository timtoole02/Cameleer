use crate::storage::DbState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkSuggestion {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: String,        // "info", "warning", "critical", "success"
    pub suggestion_type: String, // "blocker", "assignment", "handoff", "review", "recovery"
    pub action_label: Option<String>,
    pub action_command: Option<String>,
    pub related_agent_id: Option<String>,
    pub related_task_id: Option<String>,
}

#[tauri::command]
pub fn get_work_engine_suggestions(
    state: State<'_, DbState>,
) -> Result<Vec<WorkSuggestion>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut suggestions = Vec::new();

    // 1. Check for stalled agents in recovery
    let mut stmt = conn
        .prepare("SELECT id, name, role FROM agents WHERE status = 'recovering'")
        .map_err(|e| e.to_string())?;
    let recovering_agents = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for agent in recovering_agents {
        if let Ok((id, name, role)) = agent {
            suggestions.push(WorkSuggestion {
                id: format!("recovering-{}", id),
                title: format!("Agent {} Stalled", name),
                description: format!("{} ({}) has stalled during reasoning execution. The watchdog supervisor is auto-healing the state and preparing rollback to the last valid checkpoint.", name, role),
                severity: "critical".to_string(),
                suggestion_type: "recovery".to_string(),
                action_label: Some("Restart Agent".to_string()),
                action_command: Some(format!("restart_agent:{}", id)),
                related_agent_id: Some(id),
                related_task_id: None,
            });
        }
    }
    drop(stmt);

    // 2. Check for pending reviews
    let mut stmt = conn
        .prepare(
            "SELECT t.id, t.title, a.id, a.name 
             FROM kanban_cards t
             JOIN agents a ON t.assigned_agent_id = a.id
             WHERE t.status = 'In Review' OR t.validation_status = 'pending_review' OR (t.status = 'Done' AND t.validation_status = 'pending')",
        )
        .map_err(|e| e.to_string())?;
    let pending_reviews = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for rev in pending_reviews {
        if let Ok((task_id, title, agent_id, name)) = rev {
            suggestions.push(WorkSuggestion {
                id: format!("review-{}", task_id),
                title: "Code Review Required".to_string(),
                description: format!("Agent {} completed task '{}'. Standard review policy requires human validation before signing off on deliverables.", name, title),
                severity: "warning".to_string(),
                suggestion_type: "review".to_string(),
                action_label: Some("Approve Card".to_string()),
                action_command: Some(format!("approve_task:{}", task_id)),
                related_agent_id: Some(agent_id),
                related_task_id: Some(task_id),
            });
        }
    }
    drop(stmt);

    // 3. Check for pending handoffs
    let mut stmt = conn
        .prepare(
            "SELECT h.id, h.task_id, t.title, sa.name, ta.name 
             FROM handoffs h
             JOIN kanban_cards t ON h.task_id = t.id
             JOIN agents sa ON h.source_agent_id = sa.id
             JOIN agents ta ON h.target_agent_id = ta.id
             WHERE h.status = 'pending'",
        )
        .map_err(|e| e.to_string())?;
    let pending_handoffs = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for ho in pending_handoffs {
        if let Ok((id, task_id, title, source, target)) = ho {
            suggestions.push(WorkSuggestion {
                id: format!("handoff-{}", id),
                title: "Agent Handoff Pending".to_string(),
                description: format!("{} has finished their share and requested handoff to {} for task '{}'. Accept this handoff to shift ownership.", source, target, title),
                severity: "info".to_string(),
                suggestion_type: "handoff".to_string(),
                action_label: Some("Accept Handoff".to_string()),
                action_command: Some(format!("accept_handoff:{}", id)),
                related_agent_id: None,
                related_task_id: Some(task_id),
            });
        }
    }
    drop(stmt);

    // 4. Check for blocked tasks
    let mut stmt = conn
        .prepare(
            "SELECT tb.id, t1.id, t1.title, t2.title, tb.reason 
             FROM task_blockers tb
             JOIN kanban_cards t1 ON tb.task_id = t1.id
             JOIN kanban_cards t2 ON tb.blocked_by_task_id = t2.id
             WHERE t1.status != 'Done' AND t2.status != 'Done'",
        )
        .map_err(|e| e.to_string())?;
    let blocked_tasks = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, i32>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    for bt in blocked_tasks {
        if let Ok((id, task_id, title, blocked_by_title, reason)) = bt {
            suggestions.push(WorkSuggestion {
                id: format!("blocker-{}", id),
                title: format!("Task Blocked"),
                description: format!(
                    "'{}' is blocked by unfinished task '{}'. Reason: {}.",
                    title, blocked_by_title, reason
                ),
                severity: "warning".to_string(),
                suggestion_type: "blocker".to_string(),
                action_label: Some("Prioritize Blocker".to_string()),
                action_command: Some(format!("prioritize_task:{}", task_id)),
                related_agent_id: None,
                related_task_id: Some(task_id),
            });
        }
    }
    drop(stmt);

    // 5. Idle agents & task matching recommendation
    let mut stmt = conn
        .prepare("SELECT id, name, role FROM agents WHERE status = 'idle'")
        .map_err(|e| e.to_string())?;
    let idle_agents = stmt
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut idle_list = Vec::new();
    for agent in idle_agents {
        if let Ok(a) = agent {
            idle_list.push(a);
        }
    }
    drop(stmt);

    if !idle_list.is_empty() {
        let mut stmt = conn
            .prepare("SELECT id, title FROM kanban_cards WHERE status = 'Backlog' OR status = 'Ready' ORDER BY priority DESC LIMIT 3")
            .map_err(|e| e.to_string())?;
        let open_tasks = stmt
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })
            .map_err(|e| e.to_string())?;

        let mut tasks_list = Vec::new();
        for task in open_tasks {
            if let Ok(t) = task {
                tasks_list.push(t);
            }
        }
        drop(stmt);

        for (agent_id, name, role) in idle_list {
            if let Some((task_id, task_title)) = tasks_list.first() {
                suggestions.push(WorkSuggestion {
                    id: format!("idle-match-{}", agent_id),
                    title: format!("Match Idle Agent: {}", name),
                    description: format!("Specialist {} ({}) is currently idle. Recommended action: assign them to open sprint task '{}' to accelerate sprint timelines.", name, role, task_title),
                    severity: "info".to_string(),
                    suggestion_type: "assignment".to_string(),
                    action_label: Some("Assign Task".to_string()),
                    action_command: Some(format!("assign_task:{}:{}", task_id, agent_id)),
                    related_agent_id: Some(agent_id),
                    related_task_id: Some(task_id.clone()),
                });
            }
        }
    }

    // 6. Query from mission_recommendations
    if let Ok(mut stmt) = conn.prepare("SELECT id, recommendation_type, content, action_target FROM mission_recommendations WHERE status = 'active'") {
        if let Ok(mission_recs) = stmt.query_map([], |row| {
            Ok((
                row.get::<_, i64>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, Option<String>>(3)?,
            ))
        }) {
            for rec in mission_recs {
                if let Ok((id, rec_type, content, target)) = rec {
                    let label = match rec_type.as_str() {
                        "decompose" => Some("Break into subtasks".to_string()),
                        "agent_missing" => Some("Assign Agent".to_string()),
                        _ => Some("Dismiss".to_string()),
                    };

                    let command = match rec_type.as_str() {
                        "decompose" => Some(format!("decompose_task:{}", target.clone().unwrap_or_default())),
                        "agent_missing" => Some(format!("assign_agent:{}", target.clone().unwrap_or_default())),
                        _ => Some(format!("dismiss_rec:{}", id)),
                    };

                    suggestions.push(WorkSuggestion {
                        id: format!("mission-rec-{}", id),
                        title: "Crew Recommendation".to_string(),
                        description: content,
                        severity: "info".to_string(),
                        suggestion_type: rec_type,
                        action_label: label,
                        action_command: command,
                        related_agent_id: None,
                        related_task_id: target,
                    });
                }
            }
        }
    }

    Ok(suggestions)
}
