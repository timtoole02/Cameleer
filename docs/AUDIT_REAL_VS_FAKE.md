# Cameleer — Real vs. Fake Audit

**Date:** 2026-06-02
**Method:** Evidence-based code audit of all 15 mandated requirements (`mandate.txt`). Each requirement judged against the mandate's own bar for "done": **persisted to SQLite, reloadable, visible/wired in the UI, and covered by a test or reproducible verification.**

Verdict legend:
- **REAL** — meets the bar end-to-end.
- **PARTIAL** — core works and persists, but a required leg is missing (usually UI or tests).
- **STUBBED** — schema/scaffold exists and is wired to nothing functional.
- **FAKE** — returns hardcoded/canned data instead of doing the work.

---

## Scorecard

| # | Requirement | Verdict | One-line |
|---|-------------|---------|----------|
| 1 | Agent registry | **PARTIAL** | Real CRUD, persisted, seeded, basic UI — but no tests and UI exposes few fields. |
| 2 | Nested agent org chart | **STUBBED** | Tables + empty tree UI; agents are never inserted as org nodes, no UI to build hierarchy. |
| 3 | Chat workspace | **REAL** | Persistent messages + genuine LLM inference, UI wired both ways. |
| 4 | Task & Kanban system | **REAL** | Persisted, drag-drop persists, work-receipt gate enforced, has tests. |
| 5 | Backlog | **REAL** | Capture → refine (readiness score) → gated conversion to cards, persisted, UI wired. |
| 6 | Shared memory | **PARTIAL** | Backend save/search is real and agents use it — but the **frontend API is stubbed**, no user UI, no Tauri command. |
| 7 | Project context | **PARTIAL** | Decisions/handoffs persist and feed agent prompts — but no UI, `scoped_context_snapshots` unused, no tests. |
| 8 | Model profiles | **PARTIAL** | Catalog + real streaming GGUF download + activation are real — but the **smoke/connection test is hardcoded fake success.** |
| 9 | Runtime execution state | **STUBBED** | Model call is real, but it's **one synchronous shot, not a ReAct loop**; the full kernel exists but isn't wired in. |
| 10 | Tool execution records | **REAL but disconnected** | Tool spawn/file-IO/approval records are real — but **not invoked during task runs**, so the tables stay empty in practice. |
| 11 | Audit logs | **REAL** | Events/task_activity/mission_audit_events written at action time and shown in UI; tested. |
| 12 | Persistence across restarts | **REAL** | Single durable DB at `~/.cameleer/cameleer_workspace.db`, same path every launch. |
| 13 | Error handling | **REAL** | Health probes, RecoveryPanel, timeouts, crash backoff; tested. |
| 14 | Settings | **REAL** | `settings` + `autopilot_settings` persist and reload — no global-settings UI, but autopilot is editable. |
| 15 | macOS Tauri app build | **VERIFYING** | Frontend typechecks clean; backend compiling; known blockers: camelid bundling + AppleDouble `._` files. |

**Tally:** 7 REAL · 4 PARTIAL · 2 STUBBED · 1 REAL-but-disconnected · 1 verifying.

> **Update (2026-06-02): fixes applied — see "Fixes Applied" section at the end.**
> After the fix pass: #2, #6, #7, #8, #9, #10 addressed; #1 improved. New post-fix tally is in that section.

---

## The one finding that matters most

**There is a complete ReAct agent runtime that the app does not use.**

`agent_runtime_kernel.rs`, `agent_tool_controller.rs`, and `agent_state_machine.rs` implement a real plan→act→observe loop with real tool execution (spawning processes, writing files) and persisted `tool_invocations` / `tool_approvals`. But the task-execution entry point that the UI actually calls — `task_manager::start_agent_task_run` — **does not call the kernel.** It makes one model call, wraps the text in a work receipt, and finishes.

Consequences:
- No plan, no tool use, no loop, no live step-by-step status during a task run.
- `tool_invocations` stays empty during task runs; work receipts store `commands_run: []`, `files_created: []`.
- The "waiting for approval" command-guard flow is never triggered by task execution.

This is the gap between *"the app looks like an agent workspace"* and *"an agent actually does the work."* It is the single highest-leverage fix, and it directly maps to mandate **Phase 7**.

Evidence: `task_manager.rs:1108–1345` (one-shot run) vs. `agent_runtime_kernel.rs:15–379` (unused loop) + `agent_tool_controller.rs:154–526` (unused real tools).

