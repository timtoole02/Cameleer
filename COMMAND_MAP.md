# COMMAND_MAP — Cameleer Control Center

> **Purpose (HARDPAN G0).** Evidence-derived map of every backend `#[tauri::command]` →
> registered? → TS api wrapper? → UI surface? → tested? Re-derived from code on the
> `hardpan` branch; not copied from any prior doc. This file is the ground truth that
> [STATUS.md](STATUS.md) draws on for its two-lane (Supported / Runnable) assignments.

## Headline counts

| metric | value | source |
|---|---:|---|
| Backend `#[tauri::command]` functions | **149** | `grep -rn '#[tauri::command]' control-center/src-tauri/src` |
| …registered in `generate_handler!` | **138** | `control-center/src-tauri/src/lib.rs:89–229` |
| …with a TS api wrapper (`apiCall("cmd")`) | **67** | `control-center/src/api/**` |
| …that reach a UI surface (page/component) | **48** | `control-center/src/pages/**`, `components/**` |
| …whose module has a `#[cfg(test)]` block | 86 | see caveat below |
| Unregistered (defined, not callable from JS) | **11** | not in `generate_handler!` |
| GHOSTS (frontend calls a non-existent command) | **0** | every `apiCall` string maps to a real registered command |

### Reading this table — two honesty caveats
1. **`module tested?` ≠ `command tested`.** The last column says whether the command's
   *module* contains any `#[cfg(test)]` block — **not** that this specific command has a
   test. Per the mandate's two-lane rule, "covered by a test" requires an actual test of
   the behavior; a `YES-module` here is necessary but not sufficient for **Supported**.
2. **The frontend never calls `invoke()` directly.** Every command is reached through the
   central helper `apiCall<T>(command, args)` at `control-center/src/api/client.ts:3`.
   "api wrapper" cites the `apiCall("<cmd>")` site; "UI surface" means the exported wrapper
   is imported by a `pages/`/`components/` file.

## Full command map

