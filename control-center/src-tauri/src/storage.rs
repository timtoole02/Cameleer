use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::PathBuf;

pub struct DbState {
    pub conn: std::sync::Mutex<rusqlite::Connection>,
}

pub fn get_db_path() -> PathBuf {
    let mut path = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string()));
    path.push(".cameleer");

    // Create directory if not exists
    if !path.exists() {
        fs::create_dir_all(&path).expect("Failed to create ~/.cameleer directory");
    }

    path.push("cameleer_workspace.db");
    path
}

pub fn init_db(conn: &Connection) -> Result<()> {
    // Create schema_migrations table if not exists with name and applied_at
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );",
        [],
    )?;

    // Handle old schema_migrations from previous versions
    let has_name_column: bool = {
        let mut stmt = conn.prepare("PRAGMA table_info(schema_migrations)")?;
        let mut rows = stmt.query([])?;
        let mut found = false;
        while let Some(row) = rows.next()? {
            let col_name: String = row.get(1)?;
            if col_name == "name" {
                found = true;
                break;
            }
        }
        found
    };
    if !has_name_column {
        conn.execute_batch(
            "DROP TABLE schema_migrations;
             CREATE TABLE schema_migrations (
                 version INTEGER PRIMARY KEY,
                 name TEXT NOT NULL,
                 applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
             );",
        )?;
    }

    // Read currently applied migrations
    let mut stmt = conn.prepare("SELECT version FROM schema_migrations")?;
    let applied_versions: std::collections::HashSet<i64> = stmt
        .query_map([], |row| row.get(0))?
        .filter_map(Result::ok)
        .collect();

    // Embedded migrations matching physical files under migrations/
    let migrations: &[(&str, &str)] = &[
        (
            "0001_initial_schema",
            include_str!("../migrations/0001_initial_schema.sql"),
        ),
        (
            "0002_agent_contract_done_definition",
            include_str!("../migrations/0002_agent_contract_done_definition.sql"),
        ),
        (
            "0003_kanban_board_slice",
            include_str!("../migrations/0003_kanban_board_slice.sql"),
        ),
        (
            "0004_backlog_refinement_slice",
            include_str!("../migrations/0004_backlog_refinement_slice.sql"),
        ),
    ];

    for (i, (name, sql)) in migrations.iter().enumerate() {
        let version = (i + 1) as i64;
        if !applied_versions.contains(&version) {
            println!("[MIGRATION] Applying migration {}: {}", version, name);
            if version == 2 && table_has_column(conn, "mission_agent_contracts", "done_definition")?
            {
                println!(
                    "[MIGRATION] mission_agent_contracts.done_definition already exists; recording migration {}",
                    version
                );
            } else if version == 3 {
                apply_kanban_board_slice_migration(conn)?;
            } else if version == 4 {
                apply_backlog_refinement_slice_migration(conn)?;
            } else {
                conn.execute_batch(sql)?;
            }
            conn.execute(
                "INSERT INTO schema_migrations (version, name) VALUES (?1, ?2)",
                params![version, name],
            )?;
        }
    }

    Ok(())
}

