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
            last_heartbeat TEXT
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

    // 4. Tasks & Objective Registry
    conn.execute(
        "CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            owner_id TEXT REFERENCES agents(id),
            status TEXT DEFAULT 'pending',
            priority TEXT DEFAULT 'medium',
            parent_id TEXT REFERENCES tasks(id),
            evidence_path TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    Ok(())
}
