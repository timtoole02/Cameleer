use crate::storage::DbState;
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Agent {
    pub id: String,
    pub name: String,
    pub role: String,
    pub persona: String,
    pub model_provider: String,
    pub model_name: String,
    pub temperature: f64,
    pub max_tokens: i32,
    pub can_spawn_subtasks: bool,
    pub can_talk_globally: bool,
    pub is_continuous: bool,
    pub status: String,
    pub last_heartbeat: Option<String>,
    pub primary_skills: Option<String>,
    pub allowed_tools: Option<String>,
    pub reasoning_level: Option<String>,
    pub workspace_access: Option<String>,
    pub file_access_scope: Option<String>,
    pub command_permissions: Option<String>,
    pub kanban_permissions: Option<String>,
    pub review_requirements: Option<bool>,
    pub safety_profile: Option<String>,
    pub escalation_rules: Option<String>,
    pub parent_agent_id: Option<String>,
}

#[tauri::command]
pub fn get_agents(state: State<'_, DbState>) -> Result<Vec<Agent>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, role, persona, model_provider, model_name, temperature, max_tokens, 
                    can_spawn_subtasks, can_talk_globally, is_continuous, status, last_heartbeat,
                    primary_skills, allowed_tools, reasoning_level, workspace_access, file_access_scope,
                    command_permissions, kanban_permissions, review_requirements, safety_profile, escalation_rules,
                    parent_agent_id
             FROM agents",
        )
        .map_err(|e| e.to_string())?;

    let agent_iter = stmt
        .query_map([], |row| {
            Ok(Agent {
                id: row.get(0)?,
                name: row.get(1)?,
                role: row.get(2)?,
                persona: row.get(3)?,
                model_provider: row.get(4)?,
                model_name: row.get(5)?,
                temperature: row.get(6)?,
                max_tokens: row.get(7)?,
                can_spawn_subtasks: row.get::<_, i32>(8)? != 0,
                can_talk_globally: row.get::<_, i32>(9)? != 0,
                is_continuous: row.get::<_, i32>(10)? != 0,
                status: row.get(11)?,
                last_heartbeat: row.get(12)?,
                primary_skills: row.get(13)?,
                allowed_tools: row.get(14)?,
                reasoning_level: row.get(15)?,
                workspace_access: row.get(16)?,
                file_access_scope: row.get(17)?,
                command_permissions: row.get(18)?,
                kanban_permissions: row.get(19)?,
                review_requirements: Some(row.get::<_, i32>(20)? != 0),
                safety_profile: row.get(21)?,
                escalation_rules: row.get(22)?,
                parent_agent_id: row.get(23)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut agents = Vec::new();
    for agent in agent_iter {
        agents.push(agent.map_err(|e| e.to_string())?);
    }
    Ok(agents)
}

#[tauri::command]
pub fn create_agent(state: State<'_, DbState>, agent: Agent) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO agents (id, name, role, persona, model_provider, model_name, temperature, max_tokens, 
                             can_spawn_subtasks, can_talk_globally, is_continuous, status,
                             primary_skills, allowed_tools, reasoning_level, workspace_access, file_access_scope,
                             command_permissions, kanban_permissions, review_requirements, safety_profile, escalation_rules, parent_agent_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23)",
        params![
            agent.id,
            agent.name,
            agent.role,
            agent.persona,
            agent.model_provider,
            agent.model_name,
            agent.temperature,
            agent.max_tokens,
            if agent.can_spawn_subtasks { 1 } else { 0 },
            if agent.can_talk_globally { 1 } else { 0 },
            if agent.is_continuous { 1 } else { 0 },
            agent.status,
            agent.primary_skills,
            agent.allowed_tools,
            agent.reasoning_level,
            agent.workspace_access,
            agent.file_access_scope,
            agent.command_permissions,
            agent.kanban_permissions,
            if agent.review_requirements.unwrap_or(false) { 1 } else { 0 },
            agent.safety_profile,
            agent.escalation_rules,
            agent.parent_agent_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn update_agent(state: State<'_, DbState>, agent: Agent) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE agents 
         SET name = ?2, role = ?3, persona = ?4, model_provider = ?5, model_name = ?6, 
             temperature = ?7, max_tokens = ?8, can_spawn_subtasks = ?9, can_talk_globally = ?10, 
             is_continuous = ?11, status = ?12, last_heartbeat = ?13,
             primary_skills = ?14, allowed_tools = ?15, reasoning_level = ?16, workspace_access = ?17,
             file_access_scope = ?18, command_permissions = ?19, kanban_permissions = ?20,
             review_requirements = ?21, safety_profile = ?22, escalation_rules = ?23, parent_agent_id = ?24
         WHERE id = ?1",
         params![
            agent.id,
            agent.name,
            agent.role,
            agent.persona,
            agent.model_provider,
            agent.model_name,
            agent.temperature,
            agent.max_tokens,
            if agent.can_spawn_subtasks { 1 } else { 0 },
            if agent.can_talk_globally { 1 } else { 0 },
            if agent.is_continuous { 1 } else { 0 },
            agent.status,
            agent.last_heartbeat,
            agent.primary_skills,
            agent.allowed_tools,
            agent.reasoning_level,
            agent.workspace_access,
            agent.file_access_scope,
            agent.command_permissions,
            agent.kanban_permissions,
            if agent.review_requirements.unwrap_or(false) { 1 } else { 0 },
            agent.safety_profile,
            agent.escalation_rules,
            agent.parent_agent_id,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_agent(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM agents WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}
