use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use crate::storage::DbState;
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
}

#[tauri::command]
pub fn get_agents(state: State<'_, DbState>) -> Result<Vec<Agent>, String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, name, role, persona, model_provider, model_name, temperature, max_tokens, 
                    can_spawn_subtasks, can_talk_globally, is_continuous, status, last_heartbeat 
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
                             can_spawn_subtasks, can_talk_globally, is_continuous, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
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
             is_continuous = ?11, status = ?12, last_heartbeat = ?13 
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
