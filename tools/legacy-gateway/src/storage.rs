use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub id: i64,
    pub session_id: String,
    pub role: String,
    pub content: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentProfile {
    pub id: String,
    pub name: String,
    pub emoji: String,
    pub persona: String,
    pub model_provider: String,
    pub model_name: String,
    pub is_autonomous: bool,
    pub autonomous_goal: Option<String>,
    pub status: String,
}

#[derive(Clone)]
pub struct Storage {
    conn: Arc<Mutex<Connection>>,
}

impl Storage {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let config_dir = crate::config::get_config_dir();
        let db_path = config_dir.join("cameleer.db");
        
        let conn = Connection::open(db_path)?;
        let storage = Self { conn: Arc::new(Mutex::new(conn)) };
        storage.init_db()?;
        Ok(storage)
    }

    fn init_db(&self) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        
        // Initialize messages table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Initialize audit logs table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                command TEXT NOT NULL,
                status TEXT NOT NULL, -- 'pending', 'approved', 'denied', 'success', 'failed'
                output TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        // Initialize key-value storage for skills
        conn.execute(
            "CREATE TABLE IF NOT EXISTS kv_store (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        // Initialize agents table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                emoji TEXT NOT NULL,
                persona TEXT NOT NULL,
                model_provider TEXT NOT NULL,
                model_name TEXT NOT NULL,
                is_autonomous INTEGER DEFAULT 0,
                autonomous_goal TEXT,
                status TEXT DEFAULT 'idle'
            )",
            [],
        )?;

        // Seed default agents if empty
        let count: i64 = conn.query_row("SELECT COUNT(*) FROM agents", [], |row| row.get(0))?;
        if count == 0 {
            let default_agents = vec![
                ("agent-coder", "Software Engineer", "💻", 
                 "You are the Lead Software Engineer agent. You excel at writing high-quality, bug-free, and highly optimized code, troubleshooting errors, and creating automation scripts. Whitelist commands: ls, cat, echo, curl, grep, python3, node, cargo.",
                 "camelid", "Llama-3.2-3B-Instruct-Q8_0.gguf"),
                ("agent-analyst", "Data Analyst", "📊",
                 "You are the Data Analyst agent. You specialize in system auditing, resource analytics, files checking, and structural parsing. Whitelist commands: df, du, ps, grep, cat, ls, curl.",
                 "camelid", "Llama-3.2-3B-Instruct-Q8_0.gguf"),
                ("agent-writer", "Creative Writer", "✍️",
                 "You are the Creative Writer and Documentation agent. You excel at authoring comprehensive markdown documents, summaries, and structural walkthroughs.",
                 "camelid", "Llama-3.2-3B-Instruct-Q8_0.gguf"),
                ("agent-sentry", "Security Officer", "🛡️",
                 "You are the Security Sentry agent. Your core directive is auditing sandboxed commands, checking whitelist files, and maintaining absolute host system integrity. Whitelist commands: pwd, date, ls, cat, grep.",
                 "camelid", "Llama-3.2-3B-Instruct-Q8_0.gguf")
            ];

            for (id, name, emoji, persona, provider, model) in default_agents {
                conn.execute(
                    "INSERT INTO agents (id, name, emoji, persona, model_provider, model_name, is_autonomous, autonomous_goal, status) \
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, NULL, 'idle')",
                    params![id, name, emoji, persona, provider, model],
                )?;
            }
        }

        Ok(())
    }

    // Message interactions
    pub fn save_message(&self, session_id: &str, role: &str, content: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO messages (session_id, role, content) VALUES (?1, ?2, ?3)",
            params![session_id, role, content],
        )?;
        Ok(())
    }

    pub fn get_messages(&self, session_id: &str, limit: usize) -> Result<Vec<ChatMessage>, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, session_id, role, content, timestamp 
             FROM messages 
             WHERE session_id = ?1 
             ORDER BY id ASC 
             LIMIT ?2"
        )?;
        
        let message_iter = stmt.query_map(params![session_id, limit as i64], |row| {
            Ok(ChatMessage {
                id: row.get(0)?,
                session_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })?;

        let mut messages = Vec::new();
        for msg in message_iter {
            messages.push(msg?);
        }
        Ok(messages)
    }

    pub fn clear_session(&self, session_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM messages WHERE session_id = ?1", params![session_id])?;
        Ok(())
    }

    // Audit logs
    pub fn log_command(&self, command: &str, status: &str, output: Option<&str>) -> Result<i64, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO audit_log (command, status, output) VALUES (?1, ?2, ?3)",
            params![command, status, output],
        )?;
        let id = conn.last_insert_rowid();
        Ok(id)
    }

    pub fn update_command_log(&self, id: i64, status: &str, output: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE audit_log SET status = ?1, output = ?2 WHERE id = ?3",
            params![status, output, id],
        )?;
        Ok(())
    }

    // Key-value store
    #[allow(dead_code)]
    pub fn kv_set(&self, key: &str, value: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?1, ?2)",
            params![key, value],
        )?;
        Ok(())
    }

    #[allow(dead_code)]
    pub fn kv_get(&self, key: &str) -> Result<Option<String>, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT value FROM kv_store WHERE key = ?1")?;
        let mut rows = stmt.query(params![key])?;
        if let Some(row) = rows.next()? {
            let value: String = row.get(0)?;
            Ok(Some(value))
        } else {
            Ok(None)
        }
    }

    // Agent storage helpers
    pub fn save_agent(&self, profile: &AgentProfile) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT OR REPLACE INTO agents (id, name, emoji, persona, model_provider, model_name, is_autonomous, autonomous_goal, status) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                profile.id,
                profile.name,
                profile.emoji,
                profile.persona,
                profile.model_provider,
                profile.model_name,
                if profile.is_autonomous { 1 } else { 0 },
                profile.autonomous_goal,
                profile.status
            ],
        )?;
        Ok(())
    }

    pub fn get_agents(&self) -> Result<Vec<AgentProfile>, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, emoji, persona, model_provider, model_name, is_autonomous, autonomous_goal, status FROM agents"
        )?;
        let agent_iter = stmt.query_map([], |row| {
            let is_auto: i32 = row.get(6)?;
            Ok(AgentProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                emoji: row.get(2)?,
                persona: row.get(3)?,
                model_provider: row.get(4)?,
                model_name: row.get(5)?,
                is_autonomous: is_auto != 0,
                autonomous_goal: row.get(7)?,
                status: row.get(8)?,
            })
        })?;

        let mut list = Vec::new();
        for item in agent_iter {
            list.push(item?);
        }
        Ok(list)
    }

    pub fn get_agent(&self, id: &str) -> Result<Option<AgentProfile>, Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, emoji, persona, model_provider, model_name, is_autonomous, autonomous_goal, status \
             FROM agents WHERE id = ?1"
        )?;
        let mut rows = stmt.query(params![id])?;
        if let Some(row) = rows.next()? {
            let is_auto: i32 = row.get(6)?;
            Ok(Some(AgentProfile {
                id: row.get(0)?,
                name: row.get(1)?,
                emoji: row.get(2)?,
                persona: row.get(3)?,
                model_provider: row.get(4)?,
                model_name: row.get(5)?,
                is_autonomous: is_auto != 0,
                autonomous_goal: row.get(7)?,
                status: row.get(8)?,
            }))
        } else {
            Ok(None)
        }
    }

    pub fn update_agent_status(&self, id: &str, status: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute("UPDATE agents SET status = ?1 WHERE id = ?2", params![status, id])?;
        Ok(())
    }

    pub fn update_agent_model(&self, id: &str, provider: &str, model: &str) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE agents SET model_provider = ?1, model_name = ?2 WHERE id = ?3",
            params![provider, model, id],
        )?;
        Ok(())
    }

    pub fn update_agent_autonomous(&self, id: &str, is_autonomous: bool, goal: Option<&str>) -> Result<(), Box<dyn std::error::Error>> {
        let conn = self.conn.lock().unwrap();
        let is_auto = if is_autonomous { 1 } else { 0 };
        conn.execute(
            "UPDATE agents SET is_autonomous = ?1, autonomous_goal = ?2 WHERE id = ?3",
            params![is_auto, goal, id],
        )?;
        Ok(())
    }
}
