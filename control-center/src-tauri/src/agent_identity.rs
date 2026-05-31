use rusqlite::{Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentIdentity {
    pub agent_id: String,
    pub name: String,
    pub role: String,
    pub persona: String,
    pub description: String,
    pub workspace_id: String,
    pub project_ids: Vec<String>,
    pub team_ids: Vec<String>,
    pub default_model_id: String,
    pub reasoning_level: String,
    pub allowed_tools: Vec<String>,
    pub permissions: Vec<String>,
    pub safety_profile: String,
    pub active_status: String,
}

pub fn load_identity(agent_id: &str, conn: &Connection) -> Result<AgentIdentity, String> {
    // 1. Load core agent profile
    let (name, role, persona, provider, model_name, reasoning, tools_str, perms_str, safety, status) = conn.query_row(
        "SELECT name, role, persona, model_provider, model_name, reasoning_level, allowed_tools, command_permissions, safety_profile, status 
         FROM agents WHERE id = ?1",
        [agent_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5).unwrap_or_else(|_| "standard".into()),
                row.get::<_, Option<String>>(6)?.unwrap_or_else(|| "[]".into()),
                row.get::<_, Option<String>>(7)?.unwrap_or_else(|| "[]".into()),
                row.get::<_, String>(8).unwrap_or_else(|_| "moderate".into()),
                row.get::<_, String>(9).unwrap_or_else(|_| "idle".into()),
            ))
        },
    ).map_err(|e| format!("Agent not found: {}", e))?;

    // 2. Load scoped memberships
    let mut stmt = conn.prepare("SELECT workspace_id, project_id, team_id FROM agent_project_memberships WHERE agent_id = ?1").map_err(|e| e.to_string())?;
    let iter = stmt
        .query_map([agent_id], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut workspace_id = "default".to_string();
    let mut project_ids = Vec::new();
    let mut team_ids = Vec::new();

    for item in iter {
        if let Ok((ws, p_opt, t_opt)) = item {
            workspace_id = ws;
            if let Some(p) = p_opt {
                if !project_ids.contains(&p) {
                    project_ids.push(p);
                }
            }
            if let Some(t) = t_opt {
                if !team_ids.contains(&t) {
                    team_ids.push(t);
                }
            }
        }
    }

    let allowed_tools: Vec<String> = serde_json::from_str(&tools_str).unwrap_or_default();
    let permissions: Vec<String> = serde_json::from_str(&perms_str).unwrap_or_default();

    Ok(AgentIdentity {
        agent_id: agent_id.to_string(),
        name,
        role,
        persona: persona.clone(),
        description: persona,
        workspace_id,
        project_ids,
        team_ids,
        default_model_id: format!("{}/{}", provider, model_name),
        reasoning_level: reasoning,
        allowed_tools,
        permissions,
        safety_profile: safety,
        active_status: status,
    })
}
