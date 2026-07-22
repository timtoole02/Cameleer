# Tauri Command Matrix

> **Superseded by [`../COMMAND_MAP.md`](../COMMAND_MAP.md)** (HARDPAN G0), which maps all
> 149 source commands (registered? → api wrapper? → UI surface? → tested?). This older
> matrix is a partial, hand-maintained view kept for reference.

| Frontend API function | Tauri command name | Rust module | Registered in builder | Backend implemented | Frontend wired | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| getBackendHealth | get_backend_health | system_services.rs | yes | yes | yes | working | P0 stabilization test |
| getAgents | get_agents | agent_registry.rs | yes | yes | yes | working | Lists available agents |
| createAgent | create_agent | agent_registry.rs | yes | yes | yes | unverified | Needs UI testing |
| updateAgent | update_agent | agent_registry.rs | yes | yes | yes | unverified | Needs UI testing |
| deleteAgent | delete_agent | agent_registry.rs | yes | yes | yes | unverified | Needs UI testing |
| getAgentOrgTree | get_agent_org_tree | org_services.rs | yes | yes | yes | working | Visual hierarchy map |
| getMessages | get_messages | chat_service.rs | yes | yes | yes | working | Persistent chat log |
| saveMessage | save_message | chat_service.rs | yes | yes | yes | working | Client message dispatch |
| triggerAgentReply | trigger_agent_reply | chat_service.rs | yes | yes | yes | unverified | Requires LLM provider |
| getBoardSnapshot | get_board_snapshot | board_services.rs | yes | yes | yes | working | Main kanban load |
| moveCard | move_card | board_services.rs | yes | yes | yes | working | Kanban state change |
| listModelCatalog | list_model_catalog | models_manager.rs | yes | yes | yes | working | Local models list |
| runModelSmokeTest | run_model_smoke_test | models_manager.rs | yes | yes | yes | working | Hardware inference test |
| getAgentRuns | get_agent_runs | task_manager.rs | yes | yes | yes | working | Mission execution log |
| getPendingCommandApproval | get_pending_command_approval | command_guard.rs | yes | yes | yes | working | Safety override approvals |
| getMissionAuditEvents | get_mission_audit_events | mission_builder.rs | yes | yes | yes | working | Live security audit |
