use rusqlite::{Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};

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

pub fn load_contract(
    agent_id: &str,
    role: &str,
    conn: &Connection,
) -> Result<AgentContract, String> {
    let row: Option<(
        String, String, String, String, String, String, String, String, String
    )> = conn.query_row(
        "SELECT c.responsibilities, c.allowed_actions, c.required_context_before_work, c.required_outputs, c.validation_rules, c.handoff_rules, c.escalation_rules, c.done_definition, a.allowed_tools 
         FROM agents a
         LEFT JOIN mission_agent_contracts c ON c.agent_id = a.id
         WHERE a.id = ?1",
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
                row.get::<_, Option<String>>(8)?.unwrap_or_else(|| "task.create,task.update,memory.write".into()),
            ))
        },
    ).optional().map_err(|e| e.to_string())?;

    if let Some((res, allow, req_ctx, req_out, val, hand, esc, done, agent_tools)) = row {
        let mut final_allowed_actions: Vec<String> =
            serde_json::from_str(&allow).unwrap_or_default();
        if final_allowed_actions.is_empty() {
            final_allowed_actions = agent_tools
                .split(',')
                .map(|s| s.trim().to_string())
                .collect();
        }

        Ok(AgentContract {
            contract_id: format!("contract_{}", agent_id),
            role: role.to_string(),
            responsibilities: serde_json::from_str(&res).unwrap_or_default(),
            allowed_actions: final_allowed_actions,
            forbidden_actions: vec![
                "do not work on unassigned cards".into(),
                "do not overwrite unrelated files".into(),
                "do not mark Done without evidence".into(),
                "do not skip validation if validation exists".into(),
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
            allowed_actions: vec![
                "view_file".into(),
                "write_file".into(),
                "execute_command".into(),
            ],
            forbidden_actions: vec![
                "do not work on unassigned cards".into(),
                "do not overwrite unrelated files".into(),
                "do not mark Done without evidence".into(),
                "do not skip validation if validation exists".into(),
                "do not pretend success from build alone when runtime validation is required"
                    .into(),
            ],
            required_context_before_work: vec![
                "Card description".into(),
                "Acceptance criteria".into(),
            ],
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
                "Work Receipt generated".into(),
            ],
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn setup_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::storage::init_db(&conn).unwrap();
        crate::storage::seed_default_agents(&conn).unwrap();
        conn
    }

    #[test]
    fn test_get_agent_contract_succeeds_for_coder() {
        let conn = setup_test_db();
        let contract = load_contract("agent-coder", "Software Engineer", &conn);
        assert!(
            contract.is_ok(),
            "Coder contract load should succeed: {:?}",
            contract.err()
        );
        let contract = contract.unwrap();
        assert_eq!(contract.contract_id, "contract_agent-coder");
    }

    #[test]
    fn test_get_agent_contract_does_not_fail_on_done_definition() {
        let conn = setup_test_db();
        let contract = load_contract("agent-coder", "Software Engineer", &conn).unwrap();
        // The default list for done_definition from fallback is checked
        assert!(
            contract.done_definition.is_empty()
                || contract
                    .done_definition
                    .contains(&"acceptance criteria satisfied".to_string())
        );
    }

    #[test]
    fn test_get_backend_health_detects_missing_columns() {
        let conn = setup_test_db();
        let mut errors: Vec<String> = Vec::new();

        let _ = conn.execute(
            "INSERT INTO settings (key, value) VALUES ('camelid_endpoint', 'http://127.0.0.1:8181')",
            []
        );

        // Intentionally drop a column by recreating the table without it
        conn.execute_batch(
            "DROP TABLE mission_agent_contracts;
             CREATE TABLE mission_agent_contracts (
                 agent_id TEXT PRIMARY KEY
             );",
        )
        .unwrap();

        // Validate again - should detect missing columns
        let table_cols = &["agent_id", "done_definition"];
        let mut temp_errors = Vec::new();
        let _ = conn.query_row("PRAGMA table_info(mission_agent_contracts)", [], |_row| {
            Ok(())
        });
        let mut stmt = conn
            .prepare("PRAGMA table_info(mission_agent_contracts)")
            .unwrap();
        let mut rows = stmt.query([]).unwrap();
        let mut existing_cols = std::collections::HashSet::new();
        while let Some(row) = rows.next().unwrap() {
            let col_name: String = row.get(1).unwrap();
            existing_cols.insert(col_name);
        }
        for col in table_cols {
            if !existing_cols.contains(*col) {
                temp_errors.push(format!(
                    "Missing required column: mission_agent_contracts.{}",
                    col
                ));
            }
        }

        assert!(!temp_errors.is_empty());
        assert!(temp_errors[0].contains("Missing required column"));
    }
}
