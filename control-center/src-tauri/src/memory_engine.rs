use rusqlite::{params, Connection, Result, OptionalExtension};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Memory {
    pub id: String,
    pub agent_id: Option<String>,
    pub workspace_id: Option<String>,
    pub content: String,
    pub context: Option<String>,
    pub importance: i32,
    pub created_at: String,
    pub last_accessed_at: Option<String>,
}

pub fn save_memory(
    conn: &Connection,
    agent_id: Option<String>,
    workspace_id: Option<String>,
    content: String,
    context: Option<String>,
    importance: i32,
) -> Result<String, String> {
    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO memories (id, agent_id, workspace_id, content, context, importance)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, agent_id, workspace_id, content, context, importance],
    )
    .map_err(|e| e.to_string())?;

    Ok(id)
}

pub fn search_memories(
    conn: &Connection,
    agent_id: Option<String>,
    workspace_id: Option<String>,
    query: &str,
    limit: usize,
) -> Result<Vec<Memory>, String> {
    // Simple FTS or LIKE query. For now we use basic LIKE on content and context.
    let search_pattern = format!("%{}%", query);
    
    // We update last_accessed_at when memories are retrieved
    let now_secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    
    let mut stmt = conn
        .prepare(
            "SELECT id, agent_id, workspace_id, content, context, importance, created_at, last_accessed_at 
             FROM memories 
             WHERE (content LIKE ?1 OR context LIKE ?1)
               AND (?2 IS NULL OR agent_id = ?2)
               AND (?3 IS NULL OR workspace_id = ?3)
             ORDER BY importance DESC, created_at DESC 
             LIMIT ?4",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![search_pattern, agent_id, workspace_id, limit as i32], |row| {
            Ok(Memory {
                id: row.get(0)?,
                agent_id: row.get(1)?,
                workspace_id: row.get(2)?,
                content: row.get(3)?,
                context: row.get(4)?,
                importance: row.get(5)?,
                created_at: row.get(6)?,
                last_accessed_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    let mut ids_to_update = Vec::new();
    for row in iter {
        if let Ok(mem) = row {
            ids_to_update.push(mem.id.clone());
            results.push(mem);
        }
    }

    // Update last_accessed_at for retrieved memories
    for id in ids_to_update {
        let _ = conn.execute(
            "UPDATE memories SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![id],
        );
    }

    Ok(results)
}

pub fn get_recent_memories(
    conn: &Connection,
    agent_id: Option<String>,
    workspace_id: Option<String>,
    limit: usize,
) -> Result<Vec<Memory>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, agent_id, workspace_id, content, context, importance, created_at, last_accessed_at 
             FROM memories 
             WHERE (?1 IS NULL OR agent_id = ?1)
               AND (?2 IS NULL OR workspace_id = ?2)
             ORDER BY created_at DESC 
             LIMIT ?3",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![agent_id, workspace_id, limit as i32], |row| {
            Ok(Memory {
                id: row.get(0)?,
                agent_id: row.get(1)?,
                workspace_id: row.get(2)?,
                content: row.get(3)?,
                context: row.get(4)?,
                importance: row.get(5)?,
                created_at: row.get(6)?,
                last_accessed_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for row in iter {
        if let Ok(mem) = row {
            results.push(mem);
        }
    }

    Ok(results)
}