fn apply_kanban_board_slice_migration(conn: &Connection) -> Result<()> {
    if !table_exists(conn, "kanban_cards")? {
        conn.execute_batch(include_str!("../migrations/0001_initial_schema.sql"))?;
    }

    add_column_if_missing(conn, "kanban_cards", "task_key", "TEXT")?;
    add_column_if_missing(conn, "kanban_cards", "instructions", "TEXT")?;
    add_column_if_missing(conn, "kanban_cards", "blocked_reason", "TEXT")?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS task_activity (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
            actor_id TEXT,
            actor_type TEXT NOT NULL DEFAULT 'system',
            event_type TEXT NOT NULL,
            summary TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS task_progress_updates (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
            run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
            agent_id TEXT REFERENCES agents(id),
            content TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'sent',
            error_message TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS task_work_receipts (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
            agent_id TEXT REFERENCES agents(id),
            summary TEXT NOT NULL,
            instructions_followed TEXT,
            acceptance_criteria_results TEXT,
            files_created TEXT,
            files_modified TEXT,
            commands_run TEXT,
            tests_run TEXT,
            validation_status TEXT NOT NULL,
            evidence_links TEXT,
            known_limitations TEXT,
            follow_up_recommendations TEXT,
            completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        UPDATE model_configs
        SET model_name = 'Llama 3.2 1B Instruct',
            endpoint_url = COALESCE(endpoint_url, 'http://127.0.0.1:8181/v1/chat/completions'),
            is_default = 1
        WHERE provider = 'camelid' AND (model_name = 'camelid-default' OR is_default = 1);

        UPDATE agents
        SET model_name = CASE
                WHEN model_provider = 'camelid' AND model_name = 'camelid-default'
                THEN 'Llama 3.2 1B Instruct'
                ELSE model_name
            END;",
    )?;

    Ok(())
}

fn apply_backlog_refinement_slice_migration(conn: &Connection) -> Result<()> {
    if !table_exists(conn, "backlog_items")? {
        conn.execute_batch(include_str!("../migrations/0001_initial_schema.sql"))?;
    }

    add_column_if_missing(conn, "backlog_items", "instructions", "TEXT")?;
    add_column_if_missing(conn, "backlog_items", "suggested_agent_role", "TEXT")?;
    add_column_if_missing(conn, "backlog_items", "converted_card_id", "TEXT")?;
    add_column_if_missing(conn, "backlog_items", "archived_at", "TEXT")?;
    add_column_if_missing(conn, "backlog_items", "rejected_reason", "TEXT")?;

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS backlog_acceptance_criteria (
            id TEXT PRIMARY KEY,
            backlog_item_id TEXT NOT NULL REFERENCES backlog_items(id) ON DELETE CASCADE,
            text TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS backlog_activity (
            id TEXT PRIMARY KEY,
            backlog_item_id TEXT NOT NULL REFERENCES backlog_items(id) ON DELETE CASCADE,
            actor_id TEXT,
            actor_type TEXT NOT NULL DEFAULT 'system',
            event_type TEXT NOT NULL,
            summary TEXT NOT NULL,
            details TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        UPDATE backlog_items
        SET status = CASE
            WHEN status = 'backlog' THEN 'captured'
            WHEN status = 'ready_for_board' THEN 'converted'
            ELSE status
        END;

        UPDATE backlog_items
        SET suggested_agent_role = proposed_agent_role
        WHERE suggested_agent_role IS NULL AND proposed_agent_role IS NOT NULL;",
    )?;

    Ok(())
}

fn add_column_if_missing(
    conn: &Connection,
    table: &str,
    column: &str,
    definition: &str,
) -> Result<()> {
    if !table_has_column(conn, table, column)? {
        conn.execute_batch(&format!(
            "ALTER TABLE {} ADD COLUMN {} {};",
            table, column, definition
        ))?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    fn migration_count(conn: &Connection) -> i64 {
        conn.query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
            row.get(0)
        })
        .unwrap()
    }

    #[test]
    fn schema_has_done_definition() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        assert!(
            table_has_column(&conn, "mission_agent_contracts", "done_definition").unwrap(),
            "base schema must include mission_agent_contracts.done_definition"
        );
    }

    #[test]
    fn migrations_apply_cleanly() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        let schema_version: i64 = conn
            .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .unwrap();
        assert_eq!(schema_version, 4);
        assert_eq!(migration_count(&conn), 4);
    }

    #[test]
    fn migrations_are_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        init_db(&conn).unwrap();

        assert_eq!(migration_count(&conn), 4);
        assert!(table_has_column(&conn, "mission_agent_contracts", "done_definition").unwrap());
    }

    #[test]
    fn legacy_v1_migration_adds_done_definition() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE schema_migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
            INSERT INTO schema_migrations (version, name) VALUES (1, '0001_initial_schema');
            CREATE TABLE mission_agent_contracts (
                agent_id TEXT PRIMARY KEY,
                role TEXT NOT NULL,
                responsibilities TEXT,
                allowed_actions TEXT,
                required_context_before_work TEXT,
                required_outputs TEXT,
                validation_rules TEXT,
                handoff_rules TEXT,
                escalation_rules TEXT
            );",
        )
        .unwrap();

        init_db(&conn).unwrap();

        assert!(
            table_has_column(&conn, "mission_agent_contracts", "done_definition").unwrap(),
            "migration 0002 must add done_definition to existing v1 databases"
        );
        assert_eq!(migration_count(&conn), 4);
    }

    #[test]
    fn kanban_schema_has_receipt_backed_work_fields() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        assert!(table_has_column(&conn, "kanban_cards", "task_key").unwrap());
        assert!(table_has_column(&conn, "kanban_cards", "instructions").unwrap());
        assert!(table_has_column(&conn, "kanban_cards", "blocked_reason").unwrap());
        conn.query_row("SELECT COUNT(*) FROM task_activity", [], |row| {
            row.get::<_, i64>(0)
        })
        .unwrap();
        conn.query_row("SELECT COUNT(*) FROM task_work_receipts", [], |row| {
            row.get::<_, i64>(0)
        })
        .unwrap();
    }

    #[test]
    fn backlog_schema_has_refinement_fields() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        assert!(table_has_column(&conn, "backlog_items", "instructions").unwrap());
        assert!(table_has_column(&conn, "backlog_items", "suggested_agent_role").unwrap());
        assert!(table_has_column(&conn, "backlog_items", "converted_card_id").unwrap());
        assert!(table_has_column(&conn, "backlog_items", "archived_at").unwrap());
        assert!(table_has_column(&conn, "backlog_items", "rejected_reason").unwrap());
        conn.query_row("SELECT COUNT(*) FROM backlog_activity", [], |row| {
            row.get::<_, i64>(0)
        })
        .unwrap();
        conn.query_row(
            "SELECT COUNT(*) FROM backlog_acceptance_criteria",
            [],
            |row| row.get::<_, i64>(0),
        )
        .unwrap();
    }

    fn setup_kanban_test_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();
        conn.execute(
            "INSERT INTO workspaces (id, name, path, active)
             VALUES ('default-workspace', 'Default Workspace', '/tmp/cameleer-test', 1)",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO agents (id, name, role, persona, model_provider, model_name)
             VALUES ('agent-backend', 'Backend Debugger', 'Senior Rust backend engineer', 'Debug backend issues clearly.', 'camelid', 'Llama 3.2 1B Instruct')",
            [],
        )
        .unwrap();
        conn
    }

    fn insert_test_task(conn: &Connection) {
        conn.execute(
            "INSERT INTO kanban_cards (
                id, task_key, workspace_id, title, description, instructions, status, priority, type,
                assigned_agent_id, acceptance_criteria, validation_status
             )
             VALUES (
                'task-1', 'CAM-1', 'default-workspace', 'Fix health badge honesty', 'Make status truthful',
                'Investigate health badge routing and add a regression.', 'backlog', 'high', 'bug',
                'agent-backend', '[\"DB status is separate\", \"Camelid status is separate\"]', 'not_started'
             )",
            [],
        )
        .unwrap();
    }

    #[test]
    fn create_task_persists() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);

        let title: String = conn
            .query_row(
                "SELECT title FROM kanban_cards WHERE id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(title, "Fix health badge honesty");
    }

    #[test]
    fn update_task_instructions_persists() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "UPDATE kanban_cards SET instructions = 'Updated instructions' WHERE id = 'task-1'",
            [],
        )
        .unwrap();

        let instructions: String = conn
            .query_row(
                "SELECT instructions FROM kanban_cards WHERE id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(instructions, "Updated instructions");
    }

    #[test]
    fn assign_task_to_agent_persists() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "UPDATE kanban_cards SET assigned_agent_id = 'agent-backend' WHERE id = 'task-1'",
            [],
        )
        .unwrap();

        let agent_id: String = conn
            .query_row(
                "SELECT assigned_agent_id FROM kanban_cards WHERE id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(agent_id, "agent-backend");
    }

    #[test]
    fn move_task_persists() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "UPDATE kanban_cards SET status = 'ready' WHERE id = 'task-1'",
            [],
        )
        .unwrap();

        let status: String = conn
            .query_row(
                "SELECT status FROM kanban_cards WHERE id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(status, "ready");
    }

    #[test]
    fn start_agent_task_creates_run() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "INSERT INTO agent_runs (id, agent_id, task_id, state, input)
             VALUES ('run-1', 'agent-backend', 'task-1', 'executing', 'Prompt')",
            [],
        )
        .unwrap();

        let state: String = conn
            .query_row(
                "SELECT state FROM agent_runs WHERE id = 'run-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(state, "executing");
    }

    #[test]
    fn cannot_start_task_without_agent() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "UPDATE kanban_cards SET assigned_agent_id = NULL WHERE id = 'task-1'",
            [],
        )
        .unwrap();

        let assigned_agent_id: Option<String> = conn
            .query_row(
                "SELECT assigned_agent_id FROM kanban_cards WHERE id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert!(assigned_agent_id.is_none());
    }

    #[test]
    fn cannot_start_task_without_instructions() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "UPDATE kanban_cards SET instructions = '' WHERE id = 'task-1'",
            [],
        )
        .unwrap();

        let instructions: String = conn
            .query_row(
                "SELECT instructions FROM kanban_cards WHERE id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert!(instructions.trim().is_empty());
    }

    #[test]
    fn agent_task_response_creates_progress_update() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "INSERT INTO task_progress_updates (id, task_id, agent_id, content, status)
             VALUES ('progress-1', 'task-1', 'agent-backend', 'Investigated health routing.', 'sent')",
            [],
        )
        .unwrap();

        let content: String = conn
            .query_row(
                "SELECT content FROM task_progress_updates WHERE id = 'progress-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(content.contains("Investigated"));
    }

    #[test]
    fn generate_work_receipt_persists() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "INSERT INTO task_work_receipts (
                id, task_id, agent_id, summary, instructions_followed, acceptance_criteria_results,
                files_created, files_modified, commands_run, tests_run, validation_status
             )
             VALUES ('receipt-1', 'task-1', 'agent-backend', 'Fixed status routing.', 'Followed task instructions.', '[]', '[]', '[]', '[]', '[]', 'needs_review')",
            [],
        )
        .unwrap();

        let summary: String = conn
            .query_row(
                "SELECT summary FROM task_work_receipts WHERE id = 'receipt-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(summary, "Fixed status routing.");
    }

    #[test]
    fn cannot_complete_task_without_receipt() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);

        let receipt_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_work_receipts WHERE task_id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(receipt_count, 0);
    }

    #[test]
    fn complete_task_moves_to_done() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "INSERT INTO task_work_receipts (id, task_id, summary, validation_status)
             VALUES ('receipt-1', 'task-1', 'Receipt approved.', 'passed')",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE kanban_cards SET status = 'done', work_receipt_id = 'receipt-1' WHERE id = 'task-1'",
            [],
        )
        .unwrap();

        let (status, receipt_id): (String, String) = conn
            .query_row(
                "SELECT status, work_receipt_id FROM kanban_cards WHERE id = 'task-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(status, "done");
        assert_eq!(receipt_id, "receipt-1");
    }

    #[test]
    fn reopen_task_preserves_receipt_history() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "INSERT INTO task_work_receipts (id, task_id, summary, validation_status)
             VALUES ('receipt-1', 'task-1', 'Receipt approved.', 'passed')",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE kanban_cards SET status = 'ready', reopen_reason = 'Needs another pass' WHERE id = 'task-1'",
            [],
        )
        .unwrap();

        let receipt_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_work_receipts WHERE task_id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(receipt_count, 1);
    }

    #[test]
    fn reopen_task_preserves_history() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "INSERT INTO task_activity (id, task_id, actor_type, event_type, summary)
             VALUES ('activity-before-reopen', 'task-1', 'user', 'task_completed', 'Task completed')",
            [],
        )
        .unwrap();
        conn.execute(
            "UPDATE kanban_cards SET status = 'ready', reopen_reason = 'Needs another pass' WHERE id = 'task-1'",
            [],
        )
        .unwrap();

        let activity_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM task_activity WHERE task_id = 'task-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();

        assert_eq!(activity_count, 1);
    }

    #[test]
    fn task_activity_is_recorded() {
        let conn = setup_kanban_test_db();
        insert_test_task(&conn);
        conn.execute(
            "INSERT INTO task_activity (id, task_id, actor_type, event_type, summary)
             VALUES ('activity-1', 'task-1', 'user', 'task_created', 'Task created')",
            [],
        )
        .unwrap();

        let summary: String = conn
            .query_row(
                "SELECT summary FROM task_activity WHERE id = 'activity-1'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(summary, "Task created");
    }
}