| # | command | module | registered? | api wrapper (file:line) | UI surface | module tested? |
|---|---------|--------|:-:|---|---|:-:|
| 1 | get_backend_status | backend_runtime | ✅ | — | — | �r |
| 2 | ensure_backend_running | backend_runtime | ✅ | — | — | ▒ |
| 3 | check_backend_health | backend_runtime | ✅ | — | — | ▒ |
| 4 | restart_backend | backend_runtime | ✅ | — | — | ▒ |
| 5 | stop_backend | backend_runtime | ✅ | — | — | ▒ |
| 6 | get_backend_logs | backend_runtime | ✅ | — | — | ▒ |
| 7 | open_backend_logs | backend_runtime | ✅ | — | — | ▒ |
| 8 | open_backend_settings | backend_runtime | ✅ | — | — | ▒ |
| 9 | reveal_backend_binary | backend_runtime | ✅ | — | — | ▒ |
| 10 | save_backend_config_cmd | backend_runtime | ✅ | — | — | ▒ |
| 11 | reset_backend_runtime_state | backend_runtime | ✅ | — | — | ▒ |
| 12 | get_backend_config | backend_runtime | ✅ | settings.ts:8 | — (wrapper-only) | ▒ |
| 13 | verify_packaged_runtime | backend_runtime | ✅ | — | — | ▒ |
| 14 | list_board_columns | board_services | ✅ | kanban.ts:15 | KanbanPage | ▒ |
| 15 | create_board_column | board_services | ✅ | — | — | ▒ |
| 16 | update_board_column | board_services | ✅ | — | — | ▒ |
| 17 | move_board_column | board_services | ✅ | — | — | ▒ |
| 18 | set_column_wip_limit | board_services | ✅ | — | — | ▒ |
| 19 | get_backlog_snapshot | board_services | ✅ | backlog.ts:5 | BacklogPage | ▒ |
| 20 | list_backlog_items | board_services | ❌ unreg | — | — | ▒ |
| 21 | get_backlog_item | board_services | ❌ unreg | — | — | ▒ |
| 22 | create_backlog_item | board_services | ✅ | backlog.ts:9 | BacklogPage | ▒ |
| 23 | update_backlog_item | board_services | ✅ | backlog.ts:13 | BacklogPage | ▒ |
| 24 | convert_backlog_item_to_card | board_services | ✅ | backlog.ts:17 | BacklogPage | ▒ |
| 25 | convert_backlog_item_to_task | board_services | ❌ unreg | — | — | ▒ |
| 26 | get_board_snapshot | board_services | ✅ | kanban.ts:19 | — (wrapper-only) | ▒ |
| 27 | create_card | board_services | ✅ | kanban.ts:36 | — (wrapper-only) | ▒ |
| 28 | assign_card | board_services | ✅ | kanban.ts:44 | — (wrapper-only) | ▒ |
| 29 | move_card | board_services | ✅ | kanban.ts:48 | — (wrapper-only) | ▒ |
| 30 | get_agent_work_queue | board_services | ✅ | kanban.ts:52 | — (wrapper-only) | ▒ |
| 31 | get_sandbox_audit_logs | system_services | ❌ unreg | — | — | ▒ |
| 32 | check_camelid_health | system_services | ✅ | — | — | ▒ |
| 33 | run_model_benchmark | system_services | ❌ unreg | — | — | ▒ |
| 34 | get_backend_health | system_services | ✅ | health.ts:21 | OtherPages / App.tsx | ▒ |
| 35 | reset_dev_database | system_services | ✅ | health.ts:25 | OtherPages | ▒ |
| 36 | get_work_engine_suggestions | work_engine | ✅ | — | — | ✗ |
| 37 | list_templates | agent_templates | ✅ | — | — | ✗ |
| 38 | create_agent_from_template | agent_templates | ✅ | — | — | ✗ |
| 39 | create_software_team | agent_templates | ✅ | — | — | ✗ |
| 40 | create_coding_sprint | agent_templates | ✅ | — | — | ✗ |
| 41 | get_pending_command_approval | command_guard | ✅ | runtime.ts:13 | OtherPages | ✗ |
| 42 | resolve_command_approval | command_guard | ✅ | runtime.ts:17 | OtherPages | ✗ |
| 43 | update_heartbeat | supervisor | ✅ | — | — | ✗ |
| 44 | greet | lib | ✅ | — | — | ▒ |
| 45 | export_finetuning_dataset | dataset_exporter | ✅ | — | — | ✗ |
| 46 | save_agent_checkpoint | checkpoint_store | ✅ | — | — | ✗ |
| 47 | get_latest_checkpoint | checkpoint_store | ✅ | — | — | ✗ |
| 48 | get_messages | chat_service | ✅ | chat.ts:17 | ChatPage | ▒ |
| 49 | save_message | chat_service | ✅ | chat.ts:30 | ChatPage | ▒ |
| 50 | trigger_agent_reply | chat_service | ✅ | chat.ts:39 | ChatPage | ▒ |
| 51 | trigger_org_reply | chat_service | ✅ | — | — | ▒ |
| 52 | get_agents | agent_registry | ✅ | agents.ts:5 | AgentsPage / ChatPage / KanbanPage | ✗ |
| 53 | create_agent | agent_registry | ✅ | agents.ts:9 | AgentsPage | ✗ |
| 54 | update_agent | agent_registry | ✅ | agents.ts:13 | — (wrapper-only) | ✗ |
| 55 | delete_agent | agent_registry | ✅ | agents.ts:17 | — (wrapper-only) | ✗ |
| 56 | list_memories | memory_engine | ✅ | memory.ts:15 | OtherPages | ✗ |
| 57 | search_memories_cmd | memory_engine | ✅ | memory.ts:19 | OtherPages | ✗ |
| 58 | create_memory_cmd | memory_engine | ✅ | memory.ts:29 | OtherPages | ✗ |
| 59 | delete_memory_cmd | memory_engine | ✅ | memory.ts:39 | OtherPages | ✗ |
| 60 | list_provider_configs | router | ✅ | models.ts:38 | ModelsPage | ✗ |
| 61 | save_provider_config | router | ✅ | models.ts:42 | ModelsPage | ✗ |
| 62 | get_local_models | router | ✅ | — | — | ✗ |
| 63 | download_model | router | ✅ | — | — | ✗ |
| 64 | activate_model | router | ✅ | — | — | ✗ |
| 65 | get_active_missions_progress | mission_builder | ✅ | — | — | ✗ |
| 66 | list_mission_packs | mission_builder | ✅ | — | — | ✗ |
| 67 | generate_mission_preview | mission_builder | ✅ | — | — | ✗ |
| 68 | edit_mission_preview | mission_builder | ✅ | — | — | ✗ |
| 69 | apply_mission_preview | mission_builder | ✅ | — | — | ✗ |
| 70 | discard_mission_preview | mission_builder | ✅ | — | — | ✗ |
| 71 | save_mission_pack_from_preview | mission_builder | ✅ | — | — | ✗ |
| 72 | get_autopilot_settings | mission_builder | ✅ | settings.ts:4 | — (wrapper-only) | ✗ |
| 73 | update_autopilot_settings | mission_builder | ✅ | — | — | ✗ |
| 74 | get_mission_recommendations | mission_builder | ✅ | — | — | ✗ |
| 75 | dismiss_recommendation | mission_builder | ✅ | — | — | ✗ |
| 76 | get_agent_contract | mission_builder | ✅ | — | — | ✗ |
| 77 | get_mission_audit_events | mission_builder | ✅ | audit.ts:12 | OtherPages | ✗ |
| 78 | get_work_receipt | mission_builder | ✅ | audit.ts:31 | — (wrapper-only) | ✗ |
| 79 | generate_work_receipt | mission_builder | ✅ | audit.ts:35 | — (wrapper-only) | ✗ |
| 80 | get_blackboard_awareness | context_engine | ✅ | — | — | ✗ |
| 81 | get_workspace_context | context_engine | ✅ | — | — | ✗ |
| 82 | get_scoped_agent_context | context_engine | ❌ unreg | — | — | ✗ |
| 83 | record_decision_cmd | context_engine | ✅ | context.ts:32 | OtherPages | ✗ |
| 84 | request_handoff_cmd | context_engine | ✅ | context.ts:41 | — (wrapper-only) | ✗ |
| 85 | resolve_handoff_cmd | context_engine | ✅ | context.ts:45 | OtherPages | ✗ |
| 86 | get_coordination_details | context_engine | ✅ | context.ts:28 | OtherPages | ✗ |
| 87 | update_shared_state | context_engine | ✅ | — | — | ✗ |
| 88 | list_model_catalog | models_manager | ✅ | models.ts:15 | ModelsPage | ✗ |
| 89 | search_remote_models | models_manager | ✅ | — | — | ✗ |
| 90 | generate_model_preflight | models_manager | ✅ | — | — | ✗ |
| 91 | queue_model_download | models_manager | ✅ | — | — | ✗ |
| 92 | pause_model_download | models_manager | ✅ | — | — | ✗ |
| 93 | resume_model_download | models_manager | ✅ | — | — | ✗ |
| 94 | cancel_model_download | models_manager | ✅ | — | — | ✗ |
| 95 | import_local_model | models_manager | ✅ | models.ts:27 | — (wrapper-only) | ✗ |
| 96 | delete_model | models_manager | ✅ | — | — | ✗ |
| 97 | activate_model_scoped | models_manager | ✅ | models.ts:23 | — (wrapper-only) | ✗ |
| 98 | run_model_smoke_test | models_manager | ✅ | models.ts:19 | ModelsPage | ✗ |
| 99 | get_model_details | models_manager | ✅ | — | — | ✗ |
| 100 | get_model_storage_usage | models_manager | ✅ | — | — | ✗ |
| 101 | get_org_node_metrics | org_services | ✅ | — | — | ▒ |
| 102 | create_project | org_services | ✅ | agents.ts:43 | AgentsPage | ▒ |
| 103 | create_team | org_services | ✅ | agents.ts:47 | AgentsPage | ▒ |
| 104 | get_agent_org_tree | org_services | ✅ | agents.ts:21 | AgentsPage | ▒ |
| 105 | move_agent_to_team | org_services | ✅ | agents.ts:51 | AgentsPage | ▒ |
| 106 | get_task | task_manager | ✅ | tasks.ts:9 | KanbanPage | ▒ |
| 107 | get_tasks | task_manager | ✅ | tasks.ts:5 | KanbanPage | ▒ |
| 108 | get_agent_run_timeline | task_manager | ✅ | — | — | ▒ |
| 109 | get_card_timeline | task_manager | ✅ | — | — | ▒ |
| 110 | submit_review_verdict | task_manager | ✅ | — | — | ▒ |
| 111 | _get_agent_work_queue_legacy | task_manager | ❌ unreg | — | — | ▒ |
| 112 | create_task_legacy | task_manager | ❌ unreg | — | — | ▒ |
| 113 | create_task | task_manager | ✅ | tasks.ts:13 | KanbanPage | ▒ |
| 114 | update_task | task_manager | ✅ | tasks.ts:17 | KanbanPage | ▒ |
| 115 | move_task | task_manager | ✅ | tasks.ts:33 | KanbanPage | ▒ |
| 116 | assign_task_to_agent | task_manager | ✅ | tasks.ts:37 | — (wrapper-only) | ▒ |
| 117 | block_task | task_manager | ✅ | tasks.ts:41 | KanbanPage | ▒ |
| 118 | unblock_task | task_manager | ✅ | tasks.ts:45 | KanbanPage | ▒ |
| 119 | reopen_task | task_manager | ✅ | tasks.ts:53 | KanbanPage | ▒ |
| 120 | cancel_task | task_manager | ✅ | tasks.ts:57 | — (wrapper-only) | ▒ |
| 121 | delete_task | task_manager | ✅ | tasks.ts:61 | KanbanPage | ▒ |
| 122 | start_agent_task_run | task_manager | ✅ | taskRuns.ts:6 | KanbanPage | ▒ |
| 123 | get_task_run_status | task_manager | ✅ | taskRuns.ts:10 | — (wrapper-only) | ▒ |
| 124 | list_task_runs | task_manager | ✅ | taskRuns.ts:14 | KanbanPage | ▒ |
| 125 | save_task_progress_update | task_manager | ✅ | — | — | ▒ |
| 126 | list_task_progress_updates | task_manager | ✅ | tasks.ts:69 | KanbanPage | ▒ |
| 127 | list_task_activity | task_manager | ✅ | tasks.ts:65 | KanbanPage | ▒ |
| 128 | record_task_activity | task_manager | ✅ | — | — | ▒ |
| 129 | generate_task_work_receipt | task_manager | ✅ | taskRuns.ts:18 | KanbanPage | ▒ |
| 130 | get_task_work_receipt | task_manager | ✅ | taskRuns.ts:22 | KanbanPage | ▒ |
| 131 | approve_work_receipt | task_manager | ✅ | taskRuns.ts:26 | KanbanPage | ▒ |
| 132 | complete_task | task_manager | ✅ | tasks.ts:49 | — (wrapper-only) | ▒ |
| 133 | send_task_back_to_agent | task_manager | ✅ | taskRuns.ts:30 | KanbanPage | ▒ |
| 134 | update_task_status | task_manager | ✅ | — | — | ▒ |
| 135 | claim_card | task_manager | ✅ | — | — | ▒ |
| 136 | update_card_progress | task_manager | ✅ | — | — | ▒ |
| 137 | complete_card | task_manager | ✅ | — | — | ▒ |
| 138 | submit_review | task_manager | ✅ | — | — | ▒ |
| 139 | create_task_blocker | task_manager | ✅ | — | — | ▒ |
| 140 | register_artifact | task_manager | ✅ | — | — | ▒ |
| 141 | get_artifacts | task_manager | ✅ | — | — | ▒ |
| 142 | read_artifact_file | task_manager | ✅ | — | — | ▒ |
| 143 | decompose_task | task_manager | ✅ | — | — | ▒ |
| 144 | approve_subtasks | task_manager | ✅ | — | — | ▒ |
| 145 | get_agent_runs | task_manager | ✅ | runtime.ts:5 | OtherPages | ▒ |
| 146 | get_run_steps | task_manager | ✅ | runtime.ts:9 | — (wrapper-only) | ▒ |
| 147 | get_skill_playbooks | skills_manager | ❌ unreg | — | — | ✗ |
| 148 | save_skill_playbook | skills_manager | ❌ unreg | — | — | ✗ |
| 149 | delete_skill_playbook | skills_manager | ❌ unreg | — | — | ✗ |

