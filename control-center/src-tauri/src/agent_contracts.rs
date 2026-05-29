use serde::{Deserialize, Serialize};
use rusqlite::{Connection, Result, OptionalExtension};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentContract {
    pub contract_id: String,
    pub role: String,
    pub responsibilities: Vec<String>,
    pub allowed_actions: Vec<String>,
    pub forbidden_actions: Vec<String>,
    pub required_context_before_work: Vec<String>,
    pub required_outputs: Vec<String>,
    pub validation_rules: Vec<String>,
    pub evidence_rules: Vec<String>,
    pub handoff_rules: Vec<String>,
    pub escalation_rules: Vec<String>,
    pub done_definition: Vec<String>,
}

pub fn load_contract(agent_id: &str, role: &str, conn: &Connection) -> Result<AgentContract, String> {
    let row: Option<(
        String, String, String, String, String, String, String, String
    )> = conn.query_row(
        "SELECT responsibilities, allowed_actions, required_context_before_work, required_outputs, validation_rules, handoff_rules, escalation_rules, done_definition 
         FROM mission_agent_contracts WHERE agent_id = ?1",
        [agent_id],
        |row| {
            Ok((
                row.get::<_, Option<String>>(0)?.unwrap_or_else(|| "[]".into()),
                row.get::<_, Option<String>>(1)?.unwrap_or_else(|| "[]".into()),
                row.get::<_, Option<String>>(2)?.unwrap_or_else(|| "[]".into()),
                row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "[]".into()),
                row.get::<_, Option<String>>(4)?.unwrap_or_else(|| "[]".into()),
                row.get::<_, Option<String>>(5)?.unwrap_or_else(|| "[]".into()),
                row.get::<_, Option<String>>(6)?.unwrap_or_else(|| "[]".into()),
                row.get::<_, Option<String>>(7)?.unwrap_or_else(|| "[]".into()),
            ))
        },
    ).optional().map_err(|e| e.to_string())?;

    if let Some((res, allow, req_ctx, req_out, val, hand, esc, done)) = row {
        Ok(AgentContract {
            contract_id: format!("contract_{}", agent_id),
            role: role.to_string(),
            responsibilities: serde_json::from_str(&res).unwrap_or_default(),
            allowed_actions: serde_json::from_str(&allow).unwrap_or_default(),
            forbidden_actions: vec![
                "do not work on unassigned cards".into(),
                "do not overwrite unrelated files".into(),
                "do not mark Done without evidence".into(),
                "do not skip validation if validation exists".into()
            ],
            required_context_before_work: serde_json::from_str(&req_ctx).unwrap_or_default(),
            required_outputs: serde_json::from_str(&req_out).unwrap_or_default(),
            validation_rules: serde_json::from_str(&val).unwrap_or_default(),
            evidence_rules: vec!["Must attach validation log or file path".into()],
            handoff_rules: serde_json::from_str(&hand).unwrap_or_default(),
            escalation_rules: serde_json::from_str(&esc).unwrap_or_default(),
            done_definition: serde_json::from_str(&done).unwrap_or_default(),
        })
    } else {
        // Fallback Default Contract
        Ok(AgentContract {
            contract_id: format!("default_contract_{}", role),
            role: role.to_string(),
            responsibilities: vec![format!("Execute assigned tasks for role: {}", role)],
            allowed_actions: vec!["view_file".into(), "write_file".into(), "execute_command".into()],
            forbidden_actions: vec![
                "do not work on unassigned cards".into(),
                "do not overwrite unrelated files".into(),
                "do not mark Done without evidence".into(),
                "do not skip validation if validation exists".into(),
                "do not pretend success from build alone when runtime validation is required".into()
            ],
            required_context_before_work: vec!["Card description".into(), "Acceptance criteria".into()],
            required_outputs: vec!["Modified files".into(), "Test logs".into()],
            validation_rules: vec!["Must pass all acceptance criteria".into()],
            evidence_rules: vec!["Must link modified files and command outputs".into()],
            handoff_rules: vec!["Must provide summary, files, and reason for handoff".into()],
            escalation_rules: vec!["Escalate to user if blocked for more than 2 turns".into()],
            done_definition: vec![
                "acceptance criteria satisfied".into(),
                "files attached".into(),
                "validation run".into(),
                "errors recorded".into(),
                "Work Receipt generated".into()
            ],
        })
    }
}
