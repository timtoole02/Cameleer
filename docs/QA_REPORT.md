# Cameleer QA Report

## Overview
This document tracks the verified end-to-end execution flows for the Cameleer architecture to ensure zero "fake success" regressions.

## Test Scenarios

### Workflow Execution Integrity (Sprint 3)
**Scenario**: Agent creates a task receipt and resolves pending commands.
**Steps**:
1. Agent completes a card by emitting a `task.complete` action containing `evidence`.
2. Backend validation engine processes the card completion and ensures the evidence string is extracted.
3. Backend propagates the evidence into `kanban_cards.completion_evidence` and `work_receipt_id`.
4. Agent attempts a risky command (e.g. `rm -rf`).
5. Backend Guard suspends execution and flags Kanban Card as `waiting_for_approval`.
6. UI properly surfaces the Security Sandbox Review Queue for human intervention.
7. Human clicks "Approve". UI resumes agent execution and status.

**Status**: 🟢 PASS
**Notes**:
- Verified logic in `agent_validation_engine.rs` now properly cascades evidence strings down into the core `kanban_cards` table, ensuring the React UI immediately displays receipts on the history timeline.
- Verified `command_guard.rs` successfully intercepts risky tasks and triggers the UI's safety review system.

### Live Terminal and Error Recovery (Sprint 4)
**Scenario**: Agent streams output to the UI and is safely blocked after repeated failure.
**Steps**:
1. Agent initiates a long running terminal command.
2. `agent_tool_controller.rs` spawns stdout and stderr threads, emitting Tauri events.
3. UI `TerminalDrawer` component listens to events and streams line-by-line output instantly.
4. Agent attempts to submit a task without satisfying contract criteria.
5. Validation Engine rejects the completion. 
6. Process repeats 3 times.
7. Validation Engine transitions Kanban Card to "Blocked", logs reason, and agent reverts to Idle safely.

**Status**: 🟢 PASS
**Notes**:
- Verified `TerminalDrawer` isolates logs per task id preventing cross-contamination.
- Verified `agent_runtime_kernel.rs` successfully handles the "Blocked" directive.

### Multi-Agent Handoff Context (Sprint 5)
**Scenario**: Agent hands off a card to another agent and context is properly transferred.
**Steps**:
1. Agent completes some steps and triggers a handoff.
2. `agent_handoff_manager.rs` extracts the last 5 steps from `agent_run_steps` for the current agent and task.
3. System injects a `system` message containing the Context Package.
4. UI renders the target agent's session with the previous agent's reasoning embedded.

**Status**: 🟢 PASS
**Notes**:
- Verified Visual Org Chart renders accurately in `ProjectDashboard.tsx` based on `agent_org_nodes`.
