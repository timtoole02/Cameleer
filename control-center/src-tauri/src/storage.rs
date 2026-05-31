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
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY
        )",
        [],
    )?;

    // Migration: Check if agents has safety_profile column. If not, add it via ALTER TABLE.
    let has_safety_profile: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('agents') WHERE name='safety_profile')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_safety_profile {
        let _ = conn.execute(
            "ALTER TABLE agents ADD COLUMN kanban_permissions TEXT DEFAULT 'full'",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE agents ADD COLUMN review_requirements INTEGER DEFAULT 0",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE agents ADD COLUMN safety_profile TEXT DEFAULT 'moderate'",
            [],
        );
        let _ = conn.execute("ALTER TABLE agents ADD COLUMN escalation_rules TEXT", []);
        let _ = conn.execute(
            "ALTER TABLE agents ADD COLUMN parent_agent_id TEXT REFERENCES agents(id)",
            [],
        );
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
            escalation_rules TEXT,
            parent_agent_id TEXT REFERENCES agents(id)
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
    let has_workspace_id: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('tasks') WHERE name='workspace_id')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_workspace_id {
        let _ = conn.execute("ALTER TABLE kanban_cards ADD COLUMN workspace_id TEXT", []);
    }

    // Epic 5 Kanban System Schema

    // 4a. Boards
    conn.execute(
        "CREATE TABLE IF NOT EXISTS boards (
            id TEXT PRIMARY KEY,
            workspace_id TEXT REFERENCES workspaces(id),
            name TEXT NOT NULL,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 4b. Board Columns
    conn.execute(
        "CREATE TABLE IF NOT EXISTS board_columns (
            id TEXT PRIMARY KEY,
            board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            status_mapping TEXT NOT NULL,
            rank INTEGER NOT NULL,
            wip_limit INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 4c. Backlogs
    conn.execute(
        "CREATE TABLE IF NOT EXISTS backlogs (
            id TEXT PRIMARY KEY,
            workspace_id TEXT REFERENCES workspaces(id),
            name TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 4d. Backlog Items
    conn.execute(
        "CREATE TABLE IF NOT EXISTS backlog_items (
            id TEXT PRIMARY KEY,
            workspace_id TEXT REFERENCES workspaces(id),
            backlog_id TEXT REFERENCES backlogs(id) ON DELETE CASCADE,
            title TEXT NOT NULL,
            description TEXT,
            type TEXT DEFAULT 'feature',
            priority TEXT DEFAULT 'medium',
            rank INTEGER DEFAULT 0,
            labels TEXT,
            source TEXT DEFAULT 'human',
            status TEXT DEFAULT 'captured',
            owner_agent_id TEXT REFERENCES agents(id),
            owner_human_id TEXT,
            proposed_agent_role TEXT,
            acceptance_criteria TEXT,
            refinement_notes TEXT,
            dependencies TEXT,
            risk_level TEXT DEFAULT 'low',
            effort_estimate TEXT,
            readiness_score INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 4e. Kanban Cards (Replaces Tasks)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS kanban_cards (
            id TEXT PRIMARY KEY,
            workspace_id TEXT REFERENCES workspaces(id),
            board_id TEXT REFERENCES boards(id),
            backlog_id TEXT REFERENCES backlogs(id),
            parent_id TEXT REFERENCES kanban_cards(id),
            title TEXT NOT NULL,
            description TEXT,
            type TEXT DEFAULT 'feature',
            status TEXT DEFAULT 'ready',
            priority TEXT DEFAULT 'medium',
            rank INTEGER DEFAULT 0,
            severity TEXT,
            labels TEXT,
            assigned_agent_id TEXT REFERENCES agents(id),
            assigned_human_id TEXT,
            reporter TEXT,
            created_by TEXT DEFAULT 'system',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            due_date TEXT,
            start_date TEXT,
            completed_at TEXT,
            estimate TEXT,
            actual_time TEXT,
            acceptance_criteria TEXT,
            definition_of_done TEXT,
            required_files TEXT,
            related_files TEXT,
            related_artifacts TEXT,
            dependencies TEXT,
            blocked_by TEXT,
            blocking TEXT,
            comments TEXT,
            activity_log TEXT,
            checklist TEXT,
            validation_status TEXT DEFAULT 'pending',
            completion_evidence TEXT,
            work_receipt_id TEXT,
            risk_level TEXT DEFAULT 'low',
            review_required INTEGER DEFAULT 0,
            approval_required INTEGER DEFAULT 0,
            reopen_reason TEXT
        )",
        [],
    )?;

    // 4f. Data Migration from `tasks` to `kanban_cards`
    let tasks_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='tasks')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if tasks_exists {
        // We do a soft migration of any existing tasks to kanban cards so nothing is lost
        conn.execute(
            "INSERT OR IGNORE INTO kanban_cards (
                id, workspace_id, title, description, assigned_agent_id,
                status, priority, reporter, created_by, created_at, updated_at,
                acceptance_criteria, required_files, related_files, related_artifacts,
                dependencies, validation_status, completion_evidence, comments, activity_log
            )
            SELECT 
                id, workspace_id, title, description, assigned_agent_id,
                status, priority, owner_id, created_by, created_at, updated_at,
                acceptance_criteria, required_files, related_files, related_artifacts,
                dependencies, validation_status, completion_evidence, comments, activity_log
            FROM kanban_cards",
            [],
        )
        .unwrap_or(0);

        // Let's keep `tasks` around temporarily if anything relies on it hardcoded, but we use kanban_cards
        // For Epic 5 we will slowly redirect references.
    }

    // 5. Task Blockers Mapping (now referencing kanban_cards)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS card_blockers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id TEXT REFERENCES kanban_cards(id),
            blocked_by_card_id TEXT REFERENCES kanban_cards(id),
            reason TEXT NOT NULL
        )",
        [],
    )?;

    // 6. Continuous Work Runs
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agent_runs (
            id TEXT PRIMARY KEY,
            agent_id TEXT REFERENCES agents(id),
            conversation_id TEXT,
            task_id TEXT REFERENCES kanban_cards(id),
            state TEXT NOT NULL,
            input TEXT,
            plan TEXT,
            final_answer TEXT,
            error TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 6b. Agent Run Steps
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agent_run_steps (
            id TEXT PRIMARY KEY,
            run_id TEXT REFERENCES agent_runs(id) ON DELETE CASCADE,
            step_type TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 6c. Tool Invocations
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tool_invocations (
            id TEXT PRIMARY KEY,
            run_id TEXT REFERENCES agent_runs(id) ON DELETE CASCADE,
            agent_id TEXT REFERENCES agents(id),
            task_id TEXT REFERENCES kanban_cards(id),
            tool_name TEXT NOT NULL,
            arguments TEXT NOT NULL,
            output TEXT,
            status TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME
        )",
        [],
    )?;

    // 6d. Tool Approvals
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tool_approvals (
            id TEXT PRIMARY KEY,
            invocation_id TEXT REFERENCES tool_invocations(id) ON DELETE CASCADE,
            card_id TEXT REFERENCES kanban_cards(id),
            agent_id TEXT REFERENCES agents(id),
            tool_name TEXT NOT NULL,
            arguments TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            decided_by TEXT,
            feedback TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            decided_at DATETIME
        )",
        [],
    )?;

    // 6e. Review Verdicts
    conn.execute(
        "CREATE TABLE IF NOT EXISTS review_verdicts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            card_id TEXT REFERENCES kanban_cards(id),
            reviewer_id TEXT,
            verdict TEXT NOT NULL,
            comments TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 6f. Memory System
    conn.execute(
        "CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            agent_id TEXT REFERENCES agents(id),
            workspace_id TEXT,
            content TEXT NOT NULL,
            context TEXT,
            importance INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_accessed_at DATETIME
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
            task_id TEXT REFERENCES kanban_cards(id),
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

    // --- Epic 6: Agent Organization System Schema ---

    // 11a. Projects
    conn.execute(
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            workspace_id TEXT REFERENCES workspaces(id),
            name TEXT NOT NULL,
            description TEXT,
            status TEXT DEFAULT 'active',
            priority TEXT DEFAULT 'medium',
            owner_agent_id TEXT REFERENCES agents(id),
            owner_human_id TEXT,
            default_board_id TEXT REFERENCES boards(id),
            default_context_id TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 11b. Teams
    conn.execute(
        "CREATE TABLE IF NOT EXISTS teams (
            id TEXT PRIMARY KEY,
            workspace_id TEXT REFERENCES workspaces(id),
            project_id TEXT REFERENCES projects(id),
            parent_team_id TEXT REFERENCES teams(id),
            name TEXT NOT NULL,
            description TEXT,
            lead_agent_id TEXT REFERENCES agents(id),
            purpose TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 11c. Agent Org Nodes (for rendering nested tree)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agent_org_nodes (
            id TEXT PRIMARY KEY,
            workspace_id TEXT REFERENCES workspaces(id),
            project_id TEXT REFERENCES projects(id),
            parent_node_id TEXT REFERENCES agent_org_nodes(id),
            node_type TEXT NOT NULL,
            display_name TEXT NOT NULL,
            agent_id TEXT REFERENCES agents(id),
            team_id TEXT REFERENCES teams(id),
            sort_order INTEGER DEFAULT 0,
            collapsed INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 11d. Agent Relationships
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agent_relationships (
            id TEXT PRIMARY KEY,
            workspace_id TEXT REFERENCES workspaces(id),
            source_agent_id TEXT REFERENCES agents(id),
            target_agent_id TEXT REFERENCES agents(id),
            relationship_type TEXT NOT NULL,
            permissions TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 11e. Agent Project Memberships
    conn.execute(
        "CREATE TABLE IF NOT EXISTS agent_project_memberships (
            id TEXT PRIMARY KEY,
            agent_id TEXT REFERENCES agents(id),
            workspace_id TEXT REFERENCES workspaces(id),
            project_id TEXT REFERENCES projects(id),
            team_id TEXT REFERENCES teams(id),
            role_in_project TEXT,
            permissions TEXT,
            active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 11f. Scoped Chat Threads
    conn.execute(
        "CREATE TABLE IF NOT EXISTS project_chat_threads (
            id TEXT PRIMARY KEY,
            project_id TEXT REFERENCES projects(id),
            name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS team_chat_threads (
            id TEXT PRIMARY KEY,
            team_id TEXT REFERENCES teams(id),
            name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 11g. Scoped Context Snapshots
    conn.execute(
        "CREATE TABLE IF NOT EXISTS scoped_context_snapshots (
            id TEXT PRIMARY KEY,
            workspace_id TEXT REFERENCES workspaces(id),
            project_id TEXT REFERENCES projects(id),
            team_id TEXT REFERENCES teams(id),
            snapshot_data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // --- End Epic 6 Schema ---

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
            task_id TEXT REFERENCES kanban_cards(id),
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
            task_id TEXT REFERENCES kanban_cards(id),
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
            approval_required INTEGER DEFAULT 0
        )",
        [],
    )?;

    // Epic 6 Schema Migrations
    let has_project_id: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM pragma_table_info('kanban_cards') WHERE name='project_id')",
        [],
        |row| row.get(0),
    ).unwrap_or(false);

    if !has_project_id {
        // Add project_id and team_id to relevant tables
        let _ = conn.execute(
            "ALTER TABLE kanban_cards ADD COLUMN project_id TEXT REFERENCES projects(id)",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE kanban_cards ADD COLUMN team_id TEXT REFERENCES teams(id)",
            [],
        );

        let _ = conn.execute(
            "ALTER TABLE backlog_items ADD COLUMN project_id TEXT REFERENCES projects(id)",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE backlog_items ADD COLUMN team_id TEXT REFERENCES teams(id)",
            [],
        );

        let _ = conn.execute(
            "ALTER TABLE messages ADD COLUMN project_id TEXT REFERENCES projects(id)",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE messages ADD COLUMN team_id TEXT REFERENCES teams(id)",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE messages ADD COLUMN agent_id TEXT REFERENCES agents(id)",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE messages ADD COLUMN card_id TEXT REFERENCES kanban_cards(id)",
            [],
        );

        let _ = conn.execute(
            "ALTER TABLE artifacts ADD COLUMN project_id TEXT REFERENCES projects(id)",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE artifacts ADD COLUMN team_id TEXT REFERENCES teams(id)",
            [],
        );

        // Migrate default organization
        // Ensure default workspace
        conn.execute("INSERT OR IGNORE INTO workspaces (id, name, path, active) VALUES ('default', 'Cameleer Workspace', '~/Desktop', 1)", []).ok();

        // Create Default Project
        conn.execute("INSERT INTO projects (id, workspace_id, name, description) VALUES ('proj_default', 'default', 'Default Project', 'System migrated project') ON CONFLICT DO NOTHING", []).ok();

        // Create Default Team
        conn.execute("INSERT INTO teams (id, workspace_id, project_id, name, description) VALUES ('team_default', 'default', 'proj_default', 'Agents', 'System migrated team') ON CONFLICT DO NOTHING", []).ok();

        // Migrate all Kanban Cards to default project
        conn.execute("UPDATE kanban_cards SET project_id = 'proj_default', team_id = 'team_default' WHERE project_id IS NULL", []).ok();

        // Migrate all Backlog Items
        conn.execute("UPDATE backlog_items SET project_id = 'proj_default', team_id = 'team_default' WHERE project_id IS NULL", []).ok();

        // Migrate all existing agents to Default Project/Team through membership
        conn.execute("
            INSERT OR IGNORE INTO agent_project_memberships (id, agent_id, workspace_id, project_id, team_id, role_in_project)
            SELECT 'apm_' || id, id, 'default', 'proj_default', 'team_default', role FROM agents
        ", []).ok();

        // Add existing workspace/project/team/agents as nodes in agent_org_nodes
        conn.execute("INSERT OR IGNORE INTO agent_org_nodes (id, workspace_id, node_type, display_name, sort_order) VALUES ('node_ws', 'default', 'workspace', 'Cameleer Workspace', 0)", []).ok();
        conn.execute("INSERT OR IGNORE INTO agent_org_nodes (id, workspace_id, project_id, parent_node_id, node_type, display_name, sort_order) VALUES ('node_proj', 'default', 'proj_default', 'node_ws', 'project', 'Default Project', 1)", []).ok();
        conn.execute("INSERT OR IGNORE INTO agent_org_nodes (id, workspace_id, project_id, team_id, parent_node_id, node_type, display_name, sort_order) VALUES ('node_team', 'default', 'proj_default', 'team_default', 'node_proj', 'team', 'Agents', 2)", []).ok();

        conn.execute("
            INSERT OR IGNORE INTO agent_org_nodes (id, workspace_id, project_id, team_id, parent_node_id, node_type, display_name, agent_id, sort_order)
            SELECT 'node_agent_' || id, 'default', 'proj_default', 'team_default', 'node_team', 'agent', name, id, 3 FROM agents
        ", []).ok();
    }

    // Epic 7 Migrations: Real Enterprise App
    let has_parent_agent_id: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('agents') WHERE name='parent_agent_id')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_parent_agent_id {
        let _ = conn.execute(
            "ALTER TABLE agents ADD COLUMN parent_agent_id TEXT REFERENCES agents(id)",
            [],
        );
    }

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
            card_id TEXT PRIMARY KEY REFERENCES kanban_cards(id) ON DELETE CASCADE,
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

    // 24. Models Registry
    conn.execute(
        "CREATE TABLE IF NOT EXISTS models (
            model_id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            provider TEXT NOT NULL,
            source_repo TEXT,
            source_file TEXT,
            local_path TEXT,
            architecture TEXT,
            quantization TEXT,
            parameter_count TEXT,
            file_size_bytes INTEGER,
            checksum_sha256 TEXT,
            install_status TEXT NOT NULL,
            compatibility_status TEXT NOT NULL,
            runnable_status INTEGER DEFAULT 0,
            active_status INTEGER DEFAULT 0,
            license TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            last_inspected_at DATETIME,
            last_validated_at DATETIME
        )",
        [],
    )?;

    // 25. Model Files Registry
    conn.execute(
        "CREATE TABLE IF NOT EXISTS model_files (
            file_id TEXT PRIMARY KEY,
            model_id TEXT REFERENCES models(model_id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            provider_url TEXT NOT NULL,
            local_path TEXT,
            file_size_bytes INTEGER,
            downloaded_bytes INTEGER DEFAULT 0,
            checksum_sha256 TEXT,
            download_status TEXT DEFAULT 'idle',
            install_status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 26. Model Inspections
    conn.execute(
        "CREATE TABLE IF NOT EXISTS model_inspections (
            inspection_id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_id TEXT UNIQUE REFERENCES models(model_id) ON DELETE CASCADE,
            gguf_version INTEGER,
            architecture TEXT,
            tokenizer_model TEXT,
            context_length INTEGER,
            embedding_length INTEGER,
            block_count INTEGER,
            feed_forward_length INTEGER,
            attention_head_count INTEGER,
            attention_head_count_kv INTEGER,
            rope_dimension_count INTEGER,
            rope_freq_base REAL,
            rope_freq_scale REAL,
            quantization_summary TEXT,
            tensor_count INTEGER,
            supported_tensor_types TEXT,
            unsupported_tensor_types TEXT,
            required_runtime_features TEXT,
            inspection_status TEXT NOT NULL,
            inspection_errors TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // 27. Model Tensor Layout Summaries
    conn.execute(
        "CREATE TABLE IF NOT EXISTS model_tensor_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_id TEXT REFERENCES models(model_id) ON DELETE CASCADE,
            tensor_name TEXT NOT NULL,
            tensor_type TEXT NOT NULL,
            shape TEXT NOT NULL,
            layout_status TEXT DEFAULT 'valid',
            supported INTEGER DEFAULT 1,
            notes TEXT
        )",
        [],
    )?;

    // 28. Model Downloads
    conn.execute(
        "CREATE TABLE IF NOT EXISTS model_downloads (
            download_id TEXT PRIMARY KEY,
            model_id TEXT REFERENCES models(model_id),
            provider TEXT NOT NULL,
            url TEXT NOT NULL,
            destination_path TEXT NOT NULL,
            status TEXT NOT NULL,
            total_bytes INTEGER,
            downloaded_bytes INTEGER DEFAULT 0,
            resume_supported INTEGER DEFAULT 0,
            started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            completed_at DATETIME,
            error_message TEXT
        )",
        [],
    )?;

    // 29. Scoped Model Activations
    conn.execute(
        "CREATE TABLE IF NOT EXISTS model_activations (
            activation_id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_id TEXT REFERENCES models(model_id) ON DELETE CASCADE,
            scope_type TEXT NOT NULL,
            scope_id TEXT NOT NULL,
            activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            activated_by TEXT DEFAULT 'user'
        )",
        [],
    )?;

    // Sprint 10 Migrations: Backlog item enhancement
    let has_dod_backlog: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM pragma_table_info('backlog_items') WHERE name='definition_of_done')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_dod_backlog {
        let _ = conn.execute(
            "ALTER TABLE backlog_items ADD COLUMN definition_of_done TEXT",
            [],
        );
        let _ = conn.execute(
            "ALTER TABLE backlog_items ADD COLUMN required_files TEXT",
            [],
        );
    }

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
