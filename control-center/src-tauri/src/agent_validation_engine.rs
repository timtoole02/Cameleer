use rusqlite::{params, Connection, OptionalExtension, Result};
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
    evidence: &Option<String>,
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

    let (_status, assignee, criteria, review_required, val_status) = card_query.unwrap();

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
    let done_req: Option<String> = conn
        .query_row(
            "SELECT done_definition FROM mission_agent_contracts WHERE agent_id = ?1",
            [agent_id],
            |row| row.get(0),
        )
        .optional()
        .unwrap_or(None);

    let mut requires_validation = false;
    if let Some(done_str) = done_req {
        let defs: Vec<String> = serde_json::from_str(&done_str).unwrap_or_default();
        if defs
            .iter()
            .any(|d| d.contains("validation") || d.contains("test"))
        {
            requires_validation = true;
        }
    }

    if requires_validation && val_status != "passed" {
        errors.push(
            "Agent contract requires explicit validation pass before marking Done".to_string(),
        );
    }

    // 5. Determine next state and track failures
    if !errors.is_empty() {
        let fail_key = format!("validation_fails:{}", card_id);
        let current_fails: i32 = conn
            .query_row(
                "SELECT value FROM shared_state WHERE key = ?1",
                [&fail_key],
                |row| row.get::<_, String>(0),
            )
            .unwrap_or_else(|_| "0".to_string())
            .parse()
            .unwrap_or(0);

        let new_fails = current_fails + 1;
        let _ = conn.execute(
            "INSERT OR REPLACE INTO shared_state (key, value) VALUES (?1, ?2)",
            params![fail_key, new_fails.to_string()],
        );

        let required_state = if new_fails >= 3 {
            errors
                .push("Maximum validation failures (3) exceeded. Task is now blocked.".to_string());
            "blocked".to_string()
        } else {
            "in_progress".to_string()
        };

        return Ok(ValidationResult {
            is_valid: false,
            errors,
            required_state, // Send back to work or Block
        });
    }

    // Passed basic checks, generate receipt and clear failure count
    let _ = conn.execute(
        "DELETE FROM shared_state WHERE key = ?1",
        [format!("validation_fails:{}", card_id)],
    );
    let ev_str = evidence.as_deref().unwrap_or("No evidence provided");

    // Create work receipt
    let _ = conn.execute(
        "INSERT INTO mission_work_receipts (card_id, agent_id, summary, validation_status, evidence_links) 
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(card_id) DO UPDATE SET 
            summary = ?3, validation_status = ?4, evidence_links = ?5, completed_at = CURRENT_TIMESTAMP",
        params![card_id, agent_id, format!("Completed task {}", card_id), "passed", ev_str],
    );

    // The receipt is 1:1 with the card: `mission_work_receipts` has `card_id` as
    // its PRIMARY KEY and no `id` column. So the card's work_receipt_id IS the
    // card_id. (Previously this ran `SELECT id FROM mission_work_receipts`, which
    // errored on the non-existent column and was swallowed by `.unwrap_or(None)`,
    // leaving work_receipt_id perpetually NULL — the card never linked to its
    // receipt. Fixed as part of HARDPAN G3.)
    let receipt_id = card_id;

    let next_state = if review_required == 1 {
        "in_review".to_string()
    } else {
        "done".to_string()
    };

    // Propagate evidence and the receipt link directly to the Kanban Card so the UI can display it
    let _ = conn.execute(
        "UPDATE kanban_cards SET
            validation_status = 'passed',
            completion_evidence = ?1,
            work_receipt_id = ?2,
            status = ?3,
            completed_at = CURRENT_TIMESTAMP
         WHERE id = ?4",
        params![ev_str, receipt_id, next_state, card_id],
    );

    Ok(ValidationResult {
        is_valid: true,
        errors: Vec::new(),
        required_state: next_state,
    })
}

#[cfg(test)]
mod tests {
    //! Adversarial tests for the task-completion validator. These pin the gates
    //! (missing card, wrong assignee, missing evidence, contract-required
    //! validation), the 3-strike escalation to `blocked`, and the success side
    //! effects (work receipt, card state, counter cleanup) against REAL behavior,
    //! so a regression that weakens any gate fails loudly.
    use super::*;
    use rusqlite::Connection;