Legend — module tested?: **▒** = module has a `#[cfg(test)]` block (not proof the command itself is tested) · **✗** = module has no tests at all.

## ORPHANS — registered but no api wrapper AND no UI surface (71)

Callable from JS but no TS wrapper invokes them and no page references them. These are
**Runnable, not Supported** candidates for [STATUS.md](STATUS.md) / G5:

`activate_model`, `apply_mission_preview`, `approve_subtasks`, `cancel_model_download`, `check_backend_health`, `check_camelid_health`, `claim_card`, `complete_card`, `create_agent_from_template`, `create_board_column`, `create_coding_sprint`, `create_software_team`, `create_task_blocker`, `decompose_task`, `delete_model`, `discard_mission_preview`, `dismiss_recommendation`, `download_model`, `edit_mission_preview`, `ensure_backend_running`, `export_finetuning_dataset`, `generate_mission_preview`, `generate_model_preflight`, `get_active_missions_progress`, `get_agent_contract`, `get_agent_run_timeline`, `get_artifacts`, `get_backend_logs`, `get_backend_status`, `get_blackboard_awareness`, `get_card_timeline`, `get_latest_checkpoint`, `get_local_models`, `get_mission_recommendations`, `get_model_details`, `get_model_storage_usage`, `get_org_node_metrics`, `get_work_engine_suggestions`, `get_workspace_context`, `greet`, `list_mission_packs`, `list_templates`, `move_board_column`, `open_backend_logs`, `open_backend_settings`, `pause_model_download`, `queue_model_download`, `read_artifact_file`, `record_task_activity`, `register_artifact`, `reset_backend_runtime_state`, `restart_backend`, `resume_model_download`, `reveal_backend_binary`, `save_agent_checkpoint`, `save_backend_config_cmd`, `save_mission_pack_from_preview`, `search_remote_models`, `set_column_wip_limit`, `stop_backend`, `submit_review`, `submit_review_verdict`, `trigger_org_reply`, `update_autopilot_settings`, `update_board_column`, `update_card_progress`, `update_heartbeat`, `update_shared_state`, `update_task_status`, `verify_packaged_runtime`.