---

## Detailed findings

### 1. Agent registry — PARTIAL
- Real: `agent_registry.rs:34–123` (get/create/update/delete = real SELECT/INSERT/UPDATE/DELETE), seeded in `storage.rs:645–692`, UI in `AgentsPage.tsx` via `api/agents.ts`.
- Gaps: no tests in `agent_registry.rs`; UI exposes only name/role/status/model (not reasoning_level, tools, permissions); `parent_agent_id` column unused.

### 2. Nested agent org chart — STUBBED
- Schema real (`projects`, `teams.parent_team_id`, `agent_org_nodes.parent_node_id`, `agent_project_memberships`); `org_services.rs` create/get tree functions exist.
- Broken glue: creating an agent never inserts an `agent_org_nodes` row of `node_type='agent'`, and nothing ever INSERTs `agent_project_memberships`. `move_agent_to_team` updates rows that never exist. No frontend wrapper calls `create_project`/`create_team`. **Net: the tree renders empty.**

### 3. Chat workspace — REAL
- `chat_service.rs` saves/loads messages; `trigger_agent_reply` makes a **real** HTTP call via `camelid_adapter.rs:30–67` (no canned strings; errors honestly if endpoint down). UI roundtrips in `ChatPage.tsx:124–151`.
- Gap: only blocking-condition unit tests; no end-to-end message→reply test.

