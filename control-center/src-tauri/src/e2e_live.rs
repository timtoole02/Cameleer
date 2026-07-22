//! HARDPAN G4 — live end-to-end proof.
//!
//! This is the Definition-of-Done proof for the agent runtime. Unlike
//! `e2e_persistence` (which drives service functions directly), this test boots
//! a REAL Tauri app (over the mock runtime) with the SAME managed `DbState` used
//! in production, seeds a real kanban card assigned to a real seeded agent, and
//! then `await`s the REAL `task_manager::start_agent_task_run` entry point. That
//! function runs the genuine ReAct loop, which calls a **running camelid
//! inference server** over HTTP for real model output.
//!
//! It then asserts real DB rows (an `agent_runs` row, `agent_run_steps` with
//! non-empty REAL model output), reports the real `tool_invocations`, and — the
//! literal DoD sentence — drops the app (app close), reopens the SAME sqlite
//! file (app reopen), and proves the run + steps + card survived a restart.
//!
//! Gated entirely behind `#[cfg(all(test, feature = "e2e-live"))]`, so normal
//! builds/CI never compile it. It is also `#[ignore]`d (needs a live server),
//! so it only runs when explicitly requested:
//!
//! ```text
//! cargo test -p control-center --features e2e-live -- --ignored --nocapture \
//!     e2e_full_loop_against_live_camelid
//! ```

use crate::storage::{init_db, seed_default_agents, DbState};
use crate::task_manager::start_agent_task_run;
use rusqlite::Connection;
use std::sync::Mutex;
use tauri::Manager;

/// Truncate a string to at most `n` chars for a compact single-line snippet.
fn snippet(s: &str, n: usize) -> String {
    let one_line = s.replace('\n', " ").replace('\r', " ");
    let trimmed = one_line.trim();
    if trimmed.chars().count() <= n {
        trimmed.to_string()
    } else {
        let cut: String = trimmed.chars().take(n).collect();
        format!("{cut}…")
    }
}

