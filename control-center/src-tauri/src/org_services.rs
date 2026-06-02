use crate::event_bus::{emit_event, AppEvent};
use crate::storage::DbState;
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: String,
    pub workspace_id: String,
    pub name: String,
    pub description: Option<String>,
    pub status: String,
    pub priority: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Team {
    pub id: String,
    pub workspace_id: String,
    pub project_id: Option<String>,
    pub parent_team_id: Option<String>,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentOrgNode {
    pub id: String,
    pub workspace_id: String,
    pub project_id: Option<String>,
    pub parent_node_id: Option<String>,
    pub node_type: String,
    pub display_name: String,
    pub agent_id: Option<String>,
    pub team_id: Option<String>,
    pub sort_order: i32,
    pub collapsed: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrgNodeMetrics {
    pub active_work: i32,
    pub blocked_cards: i32,
    pub active_agents: i32,
}

#[tauri::command]
pub fn get_org_node_metrics(
    node_type: String,
    target_id: Option<String>,
    state: State<DbState>,
) -> Result<OrgNodeMetrics, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    let mut active_work = 0;
    let mut blocked_cards = 0;
    let mut active_agents = 0;

    if node_type == "workspace" {
        active_work = conn.query_row("SELECT count(*) FROM kanban_cards WHERE status IN ('Ready', 'In Progress', 'In Review', 'ready', 'in_progress', 'in_review')", [], |r| r.get(0)).unwrap_or(0);
        blocked_cards = conn
            .query_row(
                "SELECT count(*) FROM kanban_cards WHERE status IN ('Blocked', 'blocked')",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
        active_agents = conn
            .query_row(
                "SELECT count(*) FROM agents WHERE status != 'offline'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(0);
    } else if node_type == "project" {
        if let Some(id) = &target_id {
            active_work = conn.query_row("SELECT count(*) FROM kanban_cards WHERE project_id = ?1 AND status IN ('Ready', 'In Progress', 'In Review', 'ready', 'in_progress', 'in_review')", [id], |r| r.get(0)).unwrap_or(0);
            blocked_cards = conn.query_row("SELECT count(*) FROM kanban_cards WHERE project_id = ?1 AND status IN ('Blocked', 'blocked')", [id], |r| r.get(0)).unwrap_or(0);
            active_agents = conn.query_row("SELECT count(DISTINCT agent_id) FROM agent_project_memberships WHERE project_id = ?1", [id], |r| r.get(0)).unwrap_or(0);
        }
    } else if node_type == "team" {
        if let Some(id) = &target_id {
            active_work = conn.query_row("SELECT count(*) FROM kanban_cards WHERE team_id = ?1 AND status IN ('Ready', 'In Progress', 'In Review', 'ready', 'in_progress', 'in_review')", [id], |r| r.get(0)).unwrap_or(0);
            blocked_cards = conn
                .query_row(
                    "SELECT count(*) FROM kanban_cards WHERE team_id = ?1 AND status IN ('Blocked', 'blocked')",
                    [id],
                    |r| r.get(0),
                )
                .unwrap_or(0);
            active_agents = conn.query_row("SELECT count(DISTINCT agent_id) FROM agent_project_memberships WHERE team_id = ?1", [id], |r| r.get(0)).unwrap_or(0);
        }
    }

    Ok(OrgNodeMetrics {
        active_work,
        blocked_cards,
        active_agents,
    })
}

#[tauri::command]
pub fn create_project(
    workspace_id: String,
    name: String,
    description: Option<String>,
    state: State<DbState>,
) -> Result<Project, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let workspace_id = resolve_workspace_id(&conn, &workspace_id);
    ensure_workspace_root(&conn, &workspace_id)?;
    let id = format!("proj_{}", Uuid::new_v4().simple());
    let node_id = format!("node_{}", Uuid::new_v4().simple());

    conn.execute(
        "INSERT INTO projects (id, workspace_id, name, description) VALUES (?1, ?2, ?3, ?4)",
        params![id, workspace_id, name, description],
    )
    .map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO agent_org_nodes (id, workspace_id, project_id, parent_node_id, node_type, display_name) 
         VALUES (?1, ?2, ?3, 'node_ws', 'project', ?4)",
        params![node_id, workspace_id, id, name],
    ).map_err(|e| e.to_string())?;

    Ok(Project {
        id,
        workspace_id,
        name,
        description,
        status: "active".into(),
        priority: "medium".into(),
    })
}

#[tauri::command]
pub fn create_team(
    workspace_id: String,
    project_id: Option<String>,
    name: String,
    description: Option<String>,
    state: State<DbState>,
) -> Result<Team, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let workspace_id = resolve_workspace_id(&conn, &workspace_id);
    ensure_workspace_root(&conn, &workspace_id)?;
    let id = format!("team_{}", Uuid::new_v4().simple());
    let node_id = format!("node_{}", Uuid::new_v4().simple());

    // Attempt to find parent node for tree insertion
    let parent_node_id: Option<String> = if let Some(ref p_id) = project_id {
        conn.query_row(
            "SELECT id FROM agent_org_nodes WHERE project_id = ?1 AND node_type = 'project'",
            params![p_id],
            |row| row.get(0),
        )
        .optional()
        .unwrap_or(None)
    } else {
        Some("node_ws".into())
    };

    conn.execute(
        "INSERT INTO teams (id, workspace_id, project_id, name, description) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![id, workspace_id, project_id, name, description],
    ).map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO agent_org_nodes (id, workspace_id, project_id, team_id, parent_node_id, node_type, display_name) 
         VALUES (?1, ?2, ?3, ?4, ?5, 'team', ?6)",
        params![node_id, workspace_id, project_id, id, parent_node_id, name],
    ).map_err(|e| e.to_string())?;

    Ok(Team {
        id,
        workspace_id,
        project_id,
        parent_team_id: None,
        name,
        description,
    })
}