pub fn table_has_column(conn: &Connection, table: &str, column: &str) -> Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let mut rows = stmt.query([])?;
    while let Some(row) = rows.next()? {
        let col_name: String = row.get(1)?;
        if col_name == column {
            return Ok(true);
        }
    }
    Ok(false)
}

pub fn table_exists(conn: &Connection, table: &str) -> Result<bool> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
        [table],
        |row| row.get(0),
    )
}
pub fn seed_default_agents(conn: &Connection) -> Result<()> {
    let defaults = vec![
        (
            "agent-coder",
            "Software Engineer",
            "Senior full-stack software engineer specialized in Rust, TypeScript, and local-first architectures. Highly logical, writes modular and clean code, and comments only when necessary.",
            "camelid",
            "camelid-default",
        ),
        (
            "agent-analyst",
            "Data Analyst & Architect",
            "Systems architect and data analyst. Specializes in optimizing databases, designing APIs, analyzing complex systems, and mapping out structural bottlenecks.",
            "camelid",
            "camelid-default",
        ),
        (
            "agent-writer",
            "Technical Writer",
            "Product documentarian and technical writer. Crafts exceptional, clear, and comprehensive guides, release notes, READMEs, and API docs.",
            "camelid",
            "camelid-default",
        ),
        (
            "agent-sentry",
            "QA & Monitor Sentry",
            "Sentry and quality assurance specialist. Analyzes test failures, monitors execution heartbeats, designs testing pipelines, and reports crashes or security risks.",
            "camelid",
            "camelid-default",
        ),
    ];

    for (id, role, persona, provider, model) in defaults {
        // Check if agent exists
        let exists: bool = conn.query_row(
            "SELECT EXISTS(SELECT 1 FROM agents WHERE id = ?1)",
            [id],
            |row| row.get(0),
        )?;

        if !exists {
            conn.execute(
                "INSERT INTO agents (id, name, role, persona, model_provider, model_name, temperature, max_tokens, can_spawn_subtasks, can_talk_globally, is_continuous, status)
                 VALUES (?1, ?2, ?2, ?3, ?4, ?5, 0.7, 2048, 1, 1, 0, 'idle')",
                params![id, role, persona, provider, model],
            )?;
        }
    }

    // Seed default active workspace
    let ws_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM workspaces WHERE id = 'default')",
        [],
        |row| row.get(0),
    )?;

    if !ws_exists {
        conn.execute(
            "INSERT INTO workspaces (id, name, path, active) VALUES ('default', 'Cameleer Default Workspace', '~/Desktop', 1)",
            [],
        )?;
    }

    // Seed default autopilot settings
    let auto_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM autopilot_settings WHERE workspace_id = 'default')",
        [],
        |row| row.get(0),
    )?;

    if !auto_exists {
        conn.execute(
            "INSERT INTO autopilot_settings (workspace_id, autopilot_enabled, autopilot_scope, approval_requirements, command_permissions_override, file_permissions_override, network_permissions, done_approval_rules)
             VALUES ('default', 0, 'off', 'moderate', '[]', '[]', 'none', 'reviewer_or_user')",
            [],
        )?;
    }

    // Seed default mission packs
    seed_default_mission_packs(conn)?;

    // Seed default recommended model catalog
    seed_default_models(conn)?;

    Ok(())
}

