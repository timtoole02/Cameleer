use crate::storage::DbState;
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BacklogItem {
    pub id: String,
    pub workspace_id: String,
    pub project_id: Option<String>,
    pub team_id: Option<String>,
    pub backlog_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub type_name: String, // 'type' is a keyword, mapped from type
    pub priority: String,
    pub rank: i32,
    pub labels: Option<String>,
    pub source: String,
    pub status: String,
    pub owner_agent_id: Option<String>,
    pub owner_human_id: Option<String>,
    pub proposed_agent_role: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub definition_of_done: Option<String>,
    pub required_files: Option<String>,
    pub refinement_notes: Option<String>,
    pub dependencies: Option<String>,
    pub risk_level: String,
    pub effort_estimate: Option<String>,
    pub readiness_score: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct KanbanCard {
    pub id: String,
    pub workspace_id: String,
    pub project_id: Option<String>,
    pub team_id: Option<String>,
    pub board_id: Option<String>,
    pub backlog_id: Option<String>,
    pub parent_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub type_name: String,
    pub status: String,
    pub priority: String,
    pub rank: i32,
    pub severity: Option<String>,
    pub labels: Option<String>,
    pub assigned_agent_id: Option<String>,
    pub assigned_human_id: Option<String>,
    pub reporter: Option<String>,
    pub created_by: String,
    pub created_at: String,
    pub updated_at: String,
    pub due_date: Option<String>,
    pub start_date: Option<String>,
    pub completed_at: Option<String>,
    pub estimate: Option<String>,
    pub actual_time: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub definition_of_done: Option<String>,
    pub required_files: Option<String>,
    pub related_files: Option<String>,
    pub related_artifacts: Option<String>,
    pub dependencies: Option<String>,
    pub blocked_by: Option<String>,
    pub blocking: Option<String>,
    pub comments: Option<String>,
    pub activity_log: Option<String>,
    pub checklist: Option<String>,
    pub validation_status: String,
    pub completion_evidence: Option<String>,
    pub work_receipt_id: Option<String>,
    pub risk_level: String,
    pub review_required: i32,
    pub approval_required: i32,
    pub reopen_reason: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Board {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BoardColumn {
    pub id: String,
    pub board_id: String,
    pub name: String,
    pub status_mapping: String,
    pub rank: i32,
    pub wip_limit: Option<i32>,
    pub created_at: String,
}

#[tauri::command]
pub fn get_backlog_snapshot(
    workspace_id: String,
    project_id: Option<String>,
    team_id: Option<String>,
    state: State<DbState>,
) -> Result<Vec<BacklogItem>, String> {
    let conn = state.conn.lock().unwrap();
    let mut query = "SELECT id, workspace_id, project_id, team_id, backlog_id, title, description, type, priority, rank, labels, source, status, owner_agent_id, owner_human_id, proposed_agent_role, acceptance_criteria, definition_of_done, required_files, refinement_notes, dependencies, risk_level, effort_estimate, readiness_score, created_at, updated_at FROM backlog_items WHERE workspace_id = ?1".to_string();
    let mut params: Vec<String> = vec![workspace_id.clone()];

    if let Some(pid) = project_id {
        query.push_str(&format!(" AND project_id = '?{}'", params.len() + 1));
        params.push(pid);
    }
    if let Some(tid) = team_id {
        query.push_str(&format!(" AND team_id = '?{}'", params.len() + 1));
        params.push(tid);
    }
    query.push_str(" ORDER BY rank ASC, created_at DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
            Ok(BacklogItem {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                project_id: row.get(2)?,
                team_id: row.get(3)?,
                backlog_id: row.get(4)?,
                title: row.get(5)?,
                description: row.get(6)?,
                type_name: row.get(7)?,
                priority: row.get(8)?,
                rank: row.get(9)?,
                labels: row.get(10)?,
                source: row.get(11)?,
                status: row.get(12)?,
                owner_agent_id: row.get(13)?,
                owner_human_id: row.get(14)?,
                proposed_agent_role: row.get(15)?,
                acceptance_criteria: row.get(16)?,
                definition_of_done: row.get(17)?,
                required_files: row.get(18)?,
                refinement_notes: row.get(19)?,
                dependencies: row.get(20)?,
                risk_level: row.get(21)?,
                effort_estimate: row.get(22)?,
                readiness_score: row.get(23)?,
                created_at: row.get(24)?,
                updated_at: row.get(25)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for i in iter {
        if let Ok(item) = i {
            items.push(item);
        }
    }
    Ok(items)
}

#[tauri::command]
pub fn create_backlog_item(
    workspace_id: String,
    title: String,
    description: Option<String>,
    type_name: Option<String>,
    priority: Option<String>,
    state: State<DbState>,
) -> Result<BacklogItem, String> {
    let conn = state.conn.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let t = type_name.unwrap_or_else(|| "feature".to_string());
    let p = priority.unwrap_or_else(|| "medium".to_string());

    conn.execute(
        "INSERT INTO backlog_items (id, workspace_id, title, description, type, priority, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'captured')",
        params![id, workspace_id, title, description, t, p],
    )
    .map_err(|e| e.to_string())?;

    // Drop the lock and read it back
    drop(conn);

    // Simplistic fetch back.
    let items = get_backlog_snapshot(workspace_id, None, None, state)?;
    items
        .into_iter()
        .find(|i| i.id == id)
        .ok_or_else(|| "Failed to read back item".to_string())
}

#[tauri::command]
pub fn update_backlog_item(
    id: String,
    title: Option<String>,
    description: Option<String>,
    type_name: Option<String>,
    priority: Option<String>,
    status: Option<String>,
    acceptance_criteria: Option<String>,
    definition_of_done: Option<String>,
    required_files: Option<String>,
    proposed_agent_role: Option<String>,
    dependencies: Option<String>,
    risk_level: Option<String>,
    effort_estimate: Option<String>,
    readiness_score: Option<i32>,
    refinement_notes: Option<String>,
    labels: Option<String>,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();

    if let Some(v) = title {
        conn.execute(
            "UPDATE backlog_items SET title = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![v, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = description {
        conn.execute("UPDATE backlog_items SET description = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = type_name {
        conn.execute(
            "UPDATE backlog_items SET type = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![v, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = priority {
        conn.execute(
            "UPDATE backlog_items SET priority = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![v, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = status {
        conn.execute(
            "UPDATE backlog_items SET status = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![v, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = acceptance_criteria {
        conn.execute("UPDATE backlog_items SET acceptance_criteria = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = definition_of_done {
        conn.execute("UPDATE backlog_items SET definition_of_done = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = required_files {
        conn.execute("UPDATE backlog_items SET required_files = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = proposed_agent_role {
        conn.execute("UPDATE backlog_items SET proposed_agent_role = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = dependencies {
        conn.execute("UPDATE backlog_items SET dependencies = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = risk_level {
        conn.execute("UPDATE backlog_items SET risk_level = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = effort_estimate {
        conn.execute("UPDATE backlog_items SET effort_estimate = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = readiness_score {
        conn.execute("UPDATE backlog_items SET readiness_score = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = refinement_notes {
        conn.execute("UPDATE backlog_items SET refinement_notes = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = labels {
        conn.execute(
            "UPDATE backlog_items SET labels = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![v, id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn convert_backlog_item_to_card(
    id: String,
    state: State<DbState>,
) -> Result<KanbanCard, String> {
    let conn = state.conn.lock().unwrap();

    // Read the backlog item with all rich fields
    let mut stmt = conn.prepare("SELECT workspace_id, title, description, type, priority, acceptance_criteria, definition_of_done, required_files, dependencies, risk_level, labels FROM backlog_items WHERE id = ?1").unwrap();
    let row: (
        String,
        String,
        Option<String>,
        String,
        String,
        Option<String>,
        Option<String>,
        Option<String>,
        Option<String>,
        String,
        Option<String>,
    ) = stmt
        .query_row([&id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
                row.get(7)?,
                row.get(8)?,
                row.get(9)?,
                row.get(10)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let (ws_id, title, desc, type_name, priority, acc, dod, req_files, deps, risk, labels) = row;

    let card_id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO kanban_cards (id, workspace_id, backlog_id, title, description, type, priority, acceptance_criteria, definition_of_done, required_files, dependencies, risk_level, labels, status, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'ready', 'human')",
        params![card_id, ws_id, id, title, desc, type_name, priority, acc, dod, req_files, deps, risk, labels],
    ).map_err(|e| e.to_string())?;

    // Mark backlog item as ready_for_board
    conn.execute(
        "UPDATE backlog_items SET status = 'ready_for_board', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;

    // Return the created KanbanCard
    let mut card_stmt = conn.prepare("SELECT 
        id, workspace_id, NULL as project_id, NULL as team_id, board_id, backlog_id, parent_id,
        title, description, type as type_name, status, priority, rank, severity, labels,
        assigned_agent_id, assigned_human_id, reporter, created_by, created_at, updated_at,
        due_date, start_date, completed_at, estimate, actual_time, acceptance_criteria,
        definition_of_done, required_files, related_files, related_artifacts, dependencies,
        blocked_by, blocking, comments, activity_log, checklist, validation_status,
        completion_evidence, work_receipt_id, risk_level, review_required, approval_required, reopen_reason
        FROM kanban_cards WHERE id = ?1").unwrap();

    let card = card_stmt
        .query_row([&card_id], |row| {
            Ok(KanbanCard {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                project_id: row.get(2)?,
                team_id: row.get(3)?,
                board_id: row.get(4)?,
                backlog_id: row.get(5)?,
                parent_id: row.get(6)?,
                title: row.get(7)?,
                description: row.get(8)?,
                type_name: row.get(9)?,
                status: row.get(10)?,
                priority: row.get(11)?,
                rank: row.get(12)?,
                severity: row.get(13)?,
                labels: row.get(14)?,
                assigned_agent_id: row.get(15)?,
                assigned_human_id: row.get(16)?,
                reporter: row.get(17)?,
                created_by: row.get(18)?,
                created_at: row.get(19)?,
                updated_at: row.get(20)?,
                due_date: row.get(21)?,
                start_date: row.get(22)?,
                completed_at: row.get(23)?,
                estimate: row.get(24)?,
                actual_time: row.get(25)?,
                acceptance_criteria: row.get(26)?,
                definition_of_done: row.get(27)?,
                required_files: row.get(28)?,
                related_files: row.get(29)?,
                related_artifacts: row.get(30)?,
                dependencies: row.get(31)?,
                blocked_by: row.get(32)?,
                blocking: row.get(33)?,
                comments: row.get(34)?,
                activity_log: row.get(35)?,
                checklist: row.get(36)?,
                validation_status: row.get(37)?,
                completion_evidence: row.get(38)?,
                work_receipt_id: row.get(39)?,
                risk_level: row.get(40)?,
                review_required: row.get(41)?,
                approval_required: row.get(42)?,
                reopen_reason: row.get(43)?,
            })
        })
        .map_err(|e| e.to_string())?;

    Ok(card)
}

#[tauri::command]
pub fn get_board_snapshot(
    workspace_id: String,
    project_id: Option<String>,
    team_id: Option<String>,
    state: State<DbState>,
) -> Result<Vec<KanbanCard>, String> {
    let conn = state.conn.lock().unwrap();

    let mut query = "SELECT id, workspace_id, project_id, team_id, board_id, backlog_id, parent_id, title, description, type, status, priority, rank, severity, labels, assigned_agent_id, assigned_human_id, reporter, created_by, created_at, updated_at, due_date, start_date, completed_at, estimate, actual_time, acceptance_criteria, definition_of_done, required_files, related_files, related_artifacts, dependencies, blocked_by, blocking, comments, activity_log, checklist, validation_status, completion_evidence, work_receipt_id, risk_level, review_required, approval_required, reopen_reason FROM kanban_cards WHERE workspace_id = ?1".to_string();
    let mut params: Vec<String> = vec![workspace_id.clone()];

    if let Some(pid) = project_id {
        query.push_str(&format!(" AND project_id = '?{}'", params.len() + 1));
        params.push(pid);
    }
    if let Some(tid) = team_id {
        query.push_str(&format!(" AND team_id = '?{}'", params.len() + 1));
        params.push(tid);
    }
    query.push_str(" ORDER BY rank ASC, created_at DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
            Ok(KanbanCard {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                project_id: row.get(2)?,
                team_id: row.get(3)?,
                board_id: row.get(4)?,
                backlog_id: row.get(5)?,
                parent_id: row.get(6)?,
                title: row.get(7)?,
                description: row.get(8)?,
                type_name: row.get(9)?,
                status: row.get(10)?,
                priority: row.get(11)?,
                rank: row.get(12)?,
                severity: row.get(13)?,
                labels: row.get(14)?,
                assigned_agent_id: row.get(15)?,
                assigned_human_id: row.get(16)?,
                reporter: row.get(17)?,
                created_by: row.get(18)?,
                created_at: row.get(19)?,
                updated_at: row.get(20)?,
                due_date: row.get(21)?,
                start_date: row.get(22)?,
                completed_at: row.get(23)?,
                estimate: row.get(24)?,
                actual_time: row.get(25)?,
                acceptance_criteria: row.get(26)?,
                definition_of_done: row.get(27)?,
                required_files: row.get(28)?,
                related_files: row.get(29)?,
                related_artifacts: row.get(30)?,
                dependencies: row.get(31)?,
                blocked_by: row.get(32)?,
                blocking: row.get(33)?,
                comments: row.get(34)?,
                activity_log: row.get(35)?,
                checklist: row.get(36)?,
                validation_status: row.get(37)?,
                completion_evidence: row.get(38)?,
                work_receipt_id: row.get(39)?,
                risk_level: row.get(40)?,
                review_required: row.get(41)?,
                approval_required: row.get(42)?,
                reopen_reason: row.get(43)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for i in iter {
        if let Ok(item) = i {
            items.push(item);
        }
    }
    Ok(items)
}

#[tauri::command]
pub fn create_card(
    workspace_id: String,
    project_id: Option<String>,
    team_id: Option<String>,
    title: String,
    description: Option<String>,
    type_name: Option<String>,
    priority: Option<String>,
    status: Option<String>,
    assigned_agent_id: Option<String>,
    acceptance_criteria: Option<String>,
    required_files: Option<String>,
    dependencies: Option<String>,
    state: State<DbState>,
) -> Result<String, String> {
    let conn = state.conn.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let t = type_name.unwrap_or_else(|| "task".to_string());
    let p = priority.unwrap_or_else(|| "medium".to_string());
    let s = status.unwrap_or_else(|| "Ready".to_string());

    conn.execute(
        "INSERT INTO kanban_cards (
            id, workspace_id, project_id, team_id, title, description, 
            type, priority, status, assigned_agent_id, 
            acceptance_criteria, required_files, dependencies, created_by
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, 'human')",
        params![
            id,
            workspace_id,
            project_id,
            team_id,
            title,
            description,
            t,
            p,
            s,
            assigned_agent_id,
            acceptance_criteria,
            required_files,
            dependencies
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(id)
}

#[tauri::command]
pub fn assign_card(card_id: String, agent_id: String, state: State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute("UPDATE kanban_cards SET assigned_agent_id = ?1, status = 'Assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![agent_id, card_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn move_card(
    card_id: String,
    new_status: String,
    reason: Option<String>,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();

    let current_status: String = conn
        .query_row(
            "SELECT status FROM kanban_cards WHERE id = ?1",
            [&card_id],
            |row| row.get(0),
        )
        .unwrap_or_default();

    if new_status == "In Progress" && current_status != "In Progress" {
        // Check dependencies before allowing execution
        let blocked_by: Option<String> = conn
            .query_row(
                "SELECT blocked_by FROM kanban_cards WHERE id = ?1",
                [&card_id],
                |row| row.get(0),
            )
            .unwrap_or_default();
        if let Some(blocker) = blocked_by {
            if !blocker.is_empty() {
                return Err(format!(
                    "Cannot start work. Task is blocked by: {}",
                    blocker
                ));
            }
        }

        let deps: Option<String> = conn
            .query_row(
                "SELECT dependencies FROM kanban_cards WHERE id = ?1",
                [&card_id],
                |row| row.get(0),
            )
            .unwrap_or_default();
        if let Some(deps_str) = deps {
            if !deps_str.is_empty() {
                let dep_ids: Vec<&str> = deps_str.split(',').collect();
                for dep_id in dep_ids {
                    let dep_status: String = conn
                        .query_row(
                            "SELECT status FROM kanban_cards WHERE id = ?1",
                            [dep_id.trim()],
                            |row| row.get(0),
                        )
                        .unwrap_or_default();
                    if dep_status != "Done" {
                        return Err(format!(
                            "Cannot start work. Dependency '{}' is not Done.",
                            dep_id
                        ));
                    }
                }
            }
        }
    }

    // If moving to Done, enforce rules!
    if new_status == "Done" {
        let mut stmt = conn.prepare("SELECT acceptance_criteria, completion_evidence, work_receipt_id, review_required, validation_status FROM kanban_cards WHERE id = ?1").unwrap();
        let row: (Option<String>, Option<String>, Option<String>, i32, String) = stmt
            .query_row([&card_id], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let has_evidence = row.1.is_some() && !row.1.as_ref().unwrap().is_empty();
        if !has_evidence {
            return Err("Cannot mark Done. Completion evidence is missing and validation did not pass! An agent or human must upload a work receipt before moving this card to Done.".to_string());
        }
    }

    conn.execute(
        "UPDATE kanban_cards SET status = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![new_status, card_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_agent_work_queue(
    agent_id: String,
    workspace_id: String,
    project_id: Option<String>,
    team_id: Option<String>,
    state: State<DbState>,
) -> Result<Vec<KanbanCard>, String> {
    let conn = state.conn.lock().unwrap();
    // Prioritized pull: In Progress > Unblocked Assigned > Ready
    let mut query = "SELECT id, workspace_id, project_id, team_id, board_id, backlog_id, parent_id, title, description, type, status, priority, rank, severity, labels, assigned_agent_id, assigned_human_id, reporter, created_by, created_at, updated_at, due_date, start_date, completed_at, estimate, actual_time, acceptance_criteria, definition_of_done, required_files, related_files, related_artifacts, dependencies, blocked_by, blocking, comments, activity_log, checklist, validation_status, completion_evidence, work_receipt_id, risk_level, review_required, approval_required, reopen_reason FROM kanban_cards WHERE workspace_id = ?1 AND assigned_agent_id = ?2 AND status IN ('In Progress', 'Assigned', 'Ready')".to_string();

    let mut params: Vec<String> = vec![workspace_id.clone(), agent_id.clone()];
    if let Some(pid) = project_id {
        query.push_str(&format!(" AND project_id = '?{}'", params.len() + 1));
        params.push(pid);
    }
    if let Some(tid) = team_id {
        query.push_str(&format!(" AND team_id = '?{}'", params.len() + 1));
        params.push(tid);
    }
    query.push_str(" ORDER BY status DESC, priority ASC, rank ASC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;

    // For brevity of implementation plan execution:
    let iter = stmt
        .query_map(rusqlite::params_from_iter(params), |row| {
            Ok(KanbanCard {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                project_id: row.get(2)?,
                team_id: row.get(3)?,
                board_id: row.get(4)?,
                backlog_id: row.get(5)?,
                parent_id: row.get(6)?,
                title: row.get(7)?,
                description: row.get(8)?,
                type_name: row.get(9)?,
                status: row.get(10)?,
                priority: row.get(11)?,
                rank: row.get(12)?,
                severity: row.get(13)?,
                labels: row.get(14)?,
                assigned_agent_id: row.get(15)?,
                assigned_human_id: row.get(16)?,
                reporter: row.get(17)?,
                created_by: row.get(18)?,
                created_at: row.get(19)?,
                updated_at: row.get(20)?,
                due_date: row.get(21)?,
                start_date: row.get(22)?,
                completed_at: row.get(23)?,
                estimate: row.get(24)?,
                actual_time: row.get(25)?,
                acceptance_criteria: row.get(26)?,
                definition_of_done: row.get(27)?,
                required_files: row.get(28)?,
                related_files: row.get(29)?,
                related_artifacts: row.get(30)?,
                dependencies: row.get(31)?,
                blocked_by: row.get(32)?,
                blocking: row.get(33)?,
                comments: row.get(34)?,
                activity_log: row.get(35)?,
                checklist: row.get(36)?,
                validation_status: row.get(37)?,
                completion_evidence: row.get(38)?,
                work_receipt_id: row.get(39)?,
                risk_level: row.get(40)?,
                review_required: row.get(41)?,
                approval_required: row.get(42)?,
                reopen_reason: row.get(43)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for i in iter {
        if let Ok(item) = i {
            items.push(item);
        }
    }
    Ok(items)
}
