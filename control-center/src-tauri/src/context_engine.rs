use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{State, AppHandle};
use crate::storage::DbState;
use crate::event_bus::{emit_event, AppEvent};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub path: String,
    pub active: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Decision {
    pub id: Option<i32>,
    pub workspace_id: Option<String>,
    pub decision: String,
    pub decided_by: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Handoff {
    pub id: Option<i32>,
    pub task_id: Option<String>,
    pub source_agent_id: String,
    pub target_agent_id: String,
    pub reason: String,
    pub status: String,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CoordinationDetails {
    pub workspaces: Vec<Workspace>,
    pub decisions: Vec<Decision>,
    pub handoffs: Vec<Handoff>,
}

pub fn get_workspace_context_snapshot(
    conn: &Connection,
    agent_id: Option<&str>,
    workspace_id: Option<&str>,
    _task_id: Option<&str>,
) -> Result<String, String> {
    // 1. Active Workspace Details
    let ws_query = match workspace_id {
        Some(id) => ("SELECT id, name, path, active FROM workspaces WHERE id = ?1", vec![id]),
        None => ("SELECT id, name, path, active FROM workspaces WHERE active = 1 LIMIT 1", vec![]),
    };
    
    let mut active_ws: Option<Workspace> = None;
    let mut stmt_ws = conn.prepare(ws_query.0).map_err(|e| e.to_string())?;
    let ws_iter = stmt_ws.query_map(rusqlite::params_from_iter(ws_query.1), |row| {
        Ok(Workspace {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            active: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;

    for item in ws_iter {
        if let Ok(ws) = item {
            active_ws = Some(ws);
            break;
        }
    }

    let ws_section = match active_ws {
        Some(ws) => format!("- Active Workspace: {} (Path: {})\n", ws.name, ws.path),
        None => "- Active Workspace: None\n".to_string(),
    };

    // 2. Shared Global Goal (from shared_state)
    let shared_obj: String = conn.query_row(
        "SELECT value FROM shared_state WHERE key = 'objective'",
        [],
        |row| row.get(0),
    ).unwrap_or_else(|_| "None".to_string());

    // 3. Active Crew & Statuses
    let mut stmt_agents = conn.prepare(
        "SELECT id, name, role, status, last_heartbeat FROM agents"
    ).map_err(|e| e.to_string())?;
    let agents_iter = stmt_agents.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
        ))
    }).map_err(|e| e.to_string())?;

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let mut agents_summary = String::new();
    for agent in agents_iter {
        if let Ok((id, name, role, status, hb)) = agent {
            let hb_str = if let Some(h_val) = hb {
                if let Ok(secs) = h_val.parse::<u64>() {
                    format!("{}s ago", now.saturating_sub(secs))
                } else {
                    "never".to_string()
                }
            } else {
                "never".to_string()
            };
            let self_marker = if Some(id.as_str()) == agent_id { " (YOU)" } else { "" };
            agents_summary.push_str(&format!("- {}{} [{}]: status=[{}], last_active=[{}]\n", name, self_marker, role, status, hb_str));
        }
    }

    // 4. Tasks & Blockers (Upgraded Kanban Cards Orchestration)
    let mut stmt_tasks = conn.prepare(
        "SELECT id, title, owner_id, assigned_agent_id, status, priority, 
                acceptance_criteria, required_files, related_files, blockers, dependencies 
         FROM tasks"
    ).map_err(|e| e.to_string())?;

    let tasks_iter = stmt_tasks.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, Option<String>>(2)?,
            row.get::<_, Option<String>>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
            row.get::<_, Option<String>>(6)?,
            row.get::<_, Option<String>>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, Option<String>>(9)?,
            row.get::<_, Option<String>>(10)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut tasks_summary = String::new();
    for task in tasks_iter {
        if let Ok((id, title, owner, assignee, status, priority, criteria, req_files, rel_files, blockers, deps)) = task {
            let assignee_id = assignee.or(owner).unwrap_or_else(|| "unassigned".to_string());
            let criteria_str = criteria.unwrap_or_else(|| "[]".to_string());
            let req_files_str = req_files.unwrap_or_else(|| "[]".to_string());
            let rel_files_str = rel_files.unwrap_or_else(|| "[]".to_string());
            let blockers_str = blockers.unwrap_or_else(|| "[]".to_string());
            let deps_str = deps.unwrap_or_else(|| "[]".to_string());

            tasks_summary.push_str(&format!(
                "- Kanban Card [id: {}] \"{}\"\n\
                  * Status: {}\n\
                  * Priority: {}\n\
                  * Assigned Agent: {}\n\
                  * Acceptance Criteria: {}\n\
                  * Required Files: {}\n\
                  * Related Files: {}\n\
                  * Blockers: {}\n\
                  * Dependencies: {}\n\n",
                id, title, status, priority, assignee_id, criteria_str, req_files_str, rel_files_str, blockers_str, deps_str
            ));
        }
    }
    if tasks_summary.is_empty() {
        tasks_summary = "- No Kanban cards registered yet.".to_string();
    }

    // 5. Workspace File Artifacts
    let mut stmt_arts = conn.prepare(
        "SELECT path, artifact_type, size_bytes FROM artifacts ORDER BY id DESC LIMIT 10"
    ).map_err(|e| e.to_string())?;
    let arts_iter = stmt_arts.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?, row.get::<_, Option<i32>>(2)?))
    }).map_err(|e| e.to_string())?;

    let mut arts_summary = String::new();
    for art in arts_iter {
        if let Ok((path, art_type, size)) = art {
            let size_str = size.map(|s| format!(" ({} bytes)", s)).unwrap_or_default();
            arts_summary.push_str(&format!("- [{}] {}{}\n", art_type, path, size_str));
        }
    }
    if arts_summary.is_empty() {
        arts_summary = "- No artifacts created yet.".to_string();
    }

    // 6. Engineering Decisions
    let mut stmt_decs = conn.prepare(
        "SELECT decision, decided_by, timestamp FROM decisions ORDER BY id DESC LIMIT 5"
    ).map_err(|e| e.to_string())?;
    let decs_iter = stmt_decs.query_map([], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?, row.get::<_, String>(2)?))
    }).map_err(|e| e.to_string())?;

    let mut decs_summary = String::new();
    for dec in decs_iter {
        if let Ok((decision, decided_by, ts)) = dec {
            let user_str = decided_by.unwrap_or_else(|| "unknown".to_string());
            decs_summary.push_str(&format!("- [{}] By {}: {}\n", ts, user_str, decision));
        }
    }
    if decs_summary.is_empty() {
        decs_summary = "- No engineering decisions recorded yet.".to_string();
    }

    // 7. Pending Handoffs
    let mut stmt_handoffs = conn.prepare(
        "SELECT id, source_agent_id, target_agent_id, reason, status, timestamp FROM handoffs WHERE status = 'pending'"
    ).map_err(|e| e.to_string())?;
    let handoffs_iter = stmt_handoffs.query_map([], |row| {
        Ok((
            row.get::<_, i32>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, String>(5)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut handoffs_summary = String::new();
    for ho in handoffs_iter {
        if let Ok((id, src, target, reason, status, ts)) = ho {
            handoffs_summary.push_str(&format!("- [id: {}] Handoff from {} to {} | reason: \"{}\" | status={} ({})\n", id, src, target, reason, status, ts));
        }
    }
    if handoffs_summary.is_empty() {
        handoffs_summary = "- No pending handoffs.".to_string();
    }

    // 8. Recent Events
    let mut stmt_events = conn.prepare(
        "SELECT event_type, agent_id, timestamp FROM events ORDER BY id DESC LIMIT 8"
    ).map_err(|e| e.to_string())?;
    let events_iter = stmt_events.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, Option<String>>(1)?,
            row.get::<_, String>(2)?,
        ))
    }).map_err(|e| e.to_string())?;

    let mut events_summary = String::new();
    for ev in events_iter {
        if let Ok((ev_type, agent, time)) = ev {
            let agent_str = agent.unwrap_or_else(|| "system".to_string());
            events_summary.push_str(&format!("- [{}] Agent {}: {}\n", time, agent_str, ev_type));
        }
    }
    if events_summary.is_empty() {
        events_summary = "- No events logged yet.".to_string();
    }

    // 9. Suggested Next Action
    let suggested_action = match agent_id {
        Some("agent-coder") => "Review pending tasks, resolve open task handoffs, write clean/modular code files, and register decisions or file changes in artifacts table.",
        Some("agent-analyst") => "Examine blocker paths in active tasks, plan database schemas, and map workflow constraints.",
        Some("agent-writer") => "Review created file artifacts, document features, draft highly comprehensive README files, and synthesize engineering decisions.",
        Some("agent-sentry") => "Review failed task items, monitor heartbeats, design automated check suites, and flag blockers.",
        _ => "Collaborate in `#global-room` to resolve open objectives.",
    };

    let snapshot = format!(
        "### SHARED PROJECT BRAIN CONTEXT\n\n\
         #### WORKSPACE & OBJECTIVE:\n{}\
         - Shared Global Goal: {}\n\n\
         #### ACTIVE CREW & STATUSES:\n{}\n\
         #### RECENT WORKSPACE TASKS & BLOCKERS:\n{}\n\
         #### CREATED FILE ARTIFACTS:\n{}\n\
         #### RECORDED ENGINEERING DECISIONS:\n{}\n\
         #### PENDING WORKFLOW HANDOFFS:\n{}\n\
         #### RECENT FIREWALL EVENTS:\n{}\n\
         #### YOUR ROLE SUGGESTED NEXT ACTION:\n- {}\n",
        ws_section, shared_obj, agents_summary, tasks_summary, arts_summary, decs_summary, handoffs_summary, events_summary, suggested_action
    );

    Ok(snapshot)
}

