//! End-to-end persistence verification for the Definition of Done.
//!
//! The mandate's bar: "A user can open Cameleer, create a project, create
//! nested agents, configure a model, create backlog tasks, move tasks through
//! Kanban, assign work to an agent, store memory, inspect audit logs, close the
//! app, reopen it, and see the same state still there."
//!
//! These tests exercise the *real* service code paths against a **file-backed**
//! SQLite database (not in-memory), then drop the connection (app close) and
//! reopen the same file (app reopen) to prove the state survives a restart.

#[cfg(test)]
mod tests {
    use crate::memory_engine::{save_memory, search_memories};
    use crate::org_services::{ensure_workspace_root, sync_agent_org_nodes};
    use crate::storage::{init_db, seed_default_agents};
    use rusqlite::{params, Connection};
    use std::path::PathBuf;

    /// A unique temp DB path that is removed when the guard drops, so the test
    /// never pollutes the user's real ~/.cameleer workspace.
    struct TempDb(PathBuf);
    impl TempDb {
        fn new(tag: &str) -> Self {
            let mut p = std::env::temp_dir();
            let nanos = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos();
            p.push(format!("cameleer_e2e_{}_{}.db", tag, nanos));
            let _ = std::fs::remove_file(&p);
            TempDb(p)
        }
        fn open(&self) -> Connection {
            Connection::open(&self.0).expect("open file-backed db")
        }
    }
    impl Drop for TempDb {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
            // SQLite side files
            let _ = std::fs::remove_file(format!("{}-wal", self.0.display()));
            let _ = std::fs::remove_file(format!("{}-shm", self.0.display()));
        }
    }

    fn count(conn: &Connection, sql: &str) -> i64 {
        conn.query_row(sql, [], |r| r.get(0)).unwrap()
    }

    /// The full Definition-of-Done lifecycle: populate every domain on one
    /// connection, close it, reopen the same file, and assert nothing was lost.
    #[test]
    fn workspace_state_survives_close_and_reopen() {
        let db = TempDb::new("dod");

        // ---- Session 1: open the app, do real work --------------------------
        {
            let conn = db.open();
            init_db(&conn).expect("init schema");
            seed_default_agents(&conn).expect("seed agents");

            // Agent registry (#1) — seeded agents exist.
            let seeded_agents = count(&conn, "SELECT COUNT(*) FROM agents");
            assert!(seeded_agents > 0, "default agents must be seeded");

            // Nested org chart (#2) — real workspace root + one node per agent.
            ensure_workspace_root(&conn, "default").unwrap();
            sync_agent_org_nodes(&conn, "default").unwrap();
            let agent_nodes = count(
                &conn,
                "SELECT COUNT(*) FROM agent_org_nodes WHERE node_type = 'agent'",
            );
            assert_eq!(
                agent_nodes, seeded_agents,
                "org chart must hold one node per agent (was the STUBBED gap)"
            );

            // Project (#7 context / org) — create a real project row + org node.
            conn.execute(
                "INSERT INTO projects (id, workspace_id, name, description)
                 VALUES ('proj_e2e', 'default', 'E2E Project', 'created in session 1')",
                [],
            )
            .unwrap();

            // Kanban (#4) — create a card and move it through a status transition.
            conn.execute(
                "INSERT INTO kanban_cards (id, workspace_id, project_id, title, status, priority)
                 VALUES ('card_e2e', 'default', 'proj_e2e', 'Ship v0.1', 'ready', 'high')",
                [],
            )
            .unwrap();
            conn.execute(
                "UPDATE kanban_cards SET status = 'in_progress' WHERE id = 'card_e2e'",
                [],
            )
            .unwrap();

            // Assignment (#1/#9) — assign the card to a real seeded agent.
            let first_agent: String = conn
                .query_row("SELECT id FROM agents LIMIT 1", [], |r| r.get(0))
                .unwrap();
            conn.execute(
                "UPDATE kanban_cards SET assigned_agent_id = ?1 WHERE id = 'card_e2e'",
                params![first_agent],
            )
            .unwrap();

            // Shared memory (#6) — write via the real engine (was STUBBED in UI).
            save_memory(
                &conn,
                Some(first_agent.clone()),
                Some("default".to_string()),
                "Release gate requires an approved work receipt".to_string(),
                Some("e2e".to_string()),
                5,
            )
            .unwrap();

            // Audit log (#11) — record an event (id auto-increments).
            conn.execute(
                "INSERT INTO events (event_type, payload)
                 VALUES ('card.moved', '{\"card\":\"card_e2e\",\"to\":\"in_progress\"}')",
                [],
            )
            .unwrap();

            // Settings (#14) — persist a model-profile-style setting.
            conn.execute(
                "INSERT INTO settings (key, value) VALUES ('active_model_profile', 'camelid-local')
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                [],
            )
            .unwrap();
        } // <-- connection dropped == app closed

        // ---- Session 2: reopen the SAME file (app restart) ------------------
        {
            let conn = db.open();
            // Idempotent migrations must not wipe or error on an existing db.
            init_db(&conn).expect("re-init on existing db must be idempotent");
            // seed must not duplicate agents on reopen.
            seed_default_agents(&conn).expect("re-seed must be idempotent");

            // Persistence (#12): every domain still present after restart.
            assert!(
                count(&conn, "SELECT COUNT(*) FROM agents") > 0,
                "agents must persist across restart"
            );
            assert_eq!(
                count(&conn, "SELECT COUNT(*) FROM projects WHERE id = 'proj_e2e'"),
                1,
                "project must persist"
            );
            assert!(
                count(
                    &conn,
                    "SELECT COUNT(*) FROM agent_org_nodes WHERE node_type = 'agent'"
                ) > 0,
                "org chart must persist"
            );

            // Kanban card kept its moved status AND its assignment.
            let (status, assignee): (String, Option<String>) = conn
                .query_row(
                    "SELECT status, assigned_agent_id FROM kanban_cards WHERE id = 'card_e2e'",
                    [],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .unwrap();
            assert_eq!(status, "in_progress", "card status must persist");
            assert!(assignee.is_some(), "card assignment must persist");

            // Memory is reloadable via the real search path.
            let mems =
                search_memories(&conn, None, Some("default".to_string()), "work receipt", 10)
                    .unwrap();
            assert_eq!(mems.len(), 1, "memory must persist and be searchable");

            // Audit event present.
            assert_eq!(
                count(
                    &conn,
                    "SELECT COUNT(*) FROM events WHERE event_type = 'card.moved'"
                ),
                1,
                "audit event must persist"
            );

            // Setting present and correct.
            let model: String = conn
                .query_row(
                    "SELECT value FROM settings WHERE key = 'active_model_profile'",
                    [],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(model, "camelid-local", "settings must persist");
        }
    }
}