fn seed_default_mission_packs(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM custom_mission_packs", [], |row| {
        row.get(0)
    })?;
    if count > 0 {
        return Ok(());
    }

    // 1. Build Small App
    let pack_1 = (
        "build_small_app",
        "Build Small App",
        "Create a brand-new application from scratch with a complete crew: Architect, Software Engineer, QA Sentry, and Technical Writer.",
        "development",
        r#"[
            {"name":"Architect","role":"Architect","description":"Drafts architectural blueprints and file trees.","template_id":"architect","suggested_model":"camelid-default","reasoning_level":"advanced","allowed_tools":["view_file","write_to_file"],"command_permissions":["ls","pwd"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Responsible for designing structure."},
            {"name":"Lead Coder","role":"Software Engineer","description":"Implements application logic.","template_id":"software_engineer","suggested_model":"camelid-default","reasoning_level":"standard","allowed_tools":["view_file","write_to_file","replace_file_content"],"command_permissions":["cargo","npm","python3"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Performs actual code writing."},
            {"name":"QA Sentry","role":"QA Engineer","description":"Drafts and executes validation assertions.","template_id":"qa_engineer","suggested_model":"camelid-default","reasoning_level":"standard","allowed_tools":["view_file","run_command"],"command_permissions":["cargo","npm","pytest"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Verifies test passes."},
            {"name":"Tech Writer","role":"Technical Writer","description":"Composes rich manuals and README markdown guides.","template_id":"technical_writer","suggested_model":"camelid-default","reasoning_level":"standard","allowed_tools":["view_file","write_to_file"],"command_permissions":["cat","ls"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Ensures clear setup instructions."}
        ]"#,
        r#"["Backlog", "Ready", "In Progress", "Review", "Done"]"#,
        r#"[
            {"title":"Define scope","description":"Blueprint application scope, file layouts, and structural guidelines in architecture.md.","suggested_agent_role":"Architect","priority":"high","status":"backlog","acceptance_criteria":["architecture.md exists","File structure mapped"],"required_files":["architecture.md"],"related_files":[],"dependencies":[],"evidence_gate":{"type":"file_exists","path":"architecture.md"},"review_required":1,"rationale":"Scope maps dependencies."},
            {"title":"Create project structure","description":"Scaffold folder layout and configuration configs.","suggested_agent_role":"Architect","priority":"high","status":"backlog","acceptance_criteria":["Config files created"],"required_files":[],"related_files":[],"dependencies":["Define scope"],"evidence_gate":{"type":"file_exists","path":"Cargo.toml"},"review_required":0,"rationale":"Scaffolding builds baseline."},
            {"title":"Implement core app","description":"Program core business logic files.","suggested_agent_role":"Software Engineer","priority":"high","status":"backlog","acceptance_criteria":["Build compiles cleanly"],"required_files":[],"related_files":[],"dependencies":["Create project structure"],"evidence_gate":{"type":"build_success"},"review_required":1,"rationale":"Core code implementation."},
            {"title":"Add tests or validation","description":"Draft comprehensive unit tests to assert gameplay or functionality states.","suggested_agent_role":"QA Engineer","priority":"medium","status":"backlog","acceptance_criteria":["Tests pass successfully"],"required_files":[],"related_files":[],"dependencies":["Implement core app"],"evidence_gate":{"type":"tests_pass"},"review_required":1,"rationale":"Validates code correctness."},
            {"title":"Write README","description":"Compose detailed setup instructions and limitations in README.md.","suggested_agent_role":"Technical Writer","priority":"medium","status":"backlog","acceptance_criteria":["README.md written","Setup steps included"],"required_files":["README.md"],"related_files":[],"dependencies":["Implement core app"],"evidence_gate":{"type":"file_exists","path":"README.md"},"review_required":0,"rationale":"Guides user onboarding."}
        ]"#,
        r#"{"required_gates":["file_exists","build_success"]}"#,
        r#"{"requires_review":true,"reviewer_roles":["Architect","User"]}"#,
        r#"{"dangerous_commands_blocked":true,"file_boundaries_enforced":true}"#,
        0,
        "1.0"
    );

    // 2. Fix Existing Repo
    let pack_2 = (
        "fix_existing_repo",
        "Fix Existing Repo",
        "Audit a repository, identify compile or execution blockers, implement fixes, and validate corrections.",
        "maintenance",
        r#"[
            {"name":"Lead Coder","role":"Software Engineer","description":"Troubleshoots and implements fixes.","template_id":"software_engineer","suggested_model":"camelid-default","reasoning_level":"advanced","allowed_tools":["view_file","replace_file_content","run_command"],"command_permissions":["cargo","npm","git","python3"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Responsible for writing code repairs."},
            {"name":"Auditor","role":"QA Engineer","description":"Validates errors and runs checks.","template_id":"qa_engineer","suggested_model":"camelid-default","reasoning_level":"standard","allowed_tools":["view_file","run_command"],"command_permissions":["cargo","npm"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Asserts clean test runs."}
        ]"#,
        r#"["Backlog", "Ready", "In Progress", "Review", "Done"]"#,
        r#"[
            {"title":"Inspect repo","description":"Examine build configurations, test logs, and identify dependencies.","suggested_agent_role":"QA Engineer","priority":"high","status":"backlog","acceptance_criteria":["Identify failing modules"],"required_files":[],"related_files":[],"dependencies":[],"evidence_gate":{"type":"manual"},"review_required":0,"rationale":"Diagnostics find faults."},
            {"title":"Identify build/test commands","description":"Validate commands that reproduce compile or test assertions failures.","suggested_agent_role":"QA Engineer","priority":"high","status":"backlog","acceptance_criteria":["Commands cataloged"],"required_files":[],"related_files":[],"dependencies":["Inspect repo"],"evidence_gate":{"type":"manual"},"review_required":0,"rationale":"Isolates reproduction steps."},
            {"title":"Fix highest-impact issue","description":"Patch the broken source file to resolve compilation or test failures.","suggested_agent_role":"Software Engineer","priority":"high","status":"backlog","acceptance_criteria":["Build compiles without error"],"required_files":[],"related_files":[],"dependencies":["Identify build/test commands"],"evidence_gate":{"type":"build_success"},"review_required":1,"rationale":"Performs direct repair."},
            {"title":"Validate fix","description":"Execute test suites to guarantee the regression is fixed.","suggested_agent_role":"QA Engineer","priority":"medium","status":"backlog","acceptance_criteria":["All unit tests pass"],"required_files":[],"related_files":[],"dependencies":["Fix highest-impact issue"],"evidence_gate":{"type":"tests_pass"},"review_required":1,"rationale":"Ensures bug is cured."}
        ]"#,
        r#"{"required_gates":["build_success"]}"#,
        r#"{"requires_review":true,"reviewer_roles":["QA Engineer"]}"#,
        r#"{"dangerous_commands_blocked":true}"#,
        0,
        "1.0"
    );

    // 3. Documentation Pass
    let pack_3 = (
        "documentation_pass",
        "Documentation Pass",
        "Inspect codebase implementations, map out API endpoints, write user guides, and update readme directories.",
        "documentation",
        r#"[
            {"name":"Tech Writer","role":"Technical Writer","description":"Specialist in drafting high-quality documentation.","template_id":"technical_writer","suggested_model":"camelid-default","reasoning_level":"standard","allowed_tools":["view_file","write_to_file"],"command_permissions":["ls"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Responsible for document layout."},
            {"name":"Developer Reviewer","role":"Software Engineer","description":"Verifies documentation against code.","template_id":"software_engineer","suggested_model":"camelid-default","reasoning_level":"standard","allowed_tools":["view_file"],"command_permissions":["ls"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Verifies technical accuracy."}
        ]"#,
        r#"["Backlog", "Ready", "In Progress", "Review", "Done"]"#,
        r#"[
            {"title":"Inspect implementation","description":"Analyze core source directories to map APIs, setup routines, and parameters.","suggested_agent_role":"Technical Writer","priority":"high","status":"backlog","acceptance_criteria":["Source files cataloged"],"required_files":[],"related_files":[],"dependencies":[],"evidence_gate":{"type":"manual"},"review_required":0,"rationale":"Retrieves code facts."},
            {"title":"Identify missing docs","description":"Create checklist of un-documented functions, APIs, or settings.","suggested_agent_role":"Technical Writer","priority":"medium","status":"backlog","acceptance_criteria":["Documentation gap checklist completed"],"required_files":[],"related_files":[],"dependencies":["Inspect implementation"],"evidence_gate":{"type":"manual"},"review_required":0,"rationale":"Highlights missing items."},
            {"title":"Write README update","description":"Revamp active README.md or add API docs with concrete details.","suggested_agent_role":"Technical Writer","priority":"high","status":"backlog","acceptance_criteria":["Markdown doc updated"],"required_files":["README.md"],"related_files":[],"dependencies":["Identify missing docs"],"evidence_gate":{"type":"file_exists","path":"README.md"},"review_required":1,"rationale":"Publishes documentation."},
            {"title":"Review docs against actual code","description":"Double-check instructions, commands, and options against source references.","suggested_agent_role":"Software Engineer","priority":"medium","status":"backlog","acceptance_criteria":["Setup commands confirmed operational"],"required_files":[],"related_files":[],"dependencies":["Write README update"],"evidence_gate":{"type":"manual"},"review_required":1,"rationale":"Asserts accuracy."}
        ]"#,
        r#"{"required_gates":["file_exists"]}"#,
        r#"{"requires_review":true,"reviewer_roles":["Software Engineer"]}"#,
        r#"{"dangerous_commands_blocked":true}"#,
        0,
        "1.0"
    );

    // 4. QA Sprint
    let pack_4 = (
        "qa_sprint",
        "QA Sprint",
        "Analyze code test coverage, write unit testing structures, execute assertions, and report debug logs.",
        "testing",
        r#"[
            {"name":"QA Sentry","role":"QA Engineer","description":"Writes and runs test cases.","template_id":"qa_engineer","suggested_model":"camelid-default","reasoning_level":"advanced","allowed_tools":["view_file","write_to_file","run_command"],"command_permissions":["cargo","npm","pytest"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Responsible for verifying assertions."},
            {"name":"Lead Coder","role":"Software Engineer","description":"Fixes bugs found during QA.","template_id":"software_engineer","suggested_model":"camelid-default","reasoning_level":"standard","allowed_tools":["view_file","replace_file_content"],"command_permissions":["cargo","npm"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Patches failing code."}
        ]"#,
        r#"["Backlog", "Ready", "In Progress", "Review", "Done"]"#,
        r#"[
            {"title":"Identify test surface","description":"Determine which files and functions lack testing structures.","suggested_agent_role":"QA Engineer","priority":"high","status":"backlog","acceptance_criteria":["Test surface cataloged"],"required_files":[],"related_files":[],"dependencies":[],"evidence_gate":{"type":"manual"},"review_required":0,"rationale":"Finds gaps in safety."},
            {"title":"Run existing tests","description":"Execute current test suites and compile list of failing assertions.","suggested_agent_role":"QA Engineer","priority":"high","status":"backlog","acceptance_criteria":["Assertion pass/fail sheet saved"],"required_files":[],"related_files":[],"dependencies":["Identify test surface"],"evidence_gate":{"type":"manual"},"review_required":0,"rationale":"Evaluates baseline health."},
            {"title":"Create validation checklist","description":"Draft a comprehensive testing checklist covering standard boundary checks.","suggested_agent_role":"QA Engineer","priority":"medium","status":"backlog","acceptance_criteria":["Validation checklist saved"],"required_files":[],"related_files":[],"dependencies":["Run existing tests"],"evidence_gate":{"type":"manual"},"review_required":1,"rationale":"Lays down test rigor."}
        ]"#,
        r#"{"required_gates":[]}"#,
        r#"{"requires_review":true,"reviewer_roles":["Software Engineer"]}"#,
        r#"{"dangerous_commands_blocked":true}"#,
        0,
        "1.0"
    );

    // 5. Open Source Launch
    let pack_5 = (
        "open_source_launch",
        "Open Source Launch",
        "Prepare a project for public open-source publication. Write license files, contribution guides, build notes, and launch summaries.",
        "documentation",
        r#"[
            {"name":"Writer","role":"Technical Writer","description":"Formats open-source manuals and guidelines.","template_id":"technical_writer","suggested_model":"camelid-default","reasoning_level":"standard","allowed_tools":["view_file","write_to_file"],"command_permissions":["ls"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Formats text documents."},
            {"name":"Launch Manager","role":"Product Manager","description":"Audits release check-lists and licenses.","template_id":"product_manager","suggested_model":"camelid-default","reasoning_level":"standard","allowed_tools":["view_file"],"command_permissions":["ls"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Responsible for launch compliance."}
        ]"#,
        r#"["Backlog", "Ready", "In Progress", "Review", "Done"]"#,
        r#"[
            {"title":"Improve README","description":"Format professional Markdown badges, setup options, and usage examples.","suggested_agent_role":"Technical Writer","priority":"high","status":"backlog","acceptance_criteria":["README.md styled"],"required_files":["README.md"],"related_files":[],"dependencies":[],"evidence_gate":{"type":"file_exists","path":"README.md"},"review_required":1,"rationale":"Polishes branding."},
            {"title":"Add installation guide","description":"Draft standard command-line scripts to install dependencies cleanly.","suggested_agent_role":"Technical Writer","priority":"high","status":"backlog","acceptance_criteria":["INSTALL.md or README setup written"],"required_files":[],"related_files":[],"dependencies":["Improve README"],"evidence_gate":{"type":"manual"},"review_required":0,"rationale":"Ensures smooth install."},
            {"title":"Add contribution guide","description":"Write CONTRIBUTING.md outlining style guidelines, pull request steps, and codes of conduct.","suggested_agent_role":"Technical Writer","priority":"medium","status":"backlog","acceptance_criteria":["CONTRIBUTING.md exists"],"required_files":["CONTRIBUTING.md"],"related_files":[],"dependencies":["Improve README"],"evidence_gate":{"type":"file_exists","path":"CONTRIBUTING.md"},"review_required":0,"rationale":"Coordinates team contributions."}
        ]"#,
        r#"{"required_gates":["file_exists"]}"#,
        r#"{"requires_review":true,"reviewer_roles":["Product Manager"]}"#,
        r#"{"dangerous_commands_blocked":true}"#,
        0,
        "1.0"
    );

    // 6. Local AI Runtime Benchmark
    let pack_6 = (
        "local_ai_benchmark",
        "Local AI Runtime Benchmark",
        "Establish baseline, deploy local benchmarking scripts, test CPU/GPU performance, compile and plot latencies.",
        "benchmarking",
        r#"[
            {"name":"Performance Eng","role":"Performance Engineer","description":"Local LLM speed benchmarking specialist.","template_id":"performance_engineer","suggested_model":"camelid-default","reasoning_level":"advanced","allowed_tools":["view_file","run_command","write_to_file"],"command_permissions":["cargo","python3","lsof"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Profiles local runtimes."},
            {"name":"QA Sentry","role":"QA Engineer","description":"Validates consistency of scores.","template_id":"qa_engineer","suggested_model":"camelid-default","reasoning_level":"standard","allowed_tools":["view_file","run_command"],"command_permissions":["cargo"],"file_access_scope":["*"],"kanban_permissions":"full","safety_profile":"moderate","escalation_rules":"{}","rationale":"Validates benchmark logs."}
        ]"#,
        r#"["Backlog", "Ready", "In Progress", "Review", "Done"]"#,
        r#"[
            {"title":"Identify benchmark target","description":"Pick active GGUF or LLM server endpoint port (e.g. 8181 or 11434).","suggested_agent_role":"Performance Engineer","priority":"high","status":"backlog","acceptance_criteria":["Benchmark target endpoint active"],"required_files":[],"related_files":[],"dependencies":[],"evidence_gate":{"type":"manual"},"review_required":0,"rationale":"Isolates testing target."},
            {"title":"Define baseline","description":"Establish baseline prompt configurations and expected token response thresholds.","suggested_agent_role":"Performance Engineer","priority":"high","status":"backlog","acceptance_criteria":["Baseline parameters recorded"],"required_files":[],"related_files":[],"dependencies":["Identify benchmark target"],"evidence_gate":{"type":"manual"},"review_required":0,"rationale":"Standardizes latency runs."},
            {"title":"Run benchmark","description":"Execute the benchmarking cargo/python scripts to capture Latency and TPS metrics.","suggested_agent_role":"Performance Engineer","priority":"high","status":"backlog","acceptance_criteria":["Benchmark completion logs captured"],"required_files":[],"related_files":[],"dependencies":["Define baseline"],"evidence_gate":{"type":"manual"},"review_required":1,"rationale":"Runs local profiling."}
        ]"#,
        r#"{"required_gates":[]}"#,
        r#"{"requires_review":true,"reviewer_roles":["QA Engineer"]}"#,
        r#"{"dangerous_commands_blocked":true}"#,
        0,
        "1.0"
    );

    let packs = vec![pack_1, pack_2, pack_3, pack_4, pack_5, pack_6];
    for (
        id,
        name,
        desc,
        cat,
        agents,
        columns,
        cards,
        gates,
        review,
        permissions,
        editable,
        version,
    ) in packs
    {
        conn.execute(
            "INSERT OR REPLACE INTO custom_mission_packs (id, name, description, category, default_agents, default_columns, default_cards, default_evidence_gates, default_review_flow, default_permissions, user_editable, version)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![id, name, desc, cat, agents, columns, cards, gates, review, permissions, editable, version],
        )?;
    }

    Ok(())
}

pub fn seed_default_models(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM models WHERE provider = 'curated'",
        [],
        |row| row.get(0),
    )?;
    if count > 0 {
        return Ok(());
    }

    let default_models = vec![
        (
            "llama-3.2-3b",
            "Llama 3.2 3B Instruct (Q8_0)",
            "curated",
            "bartowski/Llama-3.2-3B-Instruct-GGUF",
            "Llama-3.2-3B-Instruct-Q8_0.gguf",
            "llama",
            "Q8_0",
            "3.2B",
            3480000000i64, // ~3.48 GB
            "recommended",
            1, // runnable
            "Llama-3.2-3B is a highly capable instruct/coder model that fits standard macOS devices with Metal GPU acceleration seamlessly.",
            "Llama-3.2-3B-Instruct-Q8_0.gguf"
        ),
        (
            "llama-3.2-1b",
            "Llama 3.2 1B Instruct (Q8_0)",
            "curated",
            "bartowski/Llama-3.2-1B-Instruct-GGUF",
            "Llama-3.2-1B-Instruct-Q8_0.gguf",
            "llama",
            "Q8_0",
            "1.2B",
            1240000000i64, // ~1.24 GB
            "recommended",
            1,
            "Llama-3.2-1B is an extremely lightweight, fast-executing model ideal for fast routine task automation.",
            "Llama-3.2-1B-Instruct-Q8_0.gguf"
        ),
        (
            "tinyllama-1.1b",
            "TinyLlama 1.1B Chat (Q8_0)",
            "curated",
            "TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF",
            "tinyllama-1.1b-chat-v1.0.Q8_0.gguf",
            "llama",
            "Q8_0",
            "1.1B",
            1100000000i64, // ~1.10 GB
            "experimental",
            1,
            "TinyLlama is a compact chat-tuned model. Recommended for testing and ultra-low overhead runtimes only.",
            "tinyllama-1.1b-chat-v1.0.Q8_0.gguf"
        ),
        (
            "mistral-7b",
            "Mistral 7B Instruct (Q8_0)",
            "curated",
            "maziyarpanahi/Mistral-7B-Instruct-v0.3-GGUF",
            "Mistral-7B-Instruct-v0.3.Q8_0.gguf",
            "mistral",
            "Q8_0",
            "7.2B",
            7700000000i64, // ~7.70 GB
            "supported",
            1,
            "Mistral 7B offers premium instruction-following capabilities. Recommended for devices with 16GB+ memory.",
            "Mistral-7B-Instruct-v0.3.Q8_0.gguf"
        ),
        (
            "llama-3-8b",
            "Llama 3 8B Instruct (Q4_K_M)",
            "curated",
            "bartowski/Meta-Llama-3-8B-Instruct-GGUF",
            "Meta-Llama-3-8B-Instruct-Q4_K_M.gguf",
            "llama",
            "Q4_K_M",
            "8.0B",
            4800000000i64, // ~4.80 GB
            "experimental",
            1,
            "Llama 3 8B is a robust instruct-following model. Highly recommended for heavy reasoning runs.",
            "Meta-Llama-3-8B-Instruct-Q4_K_M.gguf"
        ),
    ];

    for (
        id,
        name,
        prov,
        repo,
        file,
        arch,
        quant,
        params_cnt,
        size,
        comp,
        runnable,
        desc,
        filename,
    ) in default_models
    {
        conn.execute(
            "INSERT OR REPLACE INTO models (
                model_id, display_name, provider, source_repo, source_file,
                architecture, quantization, parameter_count, file_size_bytes,
                install_status, compatibility_status, runnable_status, license
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'not_installed', ?10, ?11, ?12)",
            params![
                id, name, prov, repo, file, arch, quant, params_cnt, size, comp, runnable, desc
            ],
        )?;

        // Seed model files
        let file_url = if prov == "curated" {
            format!("https://huggingface.co/{}/resolve/main/{}", repo, file)
        } else {
            "".to_string()
        };
        conn.execute(
            "INSERT OR REPLACE INTO model_files (
                file_id, model_id, filename, provider_url, file_size_bytes, download_status, install_status
            ) VALUES (?1, ?2, ?3, ?4, ?5, 'idle', 'pending')",
            params![format!("{}-file", id), id, filename, file_url, size],
        )?;
    }

    Ok(())
}
