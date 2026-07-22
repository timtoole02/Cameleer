use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KanbanCard {
    pub id: String,
    pub title: String,
    pub status: String,
    pub priority: String,
    pub assigned_agent_id: Option<String>,
    pub dependencies: Vec<String>,
    pub blocked_by: Option<String>,
    pub review_required: i32,
    pub validation_status: String,
}

pub fn get_agent_work_queue(agent_id: &str, conn: &Connection) -> Result<Vec<KanbanCard>, String> {
    let mut stmt = conn.prepare(
        "SELECT id, title, status, priority, assigned_agent_id, dependencies, blocked_by, review_required, validation_status 
         FROM kanban_cards 
         WHERE (assigned_agent_id = ?1 OR reporter = ?1) AND LOWER(status) != 'done'"
    ).map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([agent_id], |row| {
            let deps_str: Option<String> = row.get(5)?;
            let deps: Vec<String> = deps_str
                .map(|s| serde_json::from_str(&s).unwrap_or_default())
                .unwrap_or_default();

            Ok(KanbanCard {
                id: row.get(0)?,
                title: row.get(1)?,
                status: row.get(2)?,
                priority: row.get(3)?,
                assigned_agent_id: row.get(4)?,
                dependencies: deps,
                blocked_by: row.get(6)?,
                review_required: row.get(7)?,
                validation_status: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut queue = Vec::new();
    for c in iter.flatten() {
        queue.push(c);
    }

    // Also grab handoff requests
    let mut handoff_stmt = conn.prepare(
        "SELECT k.id, k.title, k.status, k.priority, k.assigned_agent_id, k.dependencies, k.blocked_by, k.review_required, k.validation_status 
         FROM handoffs h
         JOIN kanban_cards k ON h.task_id = k.id
         WHERE h.target_agent_id = ?1 AND h.status = 'pending' AND LOWER(k.status) != 'done'"
    ).map_err(|e| e.to_string())?;

    let h_iter = handoff_stmt
        .query_map([agent_id], |row| {
            let deps_str: Option<String> = row.get(5)?;
            let deps: Vec<String> = deps_str
                .map(|s| serde_json::from_str(&s).unwrap_or_default())
                .unwrap_or_default();

            Ok(KanbanCard {
                id: row.get(0)?,
                title: row.get(1)?,
                status: row.get(2)?,
                priority: row.get(3)?,
                assigned_agent_id: row.get(4)?,
                dependencies: deps,
                blocked_by: row.get(6)?,
                review_required: row.get(7)?,
                validation_status: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    for c in h_iter.flatten() {
        // Avoid duplicates
        if !queue.iter().any(|existing| existing.id == c.id) {
            queue.push(c);
        }
    }

    Ok(queue)
}

pub fn select_next_work(agent_id: &str, work_queue: &[KanbanCard]) -> Option<KanbanCard> {
    if work_queue.is_empty() {
        return None;
    }

    // 1. Continue current In Progress card if unblocked
    if let Some(card) = work_queue.iter().find(|c| {
        (c.status == "in_progress" || c.status == "In Progress") && c.blocked_by.is_none()
    }) {
        return Some(card.clone());
    }

    // 2. Handle urgent assigned unblocked P0/P1 (urgent/high) cards
    if let Some(card) = work_queue.iter().find(|c| {
        c.assigned_agent_id.as_deref() == Some(agent_id)
            && c.blocked_by.is_none()
            && (c.priority == "high" || c.priority == "urgent")
            && (c.status == "ready" || c.status == "Ready")
    }) {
        return Some(card.clone());
    }

    // 3. Handle handoff requests (where agent isn't assigned yet, but pulled in via handoff)
    // In our query, handoffs that aren't already In Progress or assigned to agent
    if let Some(card) = work_queue
        .iter()
        .find(|c| c.assigned_agent_id.as_deref() != Some(agent_id) && c.blocked_by.is_none())
    {
        return Some(card.clone());
    }

    // 4. Handle review requests (cards in Review where validation is passed but review is needed)
    if let Some(card) = work_queue.iter().find(|c| {
        (c.status == "in_review" || c.status == "Review" || c.status == "In Review")
            && c.blocked_by.is_none()
    }) {
        return Some(card.clone());
    }

    // 5. Pull next assigned Ready card
    if let Some(card) = work_queue.iter().find(|c| {
        c.assigned_agent_id.as_deref() == Some(agent_id)
            && (c.status == "ready" || c.status == "Ready")
            && c.blocked_by.is_none()
    }) {
        return Some(card.clone());
    }

    None
}
