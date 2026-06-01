# Kanban and Backlog Command Matrix

This matrix maps the real persisted command surface used by the Backlog and Kanban end-to-end flow on `fix/kanban-backlog-end-to-end`.

| Feature | Frontend API function | Tauri command | Rust function | DB table touched | Implemented | Tested | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| List backlog items | `getBacklogSnapshot` in `control-center/src/api/backlog.ts` | `get_backlog_snapshot` | `board_services::get_backlog_snapshot` | `backlog_items`, `backlog_acceptance_criteria` | Yes | Yes | Used by `BacklogPage` load/refresh. |
| Create backlog item | `createBacklogItem` | `create_backlog_item` | `board_services::create_backlog_item` | `backlog_items`, `backlog_activity` | Yes | Yes | Persists title, details, type, priority, agent, criteria, score. |
| Update/refine backlog item | `updateBacklogItem` | `update_backlog_item` | `board_services::update_backlog_item` | `backlog_items`, `backlog_activity` | Yes | Yes | Recalculates readiness score after edits. |
| Convert backlog item to Kanban task | `convertBacklogItemToCard` | `convert_backlog_item_to_card` | `board_services::convert_backlog_item_to_card` -> `convert_backlog_item_to_task_with_conn` | `backlog_items`, `kanban_cards`, `task_activity`, `backlog_activity` | Yes | Yes | Blocks incomplete items, copies instructions/criteria/priority/type/agent, idempotently returns the existing card if converted. |
| List board columns | `listBoardColumns` in `control-center/src/api/kanban.ts` | `list_board_columns` | `board_services::list_board_columns` | none | Yes | Smoke | Returns Backlog, Ready, In Progress, Review, Blocked, Done. |
| List Kanban tasks | `getTasks` in `control-center/src/api/tasks.ts` | `get_tasks` | `task_manager::get_tasks` | `kanban_cards` | Yes | Yes | Used by the current Kanban page for persisted tasks. |
| Create Kanban task | `createTask` | `create_task` | `task_manager::create_task` | `kanban_cards`, `task_activity`, `events` | Yes | Yes | Requires title and detailed instructions. |
| Legacy create card | `createCard` in `control-center/src/api/kanban.ts` | `create_card` | `board_services::create_card` | `kanban_cards` | Yes | Smoke | Older API, still available but Kanban page uses `createTask`. |
| Assign task to agent | `updateTask` / `assignTaskToAgent` | `update_task` / `assign_task_to_agent` | `task_manager::update_task` / `task_manager::assign_task_to_agent` | `kanban_cards`, `task_activity` | Yes | Yes | Drawer assignment uses `updateTask`; direct wrapper remains available. |
| Legacy assign card | `assignCard` | `assign_card` | `board_services::assign_card` | `kanban_cards`, `events` | Yes | Smoke | Older API. |
| Move task | `moveTask` | `move_task` | `task_manager::move_task` | `kanban_cards`, `task_activity` | Yes | Yes | Blocks Done without a work receipt. |
| Legacy move card | `moveCard` | `move_card` | `board_services::move_card` | `kanban_cards`, `events` | Yes | Smoke | Older API with dependency/evidence checks. |
| Block task | `blockTask` | `block_task` | `task_manager::block_task` | `kanban_cards`, `task_activity` | Yes | Yes | Persists blocked status and reason. |
| Unblock task | `unblockTask` | `unblock_task` | `task_manager::unblock_task` | `kanban_cards`, `task_activity` | Yes | Yes | Returns task to Ready and clears block reason. |
| Start agent work | `startAgentTaskRun` in `control-center/src/api/taskRuns.ts` | `start_agent_task_run` | `task_manager::start_agent_task_run` | `agent_runs`, `agent_run_steps`, `task_progress_updates`, `task_work_receipts`, `kanban_cards`, `task_activity` | Yes | Yes | Validates DB, instructions, agent, concrete model, Camelid, saves response/failure, moves success to Review, creates draft receipt. |
| List task runs | `listTaskRuns` | `list_task_runs` | `task_manager::list_task_runs` | `agent_runs` | Yes | Smoke | Used by `AgentRunPanel`. |
| List task progress | `listTaskProgressUpdates` | `list_task_progress_updates` | `task_manager::list_task_progress_updates` | `task_progress_updates` | Yes | Yes | Shows model response or failure. |
| Generate task receipt | `generateWorkReceipt` | `generate_task_work_receipt` | `task_manager::generate_task_work_receipt` | `task_work_receipts`, `kanban_cards`, `task_activity` | Yes | Yes | Manual regeneration path from Review. |
| Get task receipt | `getTaskWorkReceipt` | `get_task_work_receipt` | `task_manager::get_task_work_receipt` | `task_work_receipts` | Yes | Smoke | Used on task detail load. |
| Approve and complete | `approveWorkReceipt` | `approve_work_receipt` | `task_manager::approve_work_receipt` | `task_work_receipts`, `kanban_cards`, `task_activity` | Yes | Yes | Moves task to Done only from Review/In Progress with matching receipt. |
| Complete task guard | `completeTask` | `complete_task` | `task_manager::complete_task` | `task_work_receipts`, `kanban_cards` | Yes | Yes | Wrapper rejects completion with no receipt. |
| Send task back | `sendTaskBackToAgent` | `send_task_back_to_agent` | `task_manager::send_task_back_to_agent` | `kanban_cards`, `task_activity` | Yes | Smoke | Moves task back to In Progress with feedback. |
| Reopen task | `reopenTask` | `reopen_task` | `task_manager::reopen_task` | `kanban_cards`, `task_activity`, existing `task_work_receipts` preserved | Yes | Yes | Returns task to Ready and preserves receipt history. |
| Activity timeline | `listTaskActivity` | `list_task_activity` | `task_manager::list_task_activity` | `task_activity` | Yes | Yes | Used by task detail drawer. |
