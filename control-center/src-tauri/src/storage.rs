use rusqlite::{params, Connection, Result};
use std::fs;
use std::path::PathBuf;

pub struct DbState {
    pub conn: std::sync::Mutex<rusqlite::Connection>,
}

pub fn get_db_path() -> PathBuf {
    let mut path = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/Users/timtoole".to_string()));
    path.push(".cameleer");
    
    // Create directory if not exists
    if !path.exists() {
        fs::create_dir_all(&path).expect("Failed to create ~/.cameleer directory");
    }
    
    path.push("cameleer_workspace.db");
    path
}

pub fn init_db(conn: &Connection) -> Result<()> {
    // Migration: Check if agents has safety_profile column. If not, drop it to recreate.
    let has_safety_profile: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('agents') WHERE name='safety_profile')",
        [],
        |row| row.get(0),
    ).unwrap_or(false);

    if !has_safety_profile {
        let _ = conn.execute("DROP TABLE IF EXISTS agents", []);
    }

    // 1. Agents Registry
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            persona TEXT NOT NULL,
            model_provider TEXT NOT NULL,
            model_name TEXT NOT NULL,
            temperature REAL DEFAULT 0.7,
            max_tokens INTEGER DEFAULT 2048,
            can_spawn_subtasks INTEGER DEFAULT 1,
            can_talk_globally INTEGER DEFAULT 1,
            is_continuous INTEGER DEFAULT 0,
            status TEXT DEFAULT 'idle',
            last_heartbeat TEXT,
            primary_skills TEXT,
            allowed_tools TEXT,
            reasoning_level TEXT DEFAULT 'standard',
            workspace_access TEXT DEFAULT 'full',
            file_access_scope TEXT,
            command_permissions TEXT,
            kanban_permissions TEXT DEFAULT 'full',
            review_requirements INTEGER DEFAULT 0,
            safety_profile TEXT DEFAULT 'moderate',
            escalation_rules TEXT
        )",
        [],
    )?;

    // 2. Model Settings & Configurations
    conn.execute(
        "CREATE TABLE IF NOT EXISTS model_configs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            provider TEXT NOT NULL,
            model_name TEXT NOT NULL,
            api_key TEXT,
            endpoint_url TEXT,
            is_default INTEGER DEFAULT 0
        )",
        [],
    )?;

    // 3. Unified Messages Stream
    conn.execute(
        "CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            sender_id TEXT,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Migration: Check if tasks has workspace_id column. If not, drop dependent tables and tasks to recreate.
    let has_workspace_id: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('tasks') WHERE name='workspace_id')",
        [],
        |row| row.get(0),
    ).unwrap_or(false);

    if !has_workspace_id {
        let _ = conn.execute("DROP TABLE IF EXISTS task_blockers", []);
        let _ = conn.execute("DROP TABLE IF EXISTS agent_runs", []);
        let _ = conn.execute("DROP TABLE IF EXISTS artifacts", []);
        let _ = conn.execute("DROP TABLE IF EXISTS handoffs", []);
        let _ = conn.execute("DROP TABLE IF EXISTS tasks", []);
    }

    // 4. Tasks & Objective Registry (Upgraded Kanban Cards)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            workspace_id TEXT REFERENCES workspaces(id),
            title TEXT NOT NULL,
            description TEXT,
            owner_id TEXT REFERENCES agents(id),
            assigned_agent_id TEXT REFERENCES agents(id),
            status TEXT DEFAULT 'backlog',
            priority TEXT DEFAULT 'medium',
            created_by TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            due_date TEXT,
            acceptance_criteria TEXT,
            required_files TEXT,
            related_files TEXT,
            related_artifacts TEXT,
            dependencies TEXT,
            blockers TEXT,
            comments TEXT,
            activity_log TEXT,
            validation_status TEXT DEFAULT 'pending',
            completion_evidence TEXT
        )",
        [],
    )?;

    // 5. Task Blockers Mapping
    conn.execute(
        "CREATE TABLE IF NOT EXISTS task_blockers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT REFERENCES tasks(id),
            blocked_by_task_id TEXT REFERENCES tasks(id),
            reason TEXT NOT NULL
        )",
        [],
    )?;

    // 6. Continuous Work Runs
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agent_runs (
            id TEXT PRIMARY KEY,
            agent_id TEXT REFERENCES agents(id),
            task_id TEXT REFERENCES tasks(id),
            status TEXT NOT NULL,
            last_state TEXT,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            ended_at DATETIME
        )",
        [],
    )?;

    // 7. Persistent Event Log
    conn.execute(
        "CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_type TEXT NOT NULL,
            agent_id TEXT,
            task_id TEXT,
            payload TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 8. Blackboard Shared World State Summary
    conn.execute(
        "CREATE TABLE IF NOT EXISTS shared_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 9. Workspace Artifacts
    conn.execute(
        "CREATE TABLE IF NOT EXISTS artifacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT REFERENCES tasks(id),
            path TEXT NOT NULL,
            artifact_type TEXT NOT NULL,
            size_bytes INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 10. Global Settings
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // 11. Workspaces
    conn.execute(
        "CREATE TABLE IF NOT EXISTS workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            path TEXT NOT NULL,
            active INTEGER DEFAULT 0
        )",
        [],
    )?;

    // 12. Decisions
    conn.execute(
        "CREATE TABLE IF NOT EXISTS decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id TEXT REFERENCES workspaces(id),
            decision TEXT NOT NULL,
            decided_by TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 13. Handoffs
    conn.execute(
        "CREATE TABLE IF NOT EXISTS handoffs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT REFERENCES tasks(id),
            source_agent_id TEXT REFERENCES agents(id),
            target_agent_id TEXT REFERENCES agents(id),
            reason TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 14. Checkpoints Store
    conn.execute(
        "CREATE TABLE IF NOT EXISTS checkpoints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_id TEXT REFERENCES agents(id),
            task_id TEXT REFERENCES tasks(id),
            plan TEXT,
            completed_steps TEXT,
            open_steps TEXT,
            files_touched TEXT,
            reasoning_summary TEXT,
            last_tool_output TEXT,
            validation_status TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 15. Custom & Built-In Mission Packs
    conn.execute(
        "CREATE TABLE IF NOT EXISTS custom_mission_packs (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            default_agents TEXT, -- JSON Array
            default_columns TEXT, -- JSON Array
            default_cards TEXT, -- JSON Array
            default_evidence_gates TEXT, -- JSON
            default_review_flow TEXT, -- JSON
            default_permissions TEXT, -- JSON
            user_editable INTEGER DEFAULT 1,
            version TEXT
        )",
        [],
    )?;

    // 16. Mission Previews (Draft Plans)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS mission_previews (
            id TEXT PRIMARY KEY,
            workspace_id TEXT REFERENCES workspaces(id),
            mission_title TEXT NOT NULL,
            mission_goal TEXT NOT NULL,
            mission_type TEXT NOT NULL,
            risks TEXT, -- JSON Array
            assumptions TEXT, -- JSON Array
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            status TEXT DEFAULT 'draft'
        )",
        [],
    )?;

    // 17. Mission Preview Proposed Agents
    conn.execute(
        "CREATE TABLE IF NOT EXISTS mission_preview_agents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            preview_id TEXT REFERENCES mission_previews(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            description TEXT,
            template_id TEXT,
            suggested_model TEXT,
            reasoning_level TEXT DEFAULT 'standard',
            allowed_tools TEXT, -- JSON Array
            command_permissions TEXT, -- JSON Array
            file_access_scope TEXT, -- JSON Array
            kanban_permissions TEXT DEFAULT 'full',
            safety_profile TEXT DEFAULT 'moderate',
            escalation_rules TEXT, -- JSON
            rationale TEXT
        )",
        [],
    )?;

    // 18. Mission Preview Proposed Cards
    conn.execute(
        "CREATE TABLE IF NOT EXISTS mission_preview_cards (
            id TEXT PRIMARY KEY,
            preview_id TEXT REFERENCES mission_previews(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            suggested_agent_role TEXT,
            suggested_agent_id TEXT,
            priority TEXT DEFAULT 'medium',
            status TEXT DEFAULT 'backlog',
            acceptance_criteria TEXT, -- JSON Array
            required_files TEXT, -- JSON Array
            related_files TEXT, -- JSON Array
            dependencies TEXT, -- JSON Array of IDs
            evidence_gate TEXT, -- JSON
            review_required INTEGER DEFAULT 0,
            rationale TEXT
        )",
        [],
    )?;

    // 19. Agent Contracts
    conn.execute(
        "CREATE TABLE IF NOT EXISTS mission_agent_contracts (
            agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            responsibilities TEXT, -- JSON Array
            allowed_actions TEXT, -- JSON Array
            required_context_before_work TEXT, -- JSON Array
            required_outputs TEXT, -- JSON Array
            validation_rules TEXT, -- JSON Array
            handoff_rules TEXT, -- JSON Array
            escalation_rules TEXT, -- JSON Array
            done_definition TEXT -- JSON Array
        )",
        [],
    )?;

    // 20. Work Receipts
    conn.execute(
        "CREATE TABLE IF NOT EXISTS mission_work_receipts (
            card_id TEXT PRIMARY KEY REFERENCES tasks(id) ON DELETE CASCADE,
            agent_id TEXT REFERENCES agents(id),
            summary TEXT NOT NULL,
            files_created TEXT, -- JSON Array
            files_modified TEXT, -- JSON Array
            commands_run TEXT, -- JSON Array
            tests_run TEXT, -- JSON Array
            validation_status TEXT NOT NULL,
            evidence_links TEXT, -- JSON Array
            known_limitations TEXT, -- JSON Array
            follow_up_recommendations TEXT, -- JSON Array
            completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 21. Autopilot Settings
    conn.execute(
        "CREATE TABLE IF NOT EXISTS autopilot_settings (
            workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
            autopilot_enabled INTEGER DEFAULT 0,
            autopilot_scope TEXT DEFAULT 'off',
            approval_requirements TEXT DEFAULT 'moderate',
            command_permissions_override TEXT, -- JSON Array
            file_permissions_override TEXT, -- JSON Array
            network_permissions TEXT DEFAULT 'none',
            done_approval_rules TEXT DEFAULT 'reviewer_or_user'
        )",
        [],
    )?;

    // 22. Mission Recommendations
    conn.execute(
        "CREATE TABLE IF NOT EXISTS mission_recommendations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
            recommendation_type TEXT NOT NULL,
            content TEXT NOT NULL,
            action_target TEXT,
            status TEXT DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 23. Mission Audit Events Log
    conn.execute(
        "CREATE TABLE IF NOT EXISTS mission_audit_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workspace_id TEXT REFERENCES workspaces(id),
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    Ok(())
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

    Ok(())
}

fn seed_default_mission_packs(conn: &Connection) -> Result<()> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM custom_mission_packs", [], |row| row.get(0))?;
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
    for (id, name, desc, cat, agents, columns, cards, gates, review, permissions, editable, version) in packs {
        conn.execute(
            "INSERT OR REPLACE INTO custom_mission_packs (id, name, description, category, default_agents, default_columns, default_cards, default_evidence_gates, default_review_flow, default_permissions, user_editable, version)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            params![id, name, desc, cat, agents, columns, cards, gates, review, permissions, editable, version],
        )?;
    }

    Ok(())
}