/// Maps a requested workspace id to one that actually exists. The frontend
/// historically passes "default-workspace" while the seeded workspace is
/// "default"; this prevents foreign-key failures by falling back to the active
/// (or first) real workspace.
fn resolve_workspace_id(conn: &Connection, requested: &str) -> String {
    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = ?1)",
            [requested],
            |r| r.get(0),
        )
        .unwrap_or(false);
    if exists {
        return requested.to_string();
    }
    conn.query_row(
        "SELECT id FROM workspaces ORDER BY active DESC, id ASC LIMIT 1",
        [],
        |r| r.get::<_, String>(0),
    )
    .unwrap_or_else(|_| "default".to_string())
}

/// Ensures the workspace has a root org node (`node_ws`) that projects, teams,
/// and agents hang from. Idempotent.
pub(crate) fn ensure_workspace_root(conn: &Connection, workspace_id: &str) -> Result<(), String> {
    let exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM agent_org_nodes WHERE id = 'node_ws')",
            [],
            |r| r.get(0),
        )
        .unwrap_or(false);
    if !exists {
        let name: String = conn
            .query_row(
                "SELECT name FROM workspaces WHERE id = ?1",
                [workspace_id],
                |r| r.get(0),
            )
            .unwrap_or_else(|_| "Workspace".to_string());
        conn.execute(
            "INSERT INTO agent_org_nodes (id, workspace_id, node_type, display_name)
             VALUES ('node_ws', ?1, 'workspace', ?2)",
            params![workspace_id, name],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Ensures every agent is represented as a node in the org tree. New/unassigned
/// agents are attached to the workspace root. Idempotent and self-healing, so the
/// tree is never empty just because agents were created before they had nodes.
pub(crate) fn sync_agent_org_nodes(conn: &Connection, workspace_id: &str) -> Result<(), String> {
    let missing: Vec<(String, String)> = {
        let mut stmt = conn
            .prepare(
                "SELECT id, name FROM agents
                 WHERE id NOT IN (
                     SELECT agent_id FROM agent_org_nodes
                     WHERE node_type = 'agent' AND agent_id IS NOT NULL
                 )",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    for (agent_id, name) in missing {
        let node_id = format!("node_{}", Uuid::new_v4().simple());
        conn.execute(
            "INSERT INTO agent_org_nodes (id, workspace_id, parent_node_id, node_type, display_name, agent_id)
             VALUES (?1, ?2, 'node_ws', 'agent', ?3, ?4)",
            params![node_id, workspace_id, name, agent_id],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_agent_org_tree(
    workspace_id: String,
    state: State<DbState>,
) -> Result<Vec<AgentOrgNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let workspace_id = resolve_workspace_id(&conn, &workspace_id);
    // Self-heal the tree so it always reflects the current agent roster.
    ensure_workspace_root(&conn, &workspace_id)?;
    sync_agent_org_nodes(&conn, &workspace_id)?;
    let mut stmt = conn.prepare(
        "SELECT id, workspace_id, project_id, parent_node_id, node_type, display_name, agent_id, team_id, sort_order, collapsed
         FROM agent_org_nodes
         WHERE workspace_id = ?1
         ORDER BY sort_order ASC, created_at ASC"
    ).map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![workspace_id], |row| {
            Ok(AgentOrgNode {
                id: row.get(0)?,
                workspace_id: row.get(1)?,
                project_id: row.get(2)?,
                parent_node_id: row.get(3)?,
                node_type: row.get(4)?,
                display_name: row.get(5)?,
                agent_id: row.get(6)?,
                team_id: row.get(7)?,
                sort_order: row.get(8)?,
                collapsed: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut nodes = Vec::new();
    for node in iter {
        nodes.push(node.map_err(|e| e.to_string())?);
    }
    Ok(nodes)
}

#[tauri::command]
pub fn move_agent_to_team(
    app_handle: AppHandle,
    agent_id: String,
    project_id: String,
    team_id: String,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Resolve the workspace from the target team and make sure the agent has a node.
    let workspace_id: String = conn
        .query_row(
            "SELECT workspace_id FROM teams WHERE id = ?1",
            params![team_id],
            |row| row.get(0),
        )
        .optional()
        .unwrap_or(None)
        .unwrap_or_else(|| "default".to_string());
    ensure_workspace_root(&conn, &workspace_id)?;
    sync_agent_org_nodes(&conn, &workspace_id)?;

    // Find new parent node (the team's node).
    let parent_node_id: Option<String> = conn
        .query_row(
            "SELECT id FROM agent_org_nodes WHERE team_id = ?1 AND node_type = 'team'",
            params![team_id],
            |row| row.get(0),
        )
        .optional()
        .unwrap_or(None);

    let parent = parent_node_id
        .ok_or_else(|| "Target team has no org node; create the team first.".to_string())?;

    let moved = conn
        .execute(
            "UPDATE agent_org_nodes SET parent_node_id = ?1, project_id = ?2, team_id = ?3, updated_at = CURRENT_TIMESTAMP WHERE agent_id = ?4 AND node_type = 'agent'",
            params![parent, project_id, team_id, agent_id],
        )
        .map_err(|e| e.to_string())?;
    if moved == 0 {
        return Err(format!("No org node found for agent {}.", agent_id));
    }

    // Upsert the project/team membership (the row may not exist yet).
    conn.execute(
        "DELETE FROM agent_project_memberships WHERE agent_id = ?1",
        params![agent_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO agent_project_memberships (id, agent_id, workspace_id, project_id, team_id, active)
         VALUES (?1, ?2, ?3, ?4, ?5, 1)",
        params![
            format!("mem_{}", Uuid::new_v4().simple()),
            agent_id,
            workspace_id,
            project_id,
            team_id
        ],
    )
    .map_err(|e| e.to_string())?;

    emit_event(
        &app_handle,
        AppEvent {
            event_type: "agent_moved_to_team".to_string(),
            agent_id: Some(agent_id.clone()),
            task_id: None,
            payload: serde_json::json!({ "project_id": project_id, "team_id": team_id }),
        },
    );

    Ok(())
}

#[cfg(test)]
mod org_tree_tests {
    use super::{ensure_workspace_root, sync_agent_org_nodes};
    use rusqlite::Connection;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::storage::init_db(&conn).unwrap();
        crate::storage::seed_default_agents(&conn).unwrap();
        conn
    }

    fn agent_node_count(conn: &Connection) -> i64 {
        conn.query_row(
            "SELECT COUNT(*) FROM agent_org_nodes WHERE node_type = 'agent'",
            [],
            |r| r.get(0),
        )
        .unwrap()
    }

    #[test]
    fn sync_creates_one_org_node_per_agent_and_is_idempotent() {
        let conn = setup();
        let agents: i64 = conn
            .query_row("SELECT COUNT(*) FROM agents", [], |r| r.get(0))
            .unwrap();
        assert!(agents > 0, "seed should create default agents");

        ensure_workspace_root(&conn, "default").unwrap();
        sync_agent_org_nodes(&conn, "default").unwrap();

        // Root node exists and every agent now has a node.
        let root_exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM agent_org_nodes WHERE id = 'node_ws')",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert!(root_exists, "workspace root node must exist");
        assert_eq!(agent_node_count(&conn), agents, "one org node per agent");

        // Running again must not duplicate nodes.
        sync_agent_org_nodes(&conn, "default").unwrap();
        assert_eq!(agent_node_count(&conn), agents, "sync must be idempotent");
    }
}
