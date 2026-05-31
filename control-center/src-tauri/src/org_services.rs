use crate::event_bus::{emit_event, AppEvent};
use crate::storage::DbState;
use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use tauri::State;
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
        active_work = conn.query_row("SELECT count(*) FROM kanban_cards WHERE status IN ('Ready', 'In Progress', 'In Review')", [], |r| r.get(0)).unwrap_or(0);
        blocked_cards = conn
            .query_row(
                "SELECT count(*) FROM kanban_cards WHERE status = 'Blocked'",
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
            active_work = conn.query_row("SELECT count(*) FROM kanban_cards WHERE project_id = ?1 AND status IN ('Ready', 'In Progress', 'In Review')", [id], |r| r.get(0)).unwrap_or(0);
            blocked_cards = conn.query_row("SELECT count(*) FROM kanban_cards WHERE project_id = ?1 AND status = 'Blocked'", [id], |r| r.get(0)).unwrap_or(0);
            active_agents = conn.query_row("SELECT count(DISTINCT agent_id) FROM agent_project_memberships WHERE project_id = ?1", [id], |r| r.get(0)).unwrap_or(0);
        }
    } else if node_type == "team" {
        if let Some(id) = &target_id {
            active_work = conn.query_row("SELECT count(*) FROM kanban_cards WHERE team_id = ?1 AND status IN ('Ready', 'In Progress', 'In Review')", [id], |r| r.get(0)).unwrap_or(0);
            blocked_cards = conn
                .query_row(
                    "SELECT count(*) FROM kanban_cards WHERE team_id = ?1 AND status = 'Blocked'",
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

#[tauri::command]
pub fn get_agent_org_tree(
    workspace_id: String,
    state: State<DbState>,
) -> Result<Vec<AgentOrgNode>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
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
    agent_id: String,
    project_id: String,
    team_id: String,
    state: State<DbState>,
) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Find new parent node
    let parent_node_id: Option<String> = conn
        .query_row(
            "SELECT id FROM agent_org_nodes WHERE team_id = ?1 AND node_type = 'team'",
            params![team_id],
            |row| row.get(0),
        )
        .optional()
        .unwrap_or(None);

    if let Some(parent) = parent_node_id {
        conn.execute(
            "UPDATE agent_org_nodes SET parent_node_id = ?1, project_id = ?2, team_id = ?3 WHERE agent_id = ?4 AND node_type = 'agent'",
            params![parent, project_id, team_id, agent_id],
        ).map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE agent_project_memberships SET project_id = ?1, team_id = ?2 WHERE agent_id = ?3",
            params![project_id, team_id, agent_id],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}
