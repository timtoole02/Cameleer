use crate::storage::DbState;
use rusqlite::{params, Connection, Result};
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
    pub instructions: Option<String>,
    pub type_name: String, // 'type' is a keyword, mapped from type
    pub priority: String,
    pub rank: i32,
    pub labels: Option<String>,
    pub source: String,
    pub status: String,
    pub owner_agent_id: Option<String>,
    pub owner_human_id: Option<String>,
    pub proposed_agent_role: Option<String>,
    pub suggested_agent_role: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub definition_of_done: Option<String>,
    pub required_files: Option<String>,
    pub refinement_notes: Option<String>,
    pub dependencies: Option<String>,
    pub risk_level: String,
    pub effort_estimate: Option<String>,
    pub readiness_score: i32,
    pub converted_card_id: Option<String>,
    pub archived_at: Option<String>,
    pub rejected_reason: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BacklogAcceptanceCriterion {
    pub id: String,
    pub backlog_item_id: String,
    pub text: String,
    pub sort_order: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct BacklogActivity {
    pub id: String,
    pub backlog_item_id: String,
    pub actor_id: Option<String>,
    pub actor_type: String,
    pub event_type: String,
    pub summary: String,
    pub details: Option<String>,
    pub created_at: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CreateBacklogItemInput {
    pub workspace_id: Option<String>,
    pub project_id: Option<String>,
    pub title: String,
    pub description: Option<String>,
    pub instructions: Option<String>,
    pub type_name: Option<String>,
    pub priority: Option<String>,
    pub risk_level: Option<String>,
    pub labels: Option<String>,
    pub owner_agent_id: Option<String>,
    pub suggested_agent_role: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub definition_of_done: Option<String>,
    pub dependencies: Option<String>,
    pub effort_estimate: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct UpdateBacklogItemInput {
    pub title: Option<String>,
    pub description: Option<String>,
    pub instructions: Option<String>,
    pub type_name: Option<String>,
    pub priority: Option<String>,
    pub status: Option<String>,
    pub labels: Option<String>,
    pub risk_level: Option<String>,
    pub effort_estimate: Option<String>,
    pub owner_agent_id: Option<String>,
    pub suggested_agent_role: Option<String>,
    pub acceptance_criteria: Option<String>,
    pub definition_of_done: Option<String>,
    pub dependencies: Option<String>,
    pub rejected_reason: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AgentSuggestion {
    pub suggested_agent_id: Option<String>,
    pub suggested_agent_name: Option<String>,
    pub suggested_agent_role: String,
    pub reason: String,
    pub source: String,
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

fn is_meaningful(value: Option<&str>) -> bool {
    value.map(|v| !v.trim().is_empty()).unwrap_or(false)
}

fn has_acceptance_criteria(value: Option<&str>) -> bool {
    let Some(raw) = value.map(str::trim).filter(|v| !v.is_empty()) else {
        return false;
    };

    match serde_json::from_str::<serde_json::Value>(raw) {
        Ok(serde_json::Value::Array(items)) => items.iter().any(|item| match item {
            serde_json::Value::String(text) => !text.trim().is_empty(),
            serde_json::Value::Null => false,
            other => !other.to_string().trim().is_empty(),
        }),
        _ => true,
    }
}

fn normalize_backlog_status(status: &str) -> String {
    match status.trim().to_lowercase().replace('-', "_").as_str() {
        "backlog" => "captured".to_string(),
        "ready_for_board" => "converted".to_string(),
        "captured" | "triage" | "needs_refinement" | "refined" | "ready" | "converted"
        | "rejected" | "archived" => status.trim().to_lowercase().replace('-', "_"),
        _ => "captured".to_string(),
    }
}

fn calculate_backlog_readiness_score(
    title: &str,
    description: Option<&str>,
    instructions: Option<&str>,
    acceptance_criteria: Option<&str>,
    priority: Option<&str>,
    type_name: Option<&str>,
    owner_agent_id: Option<&str>,
    suggested_agent_role: Option<&str>,
) -> i32 {
    let mut score = 0;
    if !title.trim().is_empty() {
        score += 15;
    }
    if is_meaningful(description) {
        score += 15;
    }
    if is_meaningful(instructions) {
        score += 25;
    }
    if has_acceptance_criteria(acceptance_criteria) {
        score += 25;
    }
    if is_meaningful(priority) {
        score += 5;
    }
    if is_meaningful(type_name) {
        score += 5;
    }
    if is_meaningful(owner_agent_id) || is_meaningful(suggested_agent_role) {
        score += 10;
    }
    score
}

fn required_ready_missing(item: &BacklogItem) -> Vec<&'static str> {
    let mut missing = Vec::new();
    if item.title.trim().is_empty() {
        missing.push("title");
    }
    if !is_meaningful(item.description.as_deref()) && !is_meaningful(item.instructions.as_deref()) {
        missing.push("description or instructions");
    }
    if !is_meaningful(Some(&item.type_name)) {
        missing.push("type");
    }
    if !is_meaningful(Some(&item.priority)) {
        missing.push("priority");
    }
    if !has_acceptance_criteria(item.acceptance_criteria.as_deref()) {
        missing.push("acceptance criteria");
    }
    if !is_meaningful(item.owner_agent_id.as_deref())
        && !is_meaningful(item.suggested_agent_role.as_deref())
    {
        missing.push("assigned or suggested agent");
    }
    missing
}

fn insert_backlog_activity(
    conn: &Connection,
    backlog_item_id: &str,
    event_type: &str,
    summary: &str,
    details: Option<serde_json::Value>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO backlog_activity (id, backlog_item_id, actor_type, event_type, summary, details)
         VALUES (?1, ?2, 'user', ?3, ?4, ?5)",
        params![
            Uuid::new_v4().to_string(),
            backlog_item_id,
            event_type,
            summary,
            details.map(|v| v.to_string())
        ],
    )?;
    Ok(())
}

fn insert_task_activity(
    conn: &Connection,
    task_id: &str,
    event_type: &str,
    summary: &str,
    details: Option<serde_json::Value>,
) -> Result<()> {
    conn.execute(
        "INSERT INTO task_activity (id, task_id, actor_type, event_type, summary, details)
         VALUES (?1, ?2, 'user', ?3, ?4, ?5)",
        params![
            Uuid::new_v4().to_string(),
            task_id,
            event_type,
            summary,
            details.map(|v| v.to_string())
        ],
    )?;
    Ok(())
}

fn next_task_key(conn: &Connection) -> Result<String> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM kanban_cards", [], |row| row.get(0))?;
    Ok(format!("CAM-{}", count + 101))
}

fn get_backlog_item_by_id(conn: &Connection, id: &str) -> Result<BacklogItem> {
    conn.query_row(
        "SELECT id, workspace_id, project_id, team_id, backlog_id, title, description, instructions,
                type, priority, rank, labels, source, status, owner_agent_id, owner_human_id,
                proposed_agent_role, suggested_agent_role, acceptance_criteria, definition_of_done,
                required_files, refinement_notes, dependencies, risk_level, effort_estimate,
                readiness_score, converted_card_id, archived_at, rejected_reason, created_at, updated_at
         FROM backlog_items WHERE id = ?1",
        [id],
        |row| {
            Ok(BacklogItem {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                project_id: row.get(2)?,
                team_id: row.get(3)?,
                backlog_id: row.get(4)?,
                title: row.get(5)?,
                description: row.get(6)?,
                instructions: row.get(7)?,
                type_name: row.get(8)?,
                priority: row.get(9)?,
                rank: row.get(10)?,
                labels: row.get(11)?,
                source: row.get(12)?,
                status: row.get(13)?,
                owner_agent_id: row.get(14)?,
                owner_human_id: row.get(15)?,
                proposed_agent_role: row.get(16)?,
                suggested_agent_role: row.get(17)?,
                acceptance_criteria: row.get(18)?,
                definition_of_done: row.get(19)?,
                required_files: row.get(20)?,
                refinement_notes: row.get(21)?,
                dependencies: row.get(22)?,
                risk_level: row.get(23)?,
                effort_estimate: row.get(24)?,
                readiness_score: row.get(25)?,
                converted_card_id: row.get(26)?,
                archived_at: row.get(27)?,
                rejected_reason: row.get(28)?,
                created_at: row.get(29)?,
                updated_at: row.get(30)?,
            })
        },
    )
}

fn get_kanban_card_by_id(conn: &Connection, id: &str) -> Result<KanbanCard> {
    conn.query_row(
        "SELECT id, workspace_id, project_id, team_id, board_id, backlog_id, parent_id,
                title, description, type as type_name, status, priority, rank, severity, labels,
                assigned_agent_id, assigned_human_id, reporter, created_by, created_at, updated_at,
                due_date, start_date, completed_at, estimate, actual_time, acceptance_criteria,
                definition_of_done, required_files, related_files, related_artifacts, dependencies,
                blocked_by, blocking, comments, activity_log, checklist, validation_status,
                completion_evidence, work_receipt_id, risk_level, review_required, approval_required,
                reopen_reason
         FROM kanban_cards WHERE id = ?1",
        [id],
        |row| {
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
        },
    )
}

fn sync_backlog_acceptance_criteria(conn: &Connection, backlog_item_id: &str) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT text FROM backlog_acceptance_criteria
         WHERE backlog_item_id = ?1 ORDER BY sort_order ASC, created_at ASC",
    )?;
    let criteria: Vec<String> = stmt
        .query_map([backlog_item_id], |row| row.get::<_, String>(0))?
        .filter_map(Result::ok)
        .collect();
    if !criteria.is_empty() {
        conn.execute(
            "UPDATE backlog_items SET acceptance_criteria = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![serde_json::to_string(&criteria).unwrap_or_else(|_| "[]".to_string()), backlog_item_id],
        )?;
    }
    Ok(())
}