#[tauri::command]
pub fn get_blackboard_awareness(state: State<'_, DbState>) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    get_workspace_context_snapshot(&conn, None, None, None)
}

#[tauri::command]
pub fn get_workspace_context(
    state: State<'_, DbState>,
    agent_id: Option<String>,
    workspace_id: Option<String>,
    task_id: Option<String>,
) -> Result<String, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    get_workspace_context_snapshot(&conn, agent_id.as_deref(), workspace_id.as_deref(), task_id.as_deref())
}

#[tauri::command]
pub fn record_decision_cmd(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    workspace_id: String,
    decision: String,
    decided_by: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO decisions (workspace_id, decision, decided_by) VALUES (?1, ?2, ?3)",
        params![&workspace_id, &decision, &decided_by],
    ).map_err(|e| e.to_string())?;

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "decision_recorded".to_string(),
            agent_id: Some(decided_by.clone()),
            task_id: None,
            payload: serde_json::json!({ "workspace_id": workspace_id, "decision": decision, "decided_by": decided_by }),
        },
    );

    Ok(())
}

#[tauri::command]
pub fn request_handoff_cmd(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    task_id: Option<String>,
    source_agent_id: String,
    target_agent_id: String,
    reason: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO handoffs (task_id, source_agent_id, target_agent_id, reason, status) 
         VALUES (?1, ?2, ?3, ?4, 'pending')",
        params![task_id, source_agent_id, target_agent_id, reason],
    ).map_err(|e| e.to_string())?;

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "handoff_requested".to_string(),
            agent_id: Some(source_agent_id.clone()),
            task_id,
            payload: serde_json::json!({
                "source_agent_id": source_agent_id,
                "target_agent_id": target_agent_id,
                "reason": reason,
                "status": "pending"
            }),
        },
    );

    Ok(())
}

