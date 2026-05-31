# Cameleer Database Schema

This document outlines the SQLite schema driving the Cameleer local-first enterprise agent workspace.

## Core Architectural Concepts
Cameleer relies on a relational local-first SQLite database (`cameleer_workspace.db`). The schema is designed to model a complete multi-agent organization, bridging the gap between chat, Kanban task management, and autonomous runtime loops.

## Table Categories

### 1. Agents & Organizations
- **`agents`**: The central registry of all autonomous agents, defining their roles, personas, allowed tools, access scope, and hierarchical parent (`parent_agent_id`).
- **`projects` & `teams`**: Defines the nested agent organization chart.
- **`agent_org_nodes`**: Tracks the visual rendering hierarchy of the organization tree.
- **`agent_project_memberships`**: Connects agents to specific projects and teams with explicit roles and permissions.
- **`agent_relationships`**: Maps direct operational relationships (e.g., supervisor to subordinate) between agents.

### 2. Workspace & Task Management (Kanban)
- **`workspaces`**: The root of isolation boundaries, mapping to local filesystem directories.
- **`boards` & `board_columns`**: Traditional Kanban board definitions.
- **`backlogs` & `backlog_items`**: Task backlog registry for upcoming work.
- **`kanban_cards`**: The core unit of work. Every task is a card. Cards track status, assignee, blocking dependencies, completion evidence, and reviews.
- **`card_blockers`**: Explicit mapping of which tasks are blocking other tasks.

### 3. Execution Runtime & Tool Invocations
- **`agent_runs`**: Represents a discrete execution cycle/ReAct loop where an agent attempts to advance a `kanban_card`.
- **`agent_run_steps`**: Individual reasoning or action steps within a run.
- **`tool_invocations`**: A complete audit log of every tool execution, including the arguments and the output.
- **`tool_approvals`**: Tracks human-in-the-loop approvals for guarded tool executions.
- **`review_verdicts`**: Captures QA reviews or peer agent reviews on completed tasks.
- **`checkpoints`**: Saves state snapshots for long-running processes or rollbacks.
- **`mission_work_receipts`**: Detailed receipts generated when a card is moved to Done, detailing the exact files modified and tests run.

### 4. Memory & Communication
- **`messages`**: The unified chat stream. Messages can be scoped to a global session, a specific project/team, or a specific task card.
- **`project_chat_threads` & `team_chat_threads`**: Dedicated threaded conversations within an organization.
- **`memories`**: Long-term associative memory for agents.
- **`shared_state`**: A global blackboard for broadcasting shared world state across agents.
- **`scoped_context_snapshots`**: Serialized context windows for specific projects to accelerate agent resumption.

### 5. Models & Providers
- **`model_configs`**: API keys and endpoint URLs for remote providers (OpenAI, Anthropic, Gemini).
- **`models`**: The comprehensive registry of available LLMs, including local Camelid models (e.g. Llama 3).
- **`model_files` & `model_downloads`**: Tracks the physical GGUF files and download progress.
- **`model_inspections` & `model_tensor_summaries`**: Hardware compatibility and tensor layout diagnostics for local models.

### 6. Events & Audit
- **`events`**: A low-level persistent event log capturing every state transition (useful for time-travel debugging).
- **`mission_audit_events`**: High-level audit logs tracking major mission milestones and permission grants.

## Migration & Wiping Strategy
The database uses `CREATE TABLE IF NOT EXISTS`. During Phase 2, a complete wipe strategy was implemented: upon initialization, if `PRAGMA writable_schema = 1` is used to wipe `sqlite_master`, the schema is fully regenerated from `schema.sql` to ensure exact parity without legacy drift.
