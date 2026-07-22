use rusqlite::{Connection, Result};
use std::collections::HashSet;

#[allow(dead_code)] // unwired; reconciled in HARDPAN G5
pub fn detect_circular_dependencies(conn: &Connection, card_id: &str) -> Result<bool, String> {
    let mut visited = HashSet::new();
    let mut current_id = card_id.to_string();

    // Traverse blocked_by chain
    loop {
        visited.insert(current_id.clone());

        let blocked_by: Option<String> = conn
            .query_row(
                "SELECT blocked_by FROM kanban_cards WHERE id = ?1",
                [&current_id],
                |row| row.get(0),
            )
            .unwrap_or(None);

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

#[allow(dead_code)] // unwired; reconciled in HARDPAN G5
pub fn detect_file_collisions(conn: &Connection, file_path: &str) -> Result<Vec<String>, String> {
    // Check if multiple active tasks are working on the same file
    let mut conflicting_agents = Vec::new();

    let mut stmt = conn
        .prepare(
            "SELECT assigned_agent_id FROM kanban_cards 
          WHERE (status = 'in_progress' OR status = 'In Progress') AND required_files LIKE ?1",
        )
        .map_err(|e| e.to_string())?;

    let pattern = format!("%{}%", file_path);
    let iter = stmt
        .query_map([pattern], |row| row.get::<_, Option<String>>(0))
        .unwrap();

    for agent_opt in iter {
        if let Ok(Some(agent_id)) = agent_opt {
            conflicting_agents.push(agent_id);
        }
    }

    Ok(conflicting_agents)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE kanban_cards (
                id TEXT PRIMARY KEY,
                blocked_by TEXT,
                assigned_agent_id TEXT,
                status TEXT,
                required_files TEXT
            )",
            [],
        )
        .unwrap();
        conn
    }

    #[test]
    fn test_detect_circular_dependencies() {
        let conn = setup_test_db();

        // Setup circular chain: A -> B -> C -> A
        conn.execute(
            "INSERT INTO kanban_cards (id, blocked_by) VALUES ('A', 'B')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO kanban_cards (id, blocked_by) VALUES ('B', 'C')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO kanban_cards (id, blocked_by) VALUES ('C', 'A')",
            [],
        )
        .unwrap();

        let has_cycle = detect_circular_dependencies(&conn, "A").unwrap();
        assert!(
            has_cycle,
            "Should detect A -> B -> C -> A circular dependency"
        );
    }

    #[test]
    fn test_no_circular_dependency() {
        let conn = setup_test_db();

        // Setup linear chain: A -> B -> C
        conn.execute(
            "INSERT INTO kanban_cards (id, blocked_by) VALUES ('A', 'B')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO kanban_cards (id, blocked_by) VALUES ('B', 'C')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO kanban_cards (id, blocked_by) VALUES ('C', NULL)",
            [],
        )
        .unwrap();

        let has_cycle = detect_circular_dependencies(&conn, "A").unwrap();
        assert!(
            !has_cycle,
            "Should NOT detect circular dependency in linear chain"
        );
    }

    #[test]
    fn test_detect_file_collisions() {
        let conn = setup_test_db();

        conn.execute("INSERT INTO kanban_cards (id, assigned_agent_id, status, required_files) VALUES ('1', 'agent_x', 'in_progress', '[\"main.rs\", \"utils.rs\"]')", []).unwrap();
        conn.execute("INSERT INTO kanban_cards (id, assigned_agent_id, status, required_files) VALUES ('2', 'agent_y', 'in_progress', '[\"utils.rs\"]')", []).unwrap();
        conn.execute("INSERT INTO kanban_cards (id, assigned_agent_id, status, required_files) VALUES ('3', 'agent_z', 'ready', '[\"utils.rs\"]')", []).unwrap();

        let collisions = detect_file_collisions(&conn, "utils.rs").unwrap();

        assert_eq!(collisions.len(), 2, "Should find 2 conflicting agents");
        assert!(collisions.contains(&"agent_x".to_string()));
        assert!(collisions.contains(&"agent_y".to_string()));
        assert!(
            !collisions.contains(&"agent_z".to_string()),
            "agent_z is not 'in_progress'"
        );
    }
}