#[tauri::command]
pub fn resolve_handoff_cmd(
    state: State<'_, DbState>,
    app_handle: AppHandle,
    id: i32,
    status: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE handoffs SET status = ?2 WHERE id = ?1",
        params![id, status],
    ).map_err(|e| e.to_string())?;

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "handoff_resolved".to_string(),
            agent_id: None,
            task_id: None,
            payload: serde_json::json!({ "id": id, "status": status }),
        },
    );

    Ok(())
}

#[tauri::command]
pub fn get_coordination_details(state: State<'_, DbState>) -> Result<CoordinationDetails, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    
    // Fetch workspaces
    let mut stmt_ws = conn.prepare("SELECT id, name, path, active FROM workspaces").map_err(|e| e.to_string())?;
    let ws_iter = stmt_ws.query_map([], |row| {
        Ok(Workspace {
            id: row.get(0)?,
            name: row.get(1)?,
            path: row.get(2)?,
            active: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut workspaces = Vec::new();
    for ws in ws_iter {
        workspaces.push(ws.map_err(|e| e.to_string())?);
    }

    // Fetch decisions
    let mut stmt_decs = conn.prepare("SELECT id, workspace_id, decision, decided_by, timestamp FROM decisions ORDER BY id DESC").map_err(|e| e.to_string())?;
    let decs_iter = stmt_decs.query_map([], |row| {
        Ok(Decision {
            id: Some(row.get(0)?),
            workspace_id: row.get(1)?,
            decision: row.get(2)?,
            decided_by: row.get(3)?,
            timestamp: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut decisions = Vec::new();
    for dec in decs_iter {
        decisions.push(dec.map_err(|e| e.to_string())?);
    }

    // Fetch handoffs
    let mut stmt_ho = conn.prepare("SELECT id, task_id, source_agent_id, target_agent_id, reason, status, timestamp FROM handoffs ORDER BY id DESC").map_err(|e| e.to_string())?;
    let ho_iter = stmt_ho.query_map([], |row| {
        Ok(Handoff {
            id: Some(row.get(0)?),
            task_id: row.get(1)?,
            source_agent_id: row.get(2)?,
            target_agent_id: row.get(3)?,
            reason: row.get(4)?,
            status: row.get(5)?,
            timestamp: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut handoffs = Vec::new();
    for ho in ho_iter {
        handoffs.push(ho.map_err(|e| e.to_string())?);
    }

    Ok(CoordinationDetails {
        workspaces,
        decisions,
        handoffs,
    })
}

#[tauri::command]
pub fn update_shared_state(
    state: State<'_, DbState>,
    key: String,
    value: String,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO shared_state (key, value, updated_at) 
         VALUES (?1, ?2, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = CURRENT_TIMESTAMP",
        [key, value],
    ).map_err(|e| e.to_string())?;
    Ok(())
}
