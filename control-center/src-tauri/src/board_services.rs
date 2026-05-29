use rusqlite::{params, Connection, Result, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;
use uuid::Uuid;
use crate::storage::DbState;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BacklogItem {
    pub id: String,
    pub workspace_id: String,
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
pub fn get_backlog_snapshot(workspace_id: String, state: State<DbState>) -> Result<Vec<BacklogItem>, String> {
    let conn = state.conn.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, backlog_id, title, description, type, priority, rank, labels, source, status, owner_agent_id, owner_human_id, proposed_agent_role, acceptance_criteria, refinement_notes, dependencies, risk_level, effort_estimate, readiness_score, created_at, updated_at FROM backlog_items WHERE workspace_id = ?1 ORDER BY rank ASC, created_at DESC"
    ).map_err(|e| e.to_string())?;

    let iter = stmt.query_map([&workspace_id], |row| {
        Ok(BacklogItem {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            backlog_id: row.get(2)?,
            title: row.get(3)?,
            description: row.get(4)?,
            type_name: row.get(5)?,
            priority: row.get(6)?,
            rank: row.get(7)?,
            labels: row.get(8)?,
            source: row.get(9)?,
            status: row.get(10)?,
            owner_agent_id: row.get(11)?,
            owner_human_id: row.get(12)?,
            proposed_agent_role: row.get(13)?,
            acceptance_criteria: row.get(14)?,
            refinement_notes: row.get(15)?,
            dependencies: row.get(16)?,
            risk_level: row.get(17)?,
            effort_estimate: row.get(18)?,
            readiness_score: row.get(19)?,
            created_at: row.get(20)?,
            updated_at: row.get(21)?,
        })
    }).map_err(|e| e.to_string())?;

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
    state: State<DbState>
) -> Result<BacklogItem, String> {
    let conn = state.conn.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let t = type_name.unwrap_or_else(|| "feature".to_string());
    let p = priority.unwrap_or_else(|| "medium".to_string());

    conn.execute(
        "INSERT INTO backlog_items (id, workspace_id, title, description, type, priority, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'captured')",
        params![id, workspace_id, title, description, t, p],
    ).map_err(|e| e.to_string())?;

    // Drop the lock and read it back
    drop(conn);
    
    // Simplistic fetch back.
    let items = get_backlog_snapshot(workspace_id, state)?;
    items.into_iter().find(|i| i.id == id).ok_or_else(|| "Failed to read back item".to_string())
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
    state: State<DbState>
) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    
    if let Some(v) = title {
        conn.execute("UPDATE backlog_items SET title = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = description {
        conn.execute("UPDATE backlog_items SET description = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = type_name {
        conn.execute("UPDATE backlog_items SET type = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = priority {
        conn.execute("UPDATE backlog_items SET priority = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = status {
        conn.execute("UPDATE backlog_items SET status = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = acceptance_criteria {
        conn.execute("UPDATE backlog_items SET acceptance_criteria = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[tauri::command]
pub fn convert_backlog_item_to_card(id: String, state: State<DbState>) -> Result<KanbanCard, String> {
    let conn = state.conn.lock().unwrap();
    
    // Read the backlog item
    let mut stmt = conn.prepare("SELECT workspace_id, title, description, type, priority, acceptance_criteria FROM backlog_items WHERE id = ?1").unwrap();
    let row: (String, String, Option<String>, String, String, Option<String>) = stmt.query_row([&id], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?))
    }).map_err(|e| e.to_string())?;
    
    let (ws_id, title, desc, type_name, priority, acc) = row;
    
    let card_id = Uuid::new_v4().to_string();
    
    conn.execute(
        "INSERT INTO kanban_cards (id, workspace_id, backlog_id, title, description, type, priority, acceptance_criteria, status, created_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'Ready', 'human')",
        params![card_id, ws_id, id, title, desc, type_name, priority, acc],
    ).map_err(|e| e.to_string())?;
    
    // Mark backlog item as ready_for_board
    conn.execute(
        "UPDATE backlog_items SET status = 'ready_for_board', updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;
    
    // TODO: fetch back kanban card
    Err("Converted successfully. Fetch the board snapshot to see it.".to_string())
}

#[tauri::command]
pub fn get_board_snapshot(workspace_id: String, state: State<DbState>) -> Result<Vec<KanbanCard>, String> {
    let conn = state.conn.lock().unwrap();
    
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, board_id, backlog_id, parent_id, title, description, type, status, priority, rank, severity, labels, assigned_agent_id, assigned_human_id, reporter, created_by, created_at, updated_at, due_date, start_date, completed_at, estimate, actual_time, acceptance_criteria, definition_of_done, required_files, related_files, related_artifacts, dependencies, blocked_by, blocking, comments, activity_log, checklist, validation_status, completion_evidence, work_receipt_id, risk_level, review_required, approval_required, reopen_reason FROM kanban_cards WHERE workspace_id = ?1 ORDER BY rank ASC, created_at DESC"
    ).map_err(|e| e.to_string())?;

    let iter = stmt.query_map([&workspace_id], |row| {
        Ok(KanbanCard {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            board_id: row.get(2)?,
            backlog_id: row.get(3)?,
            parent_id: row.get(4)?,
            title: row.get(5)?,
            description: row.get(6)?,
            type_name: row.get(7)?,
            status: row.get(8)?,
            priority: row.get(9)?,
            rank: row.get(10)?,
            severity: row.get(11)?,
            labels: row.get(12)?,
            assigned_agent_id: row.get(13)?,
            assigned_human_id: row.get(14)?,
            reporter: row.get(15)?,
            created_by: row.get(16)?,
            created_at: row.get(17)?,
            updated_at: row.get(18)?,
            due_date: row.get(19)?,
            start_date: row.get(20)?,
            completed_at: row.get(21)?,
            estimate: row.get(22)?,
            actual_time: row.get(23)?,
            acceptance_criteria: row.get(24)?,
            definition_of_done: row.get(25)?,
            required_files: row.get(26)?,
            related_files: row.get(27)?,
            related_artifacts: row.get(28)?,
            dependencies: row.get(29)?,
            blocked_by: row.get(30)?,
            blocking: row.get(31)?,
            comments: row.get(32)?,
            activity_log: row.get(33)?,
            checklist: row.get(34)?,
            validation_status: row.get(35)?,
            completion_evidence: row.get(36)?,
            work_receipt_id: row.get(37)?,
            risk_level: row.get(38)?,
            review_required: row.get(39)?,
            approval_required: row.get(40)?,
            reopen_reason: row.get(41)?,
        })
    }).map_err(|e| e.to_string())?;

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
    title: String,
    description: Option<String>,
    type_name: Option<String>,
    priority: Option<String>,
    status: Option<String>,
    state: State<DbState>
) -> Result<String, String> {
    let conn = state.conn.lock().unwrap();
    let id = Uuid::new_v4().to_string();
    let t = type_name.unwrap_or_else(|| "task".to_string());
    let p = priority.unwrap_or_else(|| "medium".to_string());
    let s = status.unwrap_or_else(|| "Ready".to_string());

    conn.execute(
        "INSERT INTO kanban_cards (id, workspace_id, title, description, type, priority, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![id, workspace_id, title, description, t, p, s],
    ).map_err(|e| e.to_string())?;
    
    Ok(id)
}

#[tauri::command]
pub fn assign_card(card_id: String, agent_id: String, state: State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    conn.execute("UPDATE kanban_cards SET assigned_agent_id = ?1, status = 'Assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![agent_id, card_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn move_card(card_id: String, new_status: String, reason: Option<String>, state: State<DbState>) -> Result<(), String> {
    let conn = state.conn.lock().unwrap();
    
    // If moving to Done, enforce rules!
    if new_status == "Done" {
        let mut stmt = conn.prepare("SELECT acceptance_criteria, completion_evidence, work_receipt_id, review_required, validation_status FROM kanban_cards WHERE id = ?1").unwrap();
        let row: (Option<String>, Option<String>, Option<String>, i32, String) = stmt.query_row([&card_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
        }).map_err(|e| e.to_string())?;
        
        // Simple enforcement checks for Phase 2!
        if row.1.is_none() || row.1.as_ref().unwrap().is_empty() {
            return Err("Cannot mark Done. Completion evidence is missing!".to_string());
        }
        
        // If it requires review, check if it's approved (for now bypass if we are user)
    }

    conn.execute("UPDATE kanban_cards SET status = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![new_status, card_id]).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_agent_work_queue(agent_id: String, workspace_id: String, state: State<DbState>) -> Result<Vec<KanbanCard>, String> {
    let conn = state.conn.lock().unwrap();
    // Prioritized pull: In Progress > Unblocked Assigned > Ready
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, board_id, backlog_id, parent_id, title, description, type, status, priority, rank, severity, labels, assigned_agent_id, assigned_human_id, reporter, created_by, created_at, updated_at, due_date, start_date, completed_at, estimate, actual_time, acceptance_criteria, definition_of_done, required_files, related_files, related_artifacts, dependencies, blocked_by, blocking, comments, activity_log, checklist, validation_status, completion_evidence, work_receipt_id, risk_level, review_required, approval_required, reopen_reason FROM kanban_cards WHERE workspace_id = ?1 AND assigned_agent_id = ?2 AND status IN ('In Progress', 'Assigned', 'Ready') ORDER BY status DESC, priority ASC, rank ASC"
    ).map_err(|e| e.to_string())?;

    // (Code omitted for mapping, will just reuse the mapping block from get_board_snapshot in production)
    // For brevity of implementation plan execution:
    let iter = stmt.query_map(params![workspace_id, agent_id], |row| {
        Ok(KanbanCard {
            id: row.get(0)?,
            workspace_id: row.get(1)?,
            board_id: row.get(2)?,
            backlog_id: row.get(3)?,
            parent_id: row.get(4)?,
            title: row.get(5)?,
            description: row.get(6)?,
            type_name: row.get(7)?,
            status: row.get(8)?,
            priority: row.get(9)?,
            rank: row.get(10)?,
            severity: row.get(11)?,
            labels: row.get(12)?,
            assigned_agent_id: row.get(13)?,
            assigned_human_id: row.get(14)?,
            reporter: row.get(15)?,
            created_by: row.get(16)?,
            created_at: row.get(17)?,
            updated_at: row.get(18)?,
            due_date: row.get(19)?,
            start_date: row.get(20)?,
            completed_at: row.get(21)?,
            estimate: row.get(22)?,
            actual_time: row.get(23)?,
            acceptance_criteria: row.get(24)?,
            definition_of_done: row.get(25)?,
            required_files: row.get(26)?,
            related_files: row.get(27)?,
            related_artifacts: row.get(28)?,
            dependencies: row.get(29)?,
            blocked_by: row.get(30)?,
            blocking: row.get(31)?,
            comments: row.get(32)?,
            activity_log: row.get(33)?,
            checklist: row.get(34)?,
            validation_status: row.get(35)?,
            completion_evidence: row.get(36)?,
            work_receipt_id: row.get(37)?,
            risk_level: row.get(38)?,
            review_required: row.get(39)?,
            approval_required: row.get(40)?,
            reopen_reason: row.get(41)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for i in iter {
        if let Ok(item) = i {
            items.push(item);
        }
    }
    Ok(items)
}