## Partial orphans — api wrapper exists but no UI surface (19)

Dead/unreferenced TS wrappers (a wrapper exists but no page/component calls it):
`get_board_snapshot`, `create_card`, `assign_card`, `move_card`, `get_agent_work_queue`,
`get_autopilot_settings`, `get_backend_config`, `request_handoff_cmd`, `get_task_run_status`,
`get_run_steps`, `update_agent`, `delete_agent`, `get_work_receipt`, `generate_work_receipt`,
`assign_task_to_agent`, `complete_task`, `cancel_task`, `activate_model_scoped`, `import_local_model`.

## Unregistered (11) — defined but NOT in `generate_handler!`, uncallable from JS

`_get_agent_work_queue_legacy`, `create_task_legacy` (task_manager); `convert_backlog_item_to_task`,
`get_backlog_item`, `list_backlog_items` (board_services); `get_sandbox_audit_logs`,
`run_model_benchmark` (system_services); `get_scoped_agent_context` (context_engine);
`get_skill_playbooks`, `save_skill_playbook`, `delete_skill_playbook` (skills_manager).

## GHOSTS — frontend calls to a non-existent command

**None.** All 67 distinct command strings passed to `apiCall(...)` correspond to a real,
registered `#[tauri::command]`. No frontend call targets a missing or unregistered command.

> Nuance: two TS wrappers share the JS name `generateWorkReceipt` — `taskRuns.ts:17` →
> `generate_task_work_receipt` (used in KanbanPage) and `audit.ts:34` → `generate_work_receipt`
> (unused). Both target real backend commands, so neither is a ghost.

---
_Sources: `generate_handler!` at `control-center/src-tauri/src/lib.rs:89–229`; central invoke
wrapper at `control-center/src/api/client.ts:3`. Generated during HARDPAN G0._
