use rusqlite::{params, Connection, Result, OptionalExtension};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub required_state: String, // "Done", "Review", "In Progress", "Failed"
}

pub fn validate_task_completion(
    conn: &Connection, 
    agent_id: &str, 
    card_id: &str, 
    evidence: &Option<String>
) -> Result<ValidationResult, String> {

    let mut errors = Vec::new();

    // 1. Fetch the card details
    let card_query = conn.query_row(
        "SELECT status, assigned_agent_id, acceptance_criteria, review_required, validation_status 
         FROM kanban_cards WHERE id = ?1",
        [card_id],
        |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, i32>(3)?,
                row.get::<_, String>(4)?,
            ))
        },
    ).optional().map_err(|e| e.to_string())?;

    if card_query.is_none() {
        return Ok(ValidationResult {
            is_valid: false,
            errors: vec![format!("Card {} not found", card_id)],
            required_state: "Failed".to_string(),
        });
    }

    let (status, assignee, criteria, review_required, val_status) = card_query.unwrap();

    // 2. Check assignment
    if assignee.as_deref() != Some(agent_id) {
        // Technically could be a handoff but usually you must claim it first
        errors.push("Agent is not assigned to this card".to_string());
    }

    // 3. Evidence requirement
    if let Some(ac) = &criteria {
        if ac.len() > 5 && (evidence.is_none() || evidence.as_deref().unwrap().is_empty()) {
            errors.push("Task has acceptance criteria, but no evidence was provided".to_string());
        }
    } else if evidence.is_none() || evidence.as_deref().unwrap().is_empty() {
        // Generally require some evidence
        errors.push("No evidence provided for completion".to_string());
    }

    // 4. Contract requirement
    let done_req: Option<String> = conn.query_row(
        "SELECT done_definition FROM mission_agent_contracts WHERE agent_id = ?1",
        [agent_id],
        |row| row.get(0),
    ).optional().unwrap_or(None);

    let mut requires_validation = false;
    if let Some(done_str) = done_req {
        let defs: Vec<String> = serde_json::from_str(&done_str).unwrap_or_default();
        if defs.iter().any(|d| d.contains("validation") || d.contains("test")) {
            requires_validation = true;
        }
    }

    if requires_validation && val_status != "passed" {
        errors.push("Agent contract requires explicit validation pass before marking Done".to_string());
    }

    // 5. Determine next state
    if !errors.is_empty() {
        return Ok(ValidationResult {
            is_valid: false,
            errors,
            required_state: "In Progress".to_string(), // Send back to work
        });
    }

    // Passed basic checks, generate receipt
    let ev_str = evidence.as_deref().unwrap_or("No evidence provided");
    
    let _ = conn.execute(
        "INSERT INTO mission_work_receipts (card_id, agent_id, summary, validation_status, evidence_links) 
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(card_id) DO UPDATE SET 
            summary = ?3, validation_status = ?4, evidence_links = ?5, completed_at = CURRENT_TIMESTAMP",
        params![card_id, agent_id, format!("Completed task {}", card_id), "passed", ev_str],
    );

    let next_state = if review_required == 1 {
        "Review".to_string()
    } else {
        "Done".to_string()
    };

    Ok(ValidationResult {
        is_valid: true,
        errors: Vec::new(),
        required_state: next_state,
    })
}
