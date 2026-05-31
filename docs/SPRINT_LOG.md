# Sprint Log

## Sprint 1: Rebuild Kanban and Backlog Frontend in React with Apple-class UI tokens
- Dismantled `App.tsx` monolith into React components.
- Enforced `move_card` logic requiring `completion_evidence`.
- Added Apple-class design system tokens.

## Sprint 2: Rebuild Agent Chat and Workflow UI
- Fixed `save_and_emit_message` to correctly assign roles in `agent_tool_controller.rs` so messages display properly in the UI.
- Extracted `AgentChat` component from `App.tsx`.
- Updated `CardDrawer` to beautifully display progress logs (comments) and system activity logs alongside acceptance criteria and evidence.
- Verified compilation and passing tests.

## Sprint 3: Stabilize Agent Tool Workflows and Complete End-to-End Execution Flow
- Updated `agent_validation_engine.rs` to persist `completion_evidence`, `work_receipt_id`, and `validation_status` to `kanban_cards`.
- Updated `QA_REPORT.md` and verified end-to-end sandbox review queues.
- Confirmed `task.complete` generates a valid receipt rendering in the UI.

## Sprint 4: Live Terminal Output and Agent Recovery Refinement
- Refactored `command.run` handler in `agent_tool_controller.rs` to stream `stdout` and `stderr` asynchronously via Tauri events.
- Created `TerminalDrawer.tsx` frontend component to render a live, scrolling, colored terminal output log within the Kanban `CardDrawer`.
- Updated `agent_validation_engine.rs` to track validation failures, capping them at 3 before automatically transitioning the card to `Blocked` to prevent infinite loops.

## Sprint 5: Multi-Agent Handoff Context & Visual Org Chart
- Upgraded `agent_handoff_manager.rs` to extract recent `agent_run_steps` for seamless agent context transfers during handoffs.
- Constructed `VisualOrgChart.tsx` to dynamically render a hierarchical map of workspaces, projects, teams, and agents with Apple-class node aesthetics.
- Embedded the visual org chart directly inside `ProjectDashboard.tsx` replacing the text placeholder.

## Sprint 6: Mission Execution Tracker & Context Pruning
- Established hard context caps within the backend file sandbox and handoff manager to prevent infinite recursive token buildup.
- Expanded `mission_builder.rs` with `get_active_missions_progress` to calculate real-time Kanban completion percentages.
- Added a Live Missions execution view within `App.tsx` displaying interactive, dynamic glassmorphic progress bars mapped to mission lifecycles.

## Sprint 7: Cross-Agent Dependency Unblocking & File Context Ingestion
- Upgraded `task_manager.rs` to automatically resolve `task_blockers` when parent cards are completed, safely transitioning downstream blocked cards to `ready`.
- Automated system message injection to notify target agents when their assigned task is unblocked.
- Overhauled `context_engine.rs` to selectively open recently touched text files from the `artifacts` table and inject their raw code contents directly into the LLM system prompt window (hardcapped to 50KB to respect context boundaries).

## Sprint 8: Agent Review Tribunal & Local Llama 3 Fine-Tuning Adapters
- Migrated terminal state in `task_manager.rs` so completed Kanban cards route to an `in_review` staging state rather than immediately resolving to `done`.
- Implemented `submit_review` and `work_engine::generate_work_suggestions` logic so "Senior" agents can review, approve, or reject Junior agent code snippets, effectively constructing an autonomous QA Tribunal.
- Added `dataset_exporter.rs` module that scans SQLite for successful `agent_runs` and synthesizes their logic steps into OpenAI/Alpaca `ChatML` JSONL lines, laying the foundation for local LoRA fine-tuning of Llama 3 models on Cameleer emergent behaviors.