    fn setup() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        crate::storage::init_db(&conn).unwrap();
        // These tests exercise the validation decision logic, not referential
        // integrity, so relax FK enforcement to seed standalone rows.
        conn.execute_batch("PRAGMA foreign_keys = OFF;").unwrap();
        conn
    }

    fn seed_agent(conn: &Connection, id: &str) {
        conn.execute(
            "INSERT INTO agents (id, name, role, persona, model_provider, model_name)
             VALUES (?1, 'Agent', 'dev', 'persona', 'camelid', 'model')",
            [id],
        )
        .unwrap();
    }

    #[allow(clippy::too_many_arguments)]
    fn seed_card(
        conn: &Connection,
        id: &str,
        assignee: Option<&str>,
        criteria: Option<&str>,
        review_required: i32,
        validation_status: &str,
    ) {
        conn.execute(
            "INSERT INTO kanban_cards
                (id, title, status, assigned_agent_id, acceptance_criteria, review_required, validation_status)
             VALUES (?1, 'Card', 'in_progress', ?2, ?3, ?4, ?5)",
            params![id, assignee, criteria, review_required, validation_status],
        )
        .unwrap();
    }

    fn seed_contract(conn: &Connection, agent_id: &str, done_definition_json: &str) {
        conn.execute(
            "INSERT INTO mission_agent_contracts (agent_id, role, done_definition)
             VALUES (?1, 'dev', ?2)",
            params![agent_id, done_definition_json],
        )
        .unwrap();
    }

    fn fail_counter(conn: &Connection, card_id: &str) -> Option<String> {
        conn.query_row(
            "SELECT value FROM shared_state WHERE key = ?1",
            [format!("validation_fails:{}", card_id)],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .unwrap()
    }

    // --- Gate: card must exist ---

    #[test]
    fn missing_card_fails_with_failed_state() {
        let conn = setup();
        let res =
            validate_task_completion(&conn, "agent-1", "nope", &Some("evidence".into())).unwrap();
        assert!(!res.is_valid);
        assert_eq!(res.required_state, "Failed");
        assert!(res.errors.iter().any(|e| e.contains("not found")));
    }

    // --- Gate: assignee must match ---

    #[test]
    fn assignee_mismatch_is_invalid() {
        let conn = setup();
        seed_agent(&conn, "agent-1");
        // Card is assigned to someone else; provide evidence and no criteria so the
        // assignee mismatch is the isolated failure.
        seed_card(&conn, "card-1", Some("other-agent"), None, 0, "pending");
        let res =
            validate_task_completion(&conn, "agent-1", "card-1", &Some("did work".into())).unwrap();
        assert!(!res.is_valid);
        assert!(res.errors.iter().any(|e| e.contains("not assigned")));
    }

    // --- Gate: evidence required ---

    #[test]
    fn acceptance_criteria_without_evidence_is_invalid() {
        let conn = setup();
        seed_agent(&conn, "agent-1");
        // Criteria longer than 5 chars + no evidence -> evidence-required error.
        seed_card(
            &conn,
            "card-1",
            Some("agent-1"),
            Some("Must implement the feature end to end"),
            0,
            "pending",
        );
        let res = validate_task_completion(&conn, "agent-1", "card-1", &None).unwrap();
        assert!(!res.is_valid);
        assert!(res
            .errors
            .iter()
            .any(|e| e.contains("acceptance criteria") && e.contains("evidence")));
    }

    #[test]
    fn empty_evidence_string_counts_as_missing() {
        let conn = setup();
        seed_agent(&conn, "agent-1");
        seed_card(&conn, "card-1", Some("agent-1"), None, 0, "pending");
        // An empty string is treated the same as None.
        let res =
            validate_task_completion(&conn, "agent-1", "card-1", &Some(String::new())).unwrap();
        assert!(!res.is_valid);
        assert!(res.errors.iter().any(|e| e.contains("No evidence")));
    }

    // --- Gate: contract done_definition requiring validation ---

    #[test]
    fn contract_requiring_validation_blocks_unvalidated_completion() {
        let conn = setup();
        seed_agent(&conn, "agent-1");
        // done_definition mentions "validation"/"test" -> requires val_status == "passed".
        seed_contract(&conn, "agent-1", r#"["run the validation test suite"]"#);
        // val_status is "pending" (not "passed"), evidence present, assignee matches.
        seed_card(&conn, "card-1", Some("agent-1"), None, 0, "pending");
        let res =
            validate_task_completion(&conn, "agent-1", "card-1", &Some("ran it".into())).unwrap();
        assert!(!res.is_valid);
        assert!(res
            .errors
            .iter()
            .any(|e| e.contains("requires explicit validation pass")));
    }

    // --- 3-strike escalation ---

    #[test]
    fn three_consecutive_failures_escalate_to_blocked() {
        let conn = setup();
        seed_agent(&conn, "agent-1");
        // Card with no criteria and no evidence -> deterministic single "No evidence"
        // failure on every call (assignee matches so it is the only error).
        seed_card(&conn, "card-1", Some("agent-1"), None, 0, "pending");

        let r1 = validate_task_completion(&conn, "agent-1", "card-1", &None).unwrap();
        assert!(!r1.is_valid);
        assert_eq!(r1.required_state, "in_progress");
        assert_eq!(fail_counter(&conn, "card-1").as_deref(), Some("1"));

        let r2 = validate_task_completion(&conn, "agent-1", "card-1", &None).unwrap();
        assert_eq!(r2.required_state, "in_progress");
        assert_eq!(fail_counter(&conn, "card-1").as_deref(), Some("2"));

        let r3 = validate_task_completion(&conn, "agent-1", "card-1", &None).unwrap();
        assert!(!r3.is_valid);
        assert_eq!(r3.required_state, "blocked");
        assert_eq!(fail_counter(&conn, "card-1").as_deref(), Some("3"));
        assert!(r3
            .errors
            .iter()
            .any(|e| e.contains("Maximum validation failures (3) exceeded")));
    }

    // --- Success path (review_required = 0 -> done) ---

    #[test]
    fn valid_completion_writes_receipt_marks_done_and_clears_counter() {
        let conn = setup();
        seed_agent(&conn, "agent-1");
        seed_card(&conn, "card-1", Some("agent-1"), None, 0, "pending");
        // Pre-seed a prior failure counter; a valid completion must delete it.
        conn.execute(
            "INSERT INTO shared_state (key, value) VALUES ('validation_fails:card-1', '2')",
            [],
        )
        .unwrap();

        let res =
            validate_task_completion(&conn, "agent-1", "card-1", &Some("evidence".into())).unwrap();
        assert!(res.is_valid);
        assert!(res.errors.is_empty());
        assert_eq!(res.required_state, "done");

        // Work receipt row exists with validation_status 'passed'.
        let receipt_status: String = conn
            .query_row(
                "SELECT validation_status FROM mission_work_receipts WHERE card_id = 'card-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(receipt_status, "passed");

        // Card advanced to 'done' with validation_status 'passed' and evidence stored.
        let (status, val_status, evidence, work_receipt_id): (
            String,
            String,
            Option<String>,
            Option<String>,
        ) = conn
            .query_row(
                "SELECT status, validation_status, completion_evidence, work_receipt_id
                 FROM kanban_cards WHERE id = 'card-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(status, "done");
        assert_eq!(val_status, "passed");
        assert_eq!(evidence.as_deref(), Some("evidence"));

        // The card must link to its receipt. mission_work_receipts is 1:1 with the
        // card (PK = card_id, no `id` column), so work_receipt_id == card_id.
        // (This previously stayed NULL due to a `SELECT id` on a non-existent
        // column — fixed in HARDPAN G3; this test guards the regression.)
        assert_eq!(
            work_receipt_id.as_deref(),
            Some("card-1"),
            "the card should link to its work receipt via work_receipt_id == card_id"
        );
        // And that link resolves to a real receipt row.
        let receipt_exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM mission_work_receipts WHERE card_id = ?1)",
                [work_receipt_id.as_deref().unwrap()],
                |row| row.get(0),
            )
            .unwrap();
        assert!(
            receipt_exists,
            "work_receipt_id must resolve to a receipt row"
        );

        // Failure counter was cleared.
        assert!(fail_counter(&conn, "card-1").is_none());
    }

    // --- Success path (review_required = 1 -> in_review) ---

    #[test]
    fn valid_completion_with_review_required_routes_to_in_review() {
        let conn = setup();
        seed_agent(&conn, "agent-1");
        seed_card(&conn, "card-1", Some("agent-1"), None, 1, "pending");

        let res =
            validate_task_completion(&conn, "agent-1", "card-1", &Some("evidence".into())).unwrap();
        assert!(res.is_valid);
        assert_eq!(res.required_state, "in_review");

        let status: String = conn
            .query_row(
                "SELECT status FROM kanban_cards WHERE id = 'card-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "in_review");
    }
}