#[tauri::command]
pub fn list_board_columns(_workspace_id: String) -> Result<Vec<BoardColumn>, String> {
    let names = [
        ("col-backlog", "Backlog", "backlog", 0, None),
        ("col-ready", "Ready", "ready", 1, Some(5)),
        ("col-in-progress", "In Progress", "in_progress", 2, Some(3)),
        ("col-review", "Review", "review", 3, Some(5)),
        ("col-blocked", "Blocked", "blocked", 4, None),
        ("col-done", "Done", "done", 5, None),
    ];
    Ok(names
        .into_iter()
        .map(|(id, name, status, rank, wip)| BoardColumn {
            id: id.to_string(),
            board_id: "default-board".to_string(),
            name: name.to_string(),
            status_mapping: status.to_string(),
            rank,
            wip_limit: wip,
            created_at: "system".to_string(),
        })
        .collect())
}

#[tauri::command]
pub fn create_board_column() -> Result<(), String> {
    Err("Custom board columns are not editable in this Kanban slice yet.".to_string())
}

#[tauri::command]
pub fn update_board_column() -> Result<(), String> {
    Err("Custom board columns are not editable in this Kanban slice yet.".to_string())
}

#[tauri::command]
pub fn move_board_column() -> Result<(), String> {
    Err("Custom board columns are not editable in this Kanban slice yet.".to_string())
}

