use rusqlite::{Connection, Result};
use std::collections::HashSet;

pub fn detect_circular_dependencies(conn: &Connection, card_id: &str) -> Result<bool, String> {
    let mut visited = HashSet::new();
    let mut current_id = card_id.to_string();

    // Traverse blocked_by chain
    loop {
        visited.insert(current_id.clone());

        let blocked_by: Option<String> = conn.query_row(
            "SELECT blocked_by FROM kanban_cards WHERE id = ?1",
            [&current_id],
            |row| row.get(0),
        ).unwrap_or(None);

        if let Some(blocker) = blocked_by {
            if visited.contains(&blocker) {
                // Circular dependency detected
                return Ok(true);
            }
            current_id = blocker;
        } else {
            break;
        }
    }

    Ok(false)
}

pub fn detect_file_collisions(conn: &Connection, file_path: &str) -> Result<Vec<String>, String> {
    // Check if multiple active tasks are working on the same file
    let mut conflicting_agents = Vec::new();

    let mut stmt = conn.prepare(
        "SELECT assigned_agent_id FROM kanban_cards 
         WHERE status = 'In Progress' AND required_files LIKE ?1"
    ).map_err(|e| e.to_string())?;

    let pattern = format!("%{}%", file_path);
    let iter = stmt.query_map([pattern], |row| row.get::<_, Option<String>>(0)).unwrap();

    for agent_opt in iter {
        if let Ok(Some(agent_id)) = agent_opt {
            conflicting_agents.push(agent_id);
        }
    }

    Ok(conflicting_agents)
}