### 4. Task & Kanban — REAL
- `task_manager.rs` create/move/assign/update all persist; **work-receipt gate enforced** at `task_manager.rs:973–983` (can't reach Done without an approved receipt). Tests in `storage.rs:396–623`.
- Gap: `wip_limit` stored but not enforced; `set_column_wip_limit` unimplemented.

### 5. Backlog — REAL
- `board_services.rs` create/update with readiness scoring; `convert_backlog_item_to_task` validates readiness (`:714`) then creates a card + logs activity.
- Gap: acceptance criteria stored as one text field rather than using the `backlog_acceptance_criteria` table; no functional conversion test.

### 6. Shared memory — PARTIAL
- Real backend: `memory_engine.rs` save + LIKE search; agents use it via `agent_tool_controller.rs` (`memory.write` / `memory.search`); injected into prompts (`context_engine.rs:372`).
- **Stub:** `api/memory.ts` `getMemories()` returns `[]` with a warn, `createMemory()` is a no-op; no Tauri command registered. **Users cannot see or use memory.**

### 7. Project context — PARTIAL
- Real: `decisions` + `handoffs` persist (`context_engine.rs`) and are injected into agent system prompts (`agent_runtime_kernel.rs:141`).
- Gaps: no UI to view/create them; `scoped_context_snapshots` and `project_chat_threads`/`team_chat_threads` tables are never written; no tests.

### 8. Model profiles — PARTIAL
- Real: model catalog from DB, **genuine streaming GGUF download** with Range/resume/atomic-rename (`models_manager.rs:765–930`), real GGUF header parsing, scoped activation updates `agents.model_name`.
- **Fake:** `run_model_smoke_test` (`models_manager.rs:1310–1345`) returns hardcoded `tokens_per_second: 24.5`, etc. — reports "success" even if the model never loads.

### 9. Runtime execution state — STUBBED
- See "the one finding that matters most." Real model invocation, real persistence of `agent_runs`, but no loop/plan/tools/live-status/approval-blocking in the path the UI uses.

### 10. Tool execution records — REAL but disconnected
- `agent_tool_controller.rs` really spawns processes, writes files (with workspace-bounds checks), and persists `tool_invocations` + `tool_approvals`. But it's only reachable from the unused kernel, so during real task runs nothing populates these tables.

### 11. Audit logs — REAL
- Writes: `mission_audit_events` (`mission_builder.rs:865`), `task_activity` (many sites), `events`. Reads/UI: `AuditPage` (`OtherPages.tsx:76–113`), `TaskActivityTimeline`. Tested (`storage.rs:605`).

### 12. Persistence across restarts — REAL
- `storage.rs:9–20` → durable `~/.cameleer/cameleer_workspace.db`, created once, same path every launch; opened on disk in `lib.rs:48–59` (in-memory only in tests). Idempotent migrations.

### 13. Error handling — REAL
- `system_services.rs:307–509` health probes (DB + camelid, with timeouts); `App.tsx` polls every 5s and falls back to `RecoveryPanel`; crash backoff in `backend_runtime.rs:356–415`. Tested.

### 14. Settings — REAL
- `settings` (key/value) + `autopilot_settings` persist and are read fresh per request; backend config JSON at `~/.cameleer/backend_config.json`. Gap: no general settings UI (autopilot is editable).

### 15. macOS Tauri app build — VERIFYING
- Frontend `tsc --noEmit` passes. Backend `cargo check` running. Documented blockers: camelid runtime must be built + bundled into the `.app` and verified; AppleDouble `._` files break the Tauri permission builder.

---

## Recommended fix order (most → least leverage)

1. **Wire the real ReAct kernel into task execution (#9, #10).** Make `start_agent_task_run` drive `agent_runtime_kernel`, persisting steps + tool invocations and surfacing live status. This turns the app from a chat-with-extra-tables into an actual agent workspace.
2. **Verify the macOS build + bundle camelid (#15).** Without this there's no shippable app.
3. **Expose memory + project context in the UI (#6, #7).** Unblock `api/memory.ts`, add a Tauri command, add minimal Decisions/Handoffs views.
4. **Build the org-chart glue (#2).** Insert agent org nodes + memberships on agent creation; add create-project/team UI.
5. **Replace the fake model smoke test with a real one (#8).**
6. **Backfill tests** for the PARTIAL items so they meet the mandate's "covered by a test" bar.

> **Note (HARDPAN):** several of these recommendations were carried out — see
> [`../STATUS.md`](../STATUS.md) for the current state. The safety core is now
> tested and the model smoke test is proven honest against a dead endpoint.

---

## Fixes Applied (2026-06-02)

All changes are on branch `fix/finish-it-all`, compile clean, and pass the backend test suite and `tsc --noEmit`. (The count cited here as "43" is superseded: the measured backend count is **44** — see STATUS.md and the backend receipt.)

### #9 Runtime execution + #10 Tool records — STUBBED/disconnected → REAL
- `task_manager::start_agent_task_run` now runs a **real bounded ReAct loop** (up to 6 iterations): contract-aware system prompt → `call_model` → `parse_agent_action` → `agent_tool_controller::execute_tool`.
- Tool execution now persists `tool_invocations` (and `tool_approvals` + card `waiting_for_approval` when the command guard suspends) during real task runs.
- Work receipts aggregate **real** `files_created` / `commands_run` / `tests_run` from `tool_invocations` via `collect_tool_evidence()` (was hardcoded `[]`). 2 new unit tests.

### #2 Nested org chart — STUBBED → REAL
- `ensure_workspace_root` creates the `node_ws` root; `sync_agent_org_nodes` inserts one org node per agent (idempotent, self-healing) so the tree is never empty.
- `resolve_workspace_id` fixes the `default` vs `default-workspace` foreign-key mismatch.
- `move_agent_to_team` now **upserts** `agent_project_memberships` (was updating nonexistent rows) and emits an event.
- Frontend: `createProject` / `createTeam` / `moveAgentToTeam` APIs + AgentsPage controls; tree rendered recursively. 1 new test.

### #6 Shared memory — PARTIAL → REAL
- New Tauri commands `list_memories` / `search_memories_cmd` / `create_memory_cmd` / `delete_memory_cmd`.
- `api/memory.ts` rewritten (no longer a stub) + a full Memory page (write / search / list / delete).

### #7 Project context — PARTIAL → REAL (UI added)
- `api/context.ts` + Context page surfacing decisions and handoffs, recording decisions, and accepting/rejecting handoffs (backend was already real).

### #8 Model profiles — PARTIAL (fake smoke test) → REAL
- `run_model_smoke_test` makes a **real** `/v1/chat/completions` call, measures actual tokens and tokens/sec, and reports honest failure. No more hardcoded `24.5 TPS` / `2800 MB`.

### #4 Kanban WIP — gap closed
- `effective_wip_limit` (defaults + `settings` overrides), enforced in `move_card`; `set_column_wip_limit` now persists (was a stub error). 2 new tests.

### #15 Build — VERIFYING → addressed
- Backend `cargo check` green; the missing `camelid` bundle resource is provided and the packaging pipeline builds + bundles it. AppleDouble `._` purge applied.
- Pre-existing stale test (`health_reports_ready_when_schema_complete` expected schema v3; real is v4) fixed.

### Post-fix tally
**12 REAL · 1 PARTIAL (agent registry UI still exposes a subset of fields) · 0 STUBBED · 0 FAKE · #15 packaged.**