#[tokio::test]
#[ignore = "requires a running camelid inference server at the seeded camelid_endpoint (HARDPAN G4 live proof)"]
async fn e2e_full_loop_against_live_camelid() {
    // ---- A file-backed DB so we can close/reopen and prove persistence ------
    let db_file = std::env::temp_dir().join("cameleer_e2e.db");
    let _ = std::fs::remove_file(&db_file);
    let _ = std::fs::remove_file(format!("{}-wal", db_file.display()));
    let _ = std::fs::remove_file(format!("{}-shm", db_file.display()));

    let card_id = "card_e2e_live".to_string();

    // Values captured from session 1 so we can assert them again after reopen.
    let run_id: String;
    let steps_count: i64;
    let first_step_snippet: String;
    let tool_count: i64;
    let mut commands_run: Vec<String> = Vec::new();
    let mut files_created: Vec<String> = Vec::new();
    let mut tool_statuses: Vec<String> = Vec::new();
    let card_status: String;
    let validation_status: String;
    let work_receipt_id: Option<String>;
    let run_state: String;
    let run_error: Option<String>;
    let step_types: Vec<(String, i64)>;

    // ======================= Session 1: real app run ========================
    {
        // Seed the same schema + agents the real app boots with.
        let conn = Connection::open(&db_file).expect("open file-backed db");
        init_db(&conn).expect("init schema");
        seed_default_agents(&conn).expect("seed default agents");

        // The seeded agents carry model_name = 'camelid-default', which
        // start_agent_task_run explicitly rejects as "no concrete model
        // profile". Pin agent-coder to a concrete model so the run proceeds.
        conn.execute(
            "UPDATE agents SET model_name = ?1 WHERE id = 'agent-coder'",
            ["Llama 3.2 1B Instruct"],
        )
        .expect("pin concrete model on agent-coder");

        // The loop resolves the camelid endpoint from this settings row when the
        // agent's provider == 'camelid'.
        conn.execute(
            "INSERT INTO settings (key, value) VALUES ('camelid_endpoint', 'http://127.0.0.1:8181')
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            [],
        )
        .expect("seed camelid_endpoint");

        // A concrete workspace row (seed_default_agents also inserts 'default',
        // this makes the intent explicit / idempotent).
        conn.execute(
            "INSERT INTO workspaces (id, name, path, active)
             VALUES ('default', 'Cameleer Default Workspace', '/tmp', 1)
             ON CONFLICT(id) DO UPDATE SET active = 1",
            [],
        )
        .expect("seed workspace");

        // A real kanban card assigned to agent-coder, in_progress, with concrete
        // instructions that give the 1B model a chance to emit a tool action.
        conn.execute(
            "INSERT INTO kanban_cards
                (id, workspace_id, title, description, instructions, status, priority,
                 assigned_agent_id, acceptance_criteria)
             VALUES (?1, 'default', ?2, ?3, ?4, 'in_progress', 'high', 'agent-coder', ?5)",
            rusqlite::params![
                card_id,
                "Verify the environment with a shell command",
                "Prove the toolchain works end to end by running a trivial command.",
                "Run the shell command `echo hello` to verify the environment, then complete the task.",
                "The command `echo hello` was executed and returned output containing 'hello'.",
            ],
        )
        .expect("seed kanban card");

        // ---- Build the REAL app over the mock runtime, managing DbState -----
        let app = tauri::test::mock_builder()
            .manage(DbState {
                conn: Mutex::new(conn),
            })
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("build mock tauri app");

        let handle = app.handle().clone();
        let state = app.state::<DbState>();

        // ---- Drive the REAL ReAct loop against the live camelid server ------
        let run = start_agent_task_run(handle, state, card_id.clone())
            .await
            .expect("start_agent_task_run must return Ok against a live server");

        run_id = run.id.clone();
        run_state = run.state.clone();
        run_error = run.error.clone();

        // ---- Assert real DB rows via the managed connection -----------------
        {
            let st = app.state::<DbState>();
            let conn = st.conn.lock().expect("lock managed conn");

            // An agent_runs row exists for THIS card and matches the run id.
            let (runs_for_card, run_task_id): (i64, String) = conn
                .query_row(
                    "SELECT COUNT(*), MAX(task_id) FROM agent_runs WHERE id = ?1",
                    [&run_id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .expect("query agent_runs");
            assert_eq!(runs_for_card, 1, "exactly one agent_runs row for the run");
            assert_eq!(run_task_id, card_id, "agent_runs row is bound to the card");

            // agent_run_steps: >= 1 step with non-empty content (REAL model out).
            steps_count = conn
                .query_row(
                    "SELECT COUNT(*) FROM agent_run_steps WHERE run_id = ?1 AND TRIM(content) <> ''",
                    [&run_id],
                    |r| r.get(0),
                )
                .expect("count agent_run_steps");
            assert!(
                steps_count >= 1,
                "expected >= 1 agent_run_steps with non-empty content (real model output); got {steps_count}. run_state={run_state} run_error={run_error:?}"
            );

            {
                let mut stmt = conn
                    .prepare("SELECT step_type, COUNT(*) FROM agent_run_steps WHERE run_id = ?1 GROUP BY step_type ORDER BY step_type")
                    .expect("prepare step_type breakdown");
                step_types = stmt
                    .query_map([&run_id], |r| Ok((r.get::<_, String>(0)?, r.get::<_, i64>(1)?)))
                    .expect("query step_type breakdown")
                    .filter_map(Result::ok)
                    .collect();
            }

            first_step_snippet = conn
                .query_row(
                    "SELECT content FROM agent_run_steps WHERE run_id = ?1 ORDER BY created_at ASC, rowid ASC LIMIT 1",
                    [&run_id],
                    |r| r.get::<_, String>(0),
                )
                .map(|c| snippet(&c, 200))
                .unwrap_or_default();
            assert!(
                !first_step_snippet.is_empty(),
                "first agent_run_step content must be non-empty (real model output)"
            );

            // tool_invocations for this run: REPORT the count (do NOT require a
            // tool call from the 1B model), and collect the real commands/files.
            tool_count = conn
                .query_row(
                    "SELECT COUNT(*) FROM tool_invocations WHERE run_id = ?1",
                    [&run_id],
                    |r| r.get(0),
                )
                .expect("count tool_invocations");

            let mut stmt = conn
                .prepare("SELECT tool_name, arguments, status FROM tool_invocations WHERE run_id = ?1 ORDER BY created_at ASC")
                .expect("prepare tool_invocations query");
            let rows: Vec<(String, String, String)> = stmt
                .query_map([&run_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
                .expect("query tool_invocations")
                .filter_map(Result::ok)
                .collect();
            for (tool_name, args, status) in rows {
                // Record each invocation's real tool + status so the receipt is
                // honest about success vs a sandbox-blocked/error attempt.
                tool_statuses.push(format!("{tool_name}:{status}"));
                let parsed: serde_json::Value =
                    serde_json::from_str(&args).unwrap_or(serde_json::Value::Null);
                // Only count commands/files from SUCCESSFUL invocations.
                if status != "success" {
                    continue;
                }
                match tool_name.as_str() {
                    "command.run" | "repo.search" => {
                        if let Some(cmd) = parsed.get("command").and_then(|v| v.as_str()) {
                            if !cmd.is_empty() {
                                commands_run.push(cmd.to_string());
                            }
                        }
                    }
                    "file.write" => {
                        if let Some(p) = parsed.get("path").and_then(|v| v.as_str()) {
                            if !p.is_empty() {
                                files_created.push(p.to_string());
                            }
                        }
                    }
                    _ => {}
                }
            }

            // Final card state the loop routed the card to.
            let (cs, vs, wr): (String, String, Option<String>) = conn
                .query_row(
                    "SELECT status, validation_status, work_receipt_id FROM kanban_cards WHERE id = ?1",
                    [&card_id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                )
                .expect("query card final state");
            card_status = cs;
            validation_status = vs;
            work_receipt_id = wr;
        }
    } // <-- app (and its managed DbState/Connection) dropped == app close

    // ======= Session 2: reopen the SAME file (app restart) ==================
    let persisted_after_reopen = {
        let conn = Connection::open(&db_file).expect("reopen file-backed db");

        // The agent_runs row survived the restart with the same id + state.
        let (reopened_runs, reopened_state, reopened_task): (i64, String, String) = conn
            .query_row(
                "SELECT COUNT(*), MAX(state), MAX(task_id) FROM agent_runs WHERE id = ?1",
                [&run_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .expect("query agent_runs after reopen");
        assert_eq!(reopened_runs, 1, "agent_runs row must persist across restart");
        assert_eq!(
            reopened_state, run_state,
            "agent_runs state must be unchanged after restart"
        );
        assert_eq!(
            reopened_task, card_id,
            "agent_runs task binding must persist across restart"
        );

        // The steps survived with the same count.
        let reopened_steps: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM agent_run_steps WHERE run_id = ?1 AND TRIM(content) <> ''",
                [&run_id],
                |r| r.get(0),
            )
            .expect("count agent_run_steps after reopen");
        assert_eq!(
            reopened_steps, steps_count,
            "agent_run_steps must persist across restart with the same count"
        );

        // The card survived with the same routed status.
        let (reopened_status, reopened_validation): (String, String) = conn
            .query_row(
                "SELECT status, validation_status FROM kanban_cards WHERE id = ?1",
                [&card_id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .expect("query card after reopen");
        assert_eq!(
            reopened_status, card_status,
            "card status must persist across restart"
        );
        assert_eq!(
            reopened_validation, validation_status,
            "card validation_status must persist across restart"
        );

        true
    };
    assert!(persisted_after_reopen, "DoD: state must survive close+reopen");

    // Clean up the temp DB + sqlite side files.
    let _ = std::fs::remove_file(&db_file);
    let _ = std::fs::remove_file(format!("{}-wal", db_file.display()));
    let _ = std::fs::remove_file(format!("{}-shm", db_file.display()));

    // ---- Single-line JSON summary (visible under --nocapture) --------------
    let summary = serde_json::json!({
        "run_id": run_id,
        "run_state": run_state,
        "run_error": run_error,
        "agent_run_steps": steps_count,
        "step_types": step_types.iter().map(|(t, c)| serde_json::json!({ "type": t, "count": c })).collect::<Vec<_>>(),
        "first_step_snippet": first_step_snippet,
        "tool_invocations": tool_count,
        "tool_statuses": tool_statuses,
        "commands_run": commands_run,
        "files_created": files_created,
        "card_status": card_status,
        "validation_status": validation_status,
        "work_receipt_id": work_receipt_id,
        "persisted_after_reopen": persisted_after_reopen,
    });
    println!("HARDPAN_G4_SUMMARY {}", serde_json::to_string(&summary).unwrap());
}

/// Deterministic proof (NO model) that the tool-execution RECORD path works end
/// to end: a real `command.run` of `echo hello` is routed through the command
/// guard, spawns the process, captures stdout, and persists a `tool_invocations`
/// row with `status='success'` and the command in its arguments. This makes the
/// DoD "real tool execution records" claim independent of the (nondeterministic)
/// 1B model's willingness to emit a tool action in the live-loop test above.
/// Needs the mock runtime (hence the `e2e-live` feature) but not a live server.
#[tokio::test]
async fn e2e_tool_execution_records_a_real_command() {
    use crate::agent_contracts::load_contract;
    use crate::agent_tool_controller::execute_tool;
    use crate::chat_service::parse_agent_action;

    let conn = Connection::open_in_memory().unwrap();
    init_db(&conn).unwrap();
    seed_default_agents(&conn).unwrap();
    conn.execute(
        "INSERT OR IGNORE INTO workspaces (id,name,path,active) VALUES ('default','WS','/tmp',1)",
        [],
    )
    .unwrap();
    let card_id = "card_tool_exec";
    let run_id = "run_tool_exec";
    // A card + agent_run so the tool_invocations FKs (task_id, run_id) are satisfied.
    conn.execute(
        "INSERT INTO kanban_cards (id, workspace_id, title, status, assigned_agent_id)
         VALUES (?1,'default','Run echo','in_progress','agent-coder')",
        [card_id],
    )
    .unwrap();
    conn.execute(
        "INSERT INTO agent_runs (id, agent_id, task_id, state) VALUES (?1,'agent-coder',?2,'running')",
        rusqlite::params![run_id, card_id],
    )
    .unwrap();

    // Build a real command.run action via the PRODUCTION parser (no hand-rolled
    // struct), then bind it to the seeded card.
    let json = r#"{"summary":"run echo","plan":[],"next_action":{"type":"command.run","target":null,"input":"echo hello","dry_run":false},"confidence":1.0,"blockers":[],"done_criteria":[]}"#;
    let mut action = parse_agent_action(json).expect("parse command.run");
    action.card_id = Some(card_id.to_string());
    action.task_id = Some(card_id.to_string());
    assert_eq!(action.action_type, "command.run");

    // The default contract (fixed in G4 to use normalized action names) permits command.run.
    let contract = load_contract("agent-coder", "dev", &conn).expect("contract");
    assert!(
        contract.allowed_actions.iter().any(|a| a == "command.run"),
        "default contract must permit command.run"
    );

    let app = tauri::test::mock_builder()
        .manage(DbState {
            conn: Mutex::new(conn),
        })
        .build(tauri::test::mock_context(tauri::test::noop_assets()))
        .expect("mock app");
    let handle = app.handle().clone();

    let out = execute_tool(
        &handle,
        "agent-coder",
        "session_tool",
        &contract,
        &action,
        Some(run_id),
    )
    .expect("execute_tool ok");
    assert!(
        out.contains("hello"),
        "command output should contain 'hello', got: {out}"
    );

    // A real tool_invocations row persisted, success, with the command recorded.
    let st = app.state::<DbState>();
    let conn = st.conn.lock().unwrap();
    let count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM tool_invocations WHERE run_id = ?1",
            [run_id],
            |r| r.get(0),
        )
        .unwrap();
    assert_eq!(count, 1, "exactly one tool_invocation recorded");
    let (tool_name, status, args): (String, String, String) = conn
        .query_row(
            "SELECT tool_name, status, arguments FROM tool_invocations WHERE run_id = ?1",
            [run_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .unwrap();
    assert_eq!(tool_name, "command.run");
    assert_eq!(status, "success", "the echo command must record success");
    assert!(
        args.contains("echo hello"),
        "arguments must record the command"
    );
    println!(
        "HARDPAN_G4_TOOL_EXEC {{\"tool_invocations\":{count},\"tool_name\":\"{tool_name}\",\"status\":\"{status}\",\"output_has_hello\":true}}"
    );
}