#[tauri::command]
pub fn set_column_wip_limit() -> Result<(), String> {
    Err("Column WIP limit editing is not enabled in this Kanban slice yet.".to_string())
}

#[tauri::command]
pub fn get_backlog_snapshot(
    workspace_id: String,
    _project_id: Option<String>,
    _team_id: Option<String>,
    state: State<DbState>,
) -> Result<Vec<BacklogItem>, String> {
    list_backlog_items(workspace_id, state)
}

#[tauri::command]
pub fn list_backlog_items(
    workspace_id: String,
    state: State<DbState>,
) -> Result<Vec<BacklogItem>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id FROM backlog_items
             WHERE workspace_id = ?1
             ORDER BY
                CASE status
                    WHEN 'captured' THEN 0
                    WHEN 'triage' THEN 1
                    WHEN 'needs_refinement' THEN 2
                    WHEN 'refined' THEN 3
                    WHEN 'ready' THEN 4
                    WHEN 'converted' THEN 5
                    WHEN 'rejected' THEN 6
                    WHEN 'archived' THEN 7
                    ELSE 8
                END,
                updated_at DESC",
        )
        .map_err(|e| e.to_string())?;
    let ids: Vec<String> = stmt
        .query_map([workspace_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .filter_map(Result::ok)
        .collect();

    ids.into_iter()
        .map(|id| get_backlog_item_by_id(&conn, &id).map_err(|e| e.to_string()))
        .collect()
}

#[tauri::command]
pub fn get_backlog_item(id: String, state: State<DbState>) -> Result<BacklogItem, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    get_backlog_item_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_backlog_item(
    input: CreateBacklogItemInput,
    state: State<DbState>,
) -> Result<BacklogItem, String> {
    if input.title.trim().is_empty() {
        return Err("Backlog item title is required.".to_string());
    }

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let workspace_id = input
        .workspace_id
        .unwrap_or_else(|| "default-workspace".to_string());
    let type_name = input.type_name.unwrap_or_else(|| "idea".to_string());
    let priority = input.priority.unwrap_or_else(|| "medium".to_string());
    let risk_level = input.risk_level.unwrap_or_else(|| "unknown".to_string());
    let score = calculate_backlog_readiness_score(
        &input.title,
        input.description.as_deref(),
        input.instructions.as_deref(),
        input.acceptance_criteria.as_deref(),
        Some(&priority),
        Some(&type_name),
        input.owner_agent_id.as_deref(),
        input.suggested_agent_role.as_deref(),
    );
    let status = match score {
        90..=100 => "ready",
        70..=89 => "refined",
        40..=69 => "needs_refinement",
        _ => "captured",
    };

    conn.execute(
        "INSERT INTO backlog_items (
            id, workspace_id, project_id, title, description, instructions, type, priority,
            status, labels, risk_level, effort_estimate, owner_agent_id, proposed_agent_role,
            suggested_agent_role, acceptance_criteria, definition_of_done, dependencies,
            readiness_score
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14, ?15, ?16, ?17, ?18)",
        params![
            id,
            workspace_id,
            input.project_id,
            input.title,
            input.description,
            input.instructions,
            type_name,
            priority,
            status,
            input.labels,
            risk_level,
            input.effort_estimate,
            input.owner_agent_id,
            input.suggested_agent_role,
            input.acceptance_criteria,
            input.definition_of_done,
            input.dependencies,
            score
        ],
    )
    .map_err(|e| e.to_string())?;
    insert_backlog_activity(&conn, &id, "created", "Backlog item created", None)
        .map_err(|e| e.to_string())?;

    get_backlog_item_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_backlog_item(
    id: String,
    input: UpdateBacklogItemInput,
    state: State<DbState>,
) -> Result<BacklogItem, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    if let Some(v) = input.title {
        conn.execute(
            "UPDATE backlog_items SET title = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![v, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.description {
        conn.execute("UPDATE backlog_items SET description = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.instructions {
        conn.execute("UPDATE backlog_items SET instructions = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.type_name {
        conn.execute(
            "UPDATE backlog_items SET type = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![v, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.priority {
        conn.execute(
            "UPDATE backlog_items SET priority = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![v, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.status {
        let status = normalize_backlog_status(&v);
        conn.execute(
            "UPDATE backlog_items SET status = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![status, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.labels {
        conn.execute(
            "UPDATE backlog_items SET labels = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            params![v, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.risk_level {
        conn.execute("UPDATE backlog_items SET risk_level = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.effort_estimate {
        conn.execute("UPDATE backlog_items SET effort_estimate = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.owner_agent_id {
        conn.execute("UPDATE backlog_items SET owner_agent_id = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.suggested_agent_role {
        conn.execute("UPDATE backlog_items SET suggested_agent_role = ?1, proposed_agent_role = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.acceptance_criteria {
        conn.execute("UPDATE backlog_items SET acceptance_criteria = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.definition_of_done {
        conn.execute("UPDATE backlog_items SET definition_of_done = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.dependencies {
        conn.execute("UPDATE backlog_items SET dependencies = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }
    if let Some(v) = input.rejected_reason {
        conn.execute("UPDATE backlog_items SET rejected_reason = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![v, id]).map_err(|e| e.to_string())?;
    }

    let item = get_backlog_item_by_id(&conn, &id).map_err(|e| e.to_string())?;
    let score = calculate_backlog_readiness_score(
        &item.title,
        item.description.as_deref(),
        item.instructions.as_deref(),
        item.acceptance_criteria.as_deref(),
        Some(&item.priority),
        Some(&item.type_name),
        item.owner_agent_id.as_deref(),
        item.suggested_agent_role.as_deref(),
    );
    conn.execute(
        "UPDATE backlog_items SET readiness_score = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
        params![score, id],
    )
    .map_err(|e| e.to_string())?;
    insert_backlog_activity(&conn, &id, "updated", "Backlog item updated", None)
        .map_err(|e| e.to_string())?;
    get_backlog_item_by_id(&conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn convert_backlog_item_to_card(
    id: String,
    state: State<DbState>,
) -> Result<KanbanCard, String> {
    convert_backlog_item_to_task(id, state)
}

#[tauri::command]
pub fn convert_backlog_item_to_task(
    id: String,
    state: State<DbState>,
) -> Result<KanbanCard, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    convert_backlog_item_to_task_with_conn(&conn, &id)
}

fn convert_backlog_item_to_task_with_conn(
    conn: &Connection,
    id: &str,
) -> Result<KanbanCard, String> {
    sync_backlog_acceptance_criteria(conn, id).map_err(|e| e.to_string())?;
    let item = get_backlog_item_by_id(conn, id).map_err(|e| e.to_string())?;

    if let Some(card_id) = item.converted_card_id.as_deref() {
        if !card_id.trim().is_empty() {
            return get_kanban_card_by_id(conn, card_id).map_err(|e| e.to_string());
        }
    }

    let missing = required_ready_missing(&item);
    if !missing.is_empty() {
        return Err(format!(
            "Cannot convert backlog item yet. Missing: {}.",
            missing.join(", ")
        ));
    }

    let card_id = Uuid::new_v4().to_string();
    let task_key = next_task_key(conn).map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO kanban_cards (
            id, task_key, workspace_id, project_id, backlog_id, title, description, instructions,
            type, priority, status, labels, assigned_agent_id, reporter, created_by,
            acceptance_criteria, definition_of_done, dependencies, risk_level, review_required,
            validation_status
         )
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 'ready', ?11, ?12, 'human', 'human',
                 ?13, ?14, ?15, ?16, 1, 'not_started')",
        params![
            card_id,
            task_key,
            item.workspace_id,
            item.project_id,
            item.backlog_id,
            item.title,
            item.description,
            item.instructions,
            item.type_name,
            item.priority,
            item.labels,
            item.owner_agent_id,
            item.acceptance_criteria,
            item.definition_of_done,
            item.dependencies,
            item.risk_level
        ],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE backlog_items
         SET status = 'converted', converted_card_id = ?1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?2",
        params![card_id, id],
    )
    .map_err(|e| e.to_string())?;
    insert_backlog_activity(
        conn,
        &id,
        "converted_to_task",
        &format!("Converted to Kanban task {}", task_key),
        Some(serde_json::json!({ "task_id": card_id, "task_key": task_key })),
    )
    .map_err(|e| e.to_string())?;
    insert_task_activity(
        conn,
        &card_id,
        "created_from_backlog",
        "Task created from backlog item",
        Some(serde_json::json!({ "backlog_item_id": id })),
    )
    .map_err(|e| e.to_string())?;

    get_kanban_card_by_id(conn, &card_id).map_err(|e| e.to_string())
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::storage::init_db;

    fn setup_backlog_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn.execute(
            "INSERT INTO workspaces (id, name, path, active)
             VALUES ('default-workspace', 'Default Workspace', '/tmp/cameleer-test', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO backlogs (id, workspace_id, name)
             VALUES ('product-backlog', 'default-workspace', 'Product Backlog')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO agents (id, name, role, persona, model_provider, model_name)
             VALUES ('agent-backend', 'Backend Debugger', 'Senior Rust backend engineer', 'Debug backend issues clearly.', 'camelid', 'Llama 3.2 1B Instruct')",
            [],
        )
        .unwrap();
        conn
    }

    fn insert_convertible_backlog_item(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO backlog_items (
                id, workspace_id, backlog_id, title, description, instructions, type, priority,
                status, owner_agent_id, suggested_agent_role, acceptance_criteria, risk_level
             )
             VALUES (?1, 'default-workspace', 'product-backlog', 'Ship import queue', 'Build the queue',
                     'Persist receipts for each imported record', 'feature', 'high',
                     'ready', 'agent-backend', 'Backend Engineer', ?2, 'medium')",
            params![id, r#"["Queue persists successful imports","Failures are visible"]"#],
        )
        .unwrap();
    }

    #[test]
    fn create_backlog_item_persists() {
        let conn = setup_backlog_db();
        insert_convertible_backlog_item(&conn, "backlog-create");

        let title: String = conn
            .query_row(
                "SELECT title FROM backlog_items WHERE id = 'backlog-create'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(title, "Ship import queue");
    }

    #[test]
    fn update_backlog_item_persists() {
        let conn = setup_backlog_db();
        insert_convertible_backlog_item(&conn, "backlog-update");
        conn.execute(
            "UPDATE backlog_items SET instructions = 'Updated detailed instructions' WHERE id = 'backlog-update'",
            [],
        )
        .unwrap();

        let instructions: String = conn
            .query_row(
                "SELECT instructions FROM backlog_items WHERE id = 'backlog-update'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(instructions, "Updated detailed instructions");
    }

    #[test]
    fn empty_acceptance_criteria_json_is_not_ready() {
        assert!(!has_acceptance_criteria(None));
        assert!(!has_acceptance_criteria(Some("")));
        assert!(!has_acceptance_criteria(Some("[]")));
        assert!(!has_acceptance_criteria(Some(r#"["   "]"#)));
        assert!(has_acceptance_criteria(Some(
            r#"["User can retry failed imports"]"#
        )));
        assert!(has_acceptance_criteria(Some(
            "Plain-language acceptance criteria"
        )));
    }

    #[test]
    fn conversion_rejects_empty_synced_acceptance_criteria() {
        let conn = setup_backlog_db();
        insert_convertible_backlog_item(&conn, "backlog-empty-criteria");
        conn.execute(
            "UPDATE backlog_items SET acceptance_criteria = NULL WHERE id = 'backlog-empty-criteria'",
            [],
        )
        .unwrap();

        let error = convert_backlog_item_to_task_with_conn(&conn, "backlog-empty-criteria")
            .expect_err("empty synced criteria must block conversion");

        assert!(error.contains("acceptance criteria"), "{error}");
        let cards: i64 = conn
            .query_row("SELECT COUNT(*) FROM kanban_cards", [], |row| row.get(0))
            .unwrap();
        assert_eq!(cards, 0);
    }

    #[test]
    fn conversion_is_idempotent_for_converted_backlog_item() {
        let conn = setup_backlog_db();
        insert_convertible_backlog_item(&conn, "backlog-ready");
        conn.execute(
            "INSERT INTO backlog_acceptance_criteria (id, backlog_item_id, text, sort_order)
             VALUES ('criterion-ready', 'backlog-ready', 'Queue persists successful imports', 0)",
            [],
        )
        .unwrap();

        let first = convert_backlog_item_to_task_with_conn(&conn, "backlog-ready").unwrap();
        let second = convert_backlog_item_to_task_with_conn(&conn, "backlog-ready").unwrap();

        assert_eq!(first.id, second.id);
        assert_eq!(first.backlog_id.as_deref(), Some("product-backlog"));
        assert_eq!(first.status, "ready");
        let cards: i64 = conn
            .query_row("SELECT COUNT(*) FROM kanban_cards", [], |row| row.get(0))
            .unwrap();
        assert_eq!(cards, 1);
    }

    #[test]
    fn convert_backlog_item_to_task_creates_task() {
        let conn = setup_backlog_db();
        insert_convertible_backlog_item(&conn, "backlog-create-task");

        let task = convert_backlog_item_to_task_with_conn(&conn, "backlog-create-task").unwrap();

        assert_eq!(task.title, "Ship import queue");
        assert_eq!(task.status, "ready");
        assert_eq!(task.assigned_agent_id.as_deref(), Some("agent-backend"));
    }

    #[test]
    fn convert_backlog_item_to_task_copies_instructions() {
        let conn = setup_backlog_db();
        insert_convertible_backlog_item(&conn, "backlog-copy-instructions");

        let task =
            convert_backlog_item_to_task_with_conn(&conn, "backlog-copy-instructions").unwrap();
        let instructions: String = conn
            .query_row(
                "SELECT instructions FROM kanban_cards WHERE id = ?1",
                [&task.id],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(instructions, "Persist receipts for each imported record");
    }

    #[test]
    fn convert_backlog_item_to_task_copies_acceptance_criteria() {
        let conn = setup_backlog_db();
        insert_convertible_backlog_item(&conn, "backlog-copy-criteria");

        let task = convert_backlog_item_to_task_with_conn(&conn, "backlog-copy-criteria").unwrap();

        assert!(task
            .acceptance_criteria
            .as_deref()
            .unwrap_or_default()
            .contains("Queue persists successful imports"));
    }

    #[test]
    fn convert_backlog_item_to_task_is_idempotent() {
        let conn = setup_backlog_db();
        insert_convertible_backlog_item(&conn, "backlog-idempotent");

        let first = convert_backlog_item_to_task_with_conn(&conn, "backlog-idempotent").unwrap();
        let second = convert_backlog_item_to_task_with_conn(&conn, "backlog-idempotent").unwrap();

        assert_eq!(first.id, second.id);
    }
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
    conn.execute("UPDATE kanban_cards SET assigned_agent_id = ?1, status = 'assigned', updated_at = CURRENT_TIMESTAMP WHERE id = ?2", params![agent_id, card_id]).map_err(|e| e.to_string())?;

    let payload = serde_json::json!({
        "assigned_agent_id": agent_id,
        "status": "assigned"
    })
    .to_string();
    let _ = conn.execute("INSERT INTO events (event_type, task_id, agent_id, payload) VALUES ('card_assigned', ?1, ?2, ?3)", params![card_id, agent_id, payload]);

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
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_default()
        .to_lowercase();

    let new_status = new_status.to_lowercase();

    if new_status == "in_progress" && current_status != "in_progress" {
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
                    if dep_status.to_lowercase() != "done" {
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
    if new_status == "done" || new_status == "Done" {
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

    let payload = serde_json::json!({
        "old_status": current_status,
        "new_status": new_status,
        "reason": reason.unwrap_or_default()
    })
    .to_string();
    let _ = conn.execute(
        "INSERT INTO events (event_type, task_id, payload) VALUES ('card_status_changed', ?1, ?2)",
        params![card_id, payload],
    );

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
    let mut query = "SELECT id, workspace_id, project_id, team_id, board_id, backlog_id, parent_id, title, description, type, status, priority, rank, severity, labels, assigned_agent_id, assigned_human_id, reporter, created_by, created_at, updated_at, due_date, start_date, completed_at, estimate, actual_time, acceptance_criteria, definition_of_done, required_files, related_files, related_artifacts, dependencies, blocked_by, blocking, comments, activity_log, checklist, validation_status, completion_evidence, work_receipt_id, risk_level, review_required, approval_required, reopen_reason FROM kanban_cards WHERE workspace_id = ?1 AND assigned_agent_id = ?2 AND status IN ('In Progress', 'Assigned', 'Ready', 'in_progress', 'assigned', 'ready')".to_string();

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
