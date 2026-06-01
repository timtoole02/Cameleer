-- Cameleer Production Workspace Schema
-- Defines exact schema for agents, models, projects, tasks, threads, messages, runs, tools, audit, settings.

CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY
);

-- 1. Agents Registry
CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    persona TEXT NOT NULL,
    model_provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2048,
    can_spawn_subtasks INTEGER DEFAULT 1,
    can_talk_globally INTEGER DEFAULT 1,
    is_continuous INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle',
    last_heartbeat TEXT,
    primary_skills TEXT,
    allowed_tools TEXT,
    reasoning_level TEXT DEFAULT 'standard',
    workspace_access TEXT DEFAULT 'full',
    file_access_scope TEXT,
    command_permissions TEXT,
    kanban_permissions TEXT DEFAULT 'full',
    review_requirements INTEGER DEFAULT 0,
    safety_profile TEXT DEFAULT 'moderate',
    escalation_rules TEXT,
    parent_agent_id TEXT REFERENCES agents(id)
);

-- 2. Model Settings & Configurations
CREATE TABLE IF NOT EXISTS model_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    model_name TEXT NOT NULL,
    api_key TEXT,
    endpoint_url TEXT,
    is_default INTEGER DEFAULT 0
);

-- 3. Unified Messages Stream
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    role TEXT NOT NULL,
    sender_id TEXT,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    project_id TEXT REFERENCES projects(id),
    team_id TEXT REFERENCES teams(id),
    agent_id TEXT REFERENCES agents(id),
    card_id TEXT REFERENCES kanban_cards(id)
);

-- 4. Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    active INTEGER DEFAULT 0
);

-- 5a. Boards
CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5b. Board Columns
CREATE TABLE IF NOT EXISTS board_columns (
    id TEXT PRIMARY KEY,
    board_id TEXT REFERENCES boards(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status_mapping TEXT NOT NULL,
    rank INTEGER NOT NULL,
    wip_limit INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5c. Backlogs
CREATE TABLE IF NOT EXISTS backlogs (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5d. Backlog Items
CREATE TABLE IF NOT EXISTS backlog_items (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    project_id TEXT REFERENCES projects(id),
    team_id TEXT REFERENCES teams(id),
    backlog_id TEXT REFERENCES backlogs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    type TEXT DEFAULT 'feature',
    priority TEXT DEFAULT 'medium',
    rank INTEGER DEFAULT 0,
    labels TEXT,
    source TEXT DEFAULT 'human',
    status TEXT DEFAULT 'captured',
    owner_agent_id TEXT REFERENCES agents(id),
    owner_human_id TEXT,
    proposed_agent_role TEXT,
    suggested_agent_role TEXT,
    acceptance_criteria TEXT,
    definition_of_done TEXT,
    required_files TEXT,
    refinement_notes TEXT,
    dependencies TEXT,
    risk_level TEXT DEFAULT 'low',
    effort_estimate TEXT,
    readiness_score INTEGER DEFAULT 0,
    converted_card_id TEXT,
    archived_at TEXT,
    rejected_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backlog_acceptance_criteria (
    id TEXT PRIMARY KEY,
    backlog_item_id TEXT NOT NULL REFERENCES backlog_items(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backlog_activity (
    id TEXT PRIMARY KEY,
    backlog_item_id TEXT NOT NULL REFERENCES backlog_items(id) ON DELETE CASCADE,
    actor_id TEXT,
    actor_type TEXT NOT NULL DEFAULT 'system',
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5e. Kanban Cards
CREATE TABLE IF NOT EXISTS kanban_cards (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    project_id TEXT REFERENCES projects(id),
    team_id TEXT REFERENCES teams(id),
    board_id TEXT REFERENCES boards(id),
    backlog_id TEXT REFERENCES backlogs(id),
    parent_id TEXT REFERENCES kanban_cards(id),
    task_key TEXT,
    title TEXT NOT NULL,
    description TEXT,
    instructions TEXT,
    type TEXT DEFAULT 'feature',
    status TEXT DEFAULT 'ready',
    priority TEXT DEFAULT 'medium',
    rank INTEGER DEFAULT 0,
    severity TEXT,
    labels TEXT,
    assigned_agent_id TEXT REFERENCES agents(id),
    assigned_human_id TEXT,
    reporter TEXT,
    created_by TEXT DEFAULT 'system',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    due_date TEXT,
    start_date TEXT,
    completed_at TEXT,
    estimate TEXT,
    actual_time TEXT,
    acceptance_criteria TEXT,
    definition_of_done TEXT,
    required_files TEXT,
    related_files TEXT,
    related_artifacts TEXT,
    dependencies TEXT,
    blocked_by TEXT,
    blocked_reason TEXT,
    blocking TEXT,
    comments TEXT,
    activity_log TEXT,
    checklist TEXT,
    validation_status TEXT DEFAULT 'pending',
    completion_evidence TEXT,
    work_receipt_id TEXT,
    risk_level TEXT DEFAULT 'low',
    review_required INTEGER DEFAULT 0,
    approval_required INTEGER DEFAULT 0,
    reopen_reason TEXT
);

CREATE TABLE IF NOT EXISTS task_activity (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
    actor_id TEXT,
    actor_type TEXT NOT NULL DEFAULT 'system',
    event_type TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_progress_updates (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
    run_id TEXT REFERENCES agent_runs(id) ON DELETE SET NULL,
    agent_id TEXT REFERENCES agents(id),
    content TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'sent',
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5f. Task Blockers Mapping
CREATE TABLE IF NOT EXISTS card_blockers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT REFERENCES kanban_cards(id),
    blocked_by_card_id TEXT REFERENCES kanban_cards(id),
    reason TEXT NOT NULL
);

-- 6. Continuous Work Runs
CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents(id),
    conversation_id TEXT,
    task_id TEXT REFERENCES kanban_cards(id),
    state TEXT NOT NULL,
    input TEXT,
    plan TEXT,
    final_answer TEXT,
    error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6b. Agent Run Steps
CREATE TABLE IF NOT EXISTS agent_run_steps (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES agent_runs(id) ON DELETE CASCADE,
    step_type TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6c. Tool Invocations
CREATE TABLE IF NOT EXISTS tool_invocations (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES agent_runs(id) ON DELETE CASCADE,
    agent_id TEXT REFERENCES agents(id),
    task_id TEXT REFERENCES kanban_cards(id),
    tool_name TEXT NOT NULL,
    arguments TEXT NOT NULL,
    output TEXT,
    status TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
);

-- 6d. Tool Approvals
CREATE TABLE IF NOT EXISTS tool_approvals (
    id TEXT PRIMARY KEY,
    invocation_id TEXT REFERENCES tool_invocations(id) ON DELETE CASCADE,
    card_id TEXT REFERENCES kanban_cards(id),
    agent_id TEXT REFERENCES agents(id),
    tool_name TEXT NOT NULL,
    arguments TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    decided_by TEXT,
    feedback TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    decided_at DATETIME
);

-- 6e. Review Verdicts
CREATE TABLE IF NOT EXISTS review_verdicts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    card_id TEXT REFERENCES kanban_cards(id),
    reviewer_id TEXT,
    verdict TEXT NOT NULL,
    comments TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6f. Memory System
CREATE TABLE IF NOT EXISTS memories (
    id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents(id),
    workspace_id TEXT,
    content TEXT NOT NULL,
    context TEXT,
    importance INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME
);

-- 7. Persistent Event Log
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    agent_id TEXT,
    task_id TEXT,
    payload TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Blackboard Shared World State Summary
CREATE TABLE IF NOT EXISTS shared_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Workspace Artifacts
CREATE TABLE IF NOT EXISTS artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT REFERENCES kanban_cards(id),
    project_id TEXT REFERENCES projects(id),
    team_id TEXT REFERENCES teams(id),
    path TEXT NOT NULL,
    artifact_type TEXT NOT NULL,
    size_bytes INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Global Settings
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 11a. Projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active',
    priority TEXT DEFAULT 'medium',
    owner_agent_id TEXT REFERENCES agents(id),
    owner_human_id TEXT,
    default_board_id TEXT REFERENCES boards(id),
    default_context_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11b. Teams
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    project_id TEXT REFERENCES projects(id),
    parent_team_id TEXT REFERENCES teams(id),
    name TEXT NOT NULL,
    description TEXT,
    lead_agent_id TEXT REFERENCES agents(id),
    purpose TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11c. Agent Org Nodes
CREATE TABLE IF NOT EXISTS agent_org_nodes (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    project_id TEXT REFERENCES projects(id),
    parent_node_id TEXT REFERENCES agent_org_nodes(id),
    node_type TEXT NOT NULL,
    display_name TEXT NOT NULL,
    agent_id TEXT REFERENCES agents(id),
    team_id TEXT REFERENCES teams(id),
    sort_order INTEGER DEFAULT 0,
    collapsed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11d. Agent Relationships
CREATE TABLE IF NOT EXISTS agent_relationships (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    source_agent_id TEXT REFERENCES agents(id),
    target_agent_id TEXT REFERENCES agents(id),
    relationship_type TEXT NOT NULL,
    permissions TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11e. Agent Project Memberships
CREATE TABLE IF NOT EXISTS agent_project_memberships (
    id TEXT PRIMARY KEY,
    agent_id TEXT REFERENCES agents(id),
    workspace_id TEXT REFERENCES workspaces(id),
    project_id TEXT REFERENCES projects(id),
    team_id TEXT REFERENCES teams(id),
    role_in_project TEXT,
    permissions TEXT,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11f. Scoped Chat Threads
CREATE TABLE IF NOT EXISTS project_chat_threads (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS team_chat_threads (
    id TEXT PRIMARY KEY,
    team_id TEXT REFERENCES teams(id),
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11g. Scoped Context Snapshots
CREATE TABLE IF NOT EXISTS scoped_context_snapshots (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    project_id TEXT REFERENCES projects(id),
    team_id TEXT REFERENCES teams(id),
    snapshot_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Decisions
CREATE TABLE IF NOT EXISTS decisions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT REFERENCES workspaces(id),
    decision TEXT NOT NULL,
    decided_by TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Handoffs
CREATE TABLE IF NOT EXISTS handoffs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT REFERENCES kanban_cards(id),
    source_agent_id TEXT REFERENCES agents(id),
    target_agent_id TEXT REFERENCES agents(id),
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Checkpoints Store
CREATE TABLE IF NOT EXISTS checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT REFERENCES agents(id),
    task_id TEXT REFERENCES kanban_cards(id),
    plan TEXT,
    completed_steps TEXT,
    open_steps TEXT,
    files_touched TEXT,
    reasoning_summary TEXT,
    last_tool_output TEXT,
    validation_status TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Custom & Built-In Mission Packs
CREATE TABLE IF NOT EXISTS custom_mission_packs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    default_agents TEXT,
    default_columns TEXT,
    default_cards TEXT,
    default_evidence_gates TEXT,
    default_review_flow TEXT,
    default_permissions TEXT,
    user_editable INTEGER DEFAULT 1,
    version TEXT
);

-- 16. Mission Previews
CREATE TABLE IF NOT EXISTS mission_previews (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id),
    mission_title TEXT NOT NULL,
    mission_goal TEXT NOT NULL,
    mission_type TEXT NOT NULL,
    risks TEXT,
    assumptions TEXT,
    generated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'draft'
);

-- 17. Mission Preview Proposed Agents
CREATE TABLE IF NOT EXISTS mission_preview_agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preview_id TEXT REFERENCES mission_previews(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    description TEXT,
    template_id TEXT,
    suggested_model TEXT,
    reasoning_level TEXT DEFAULT 'standard',
    allowed_tools TEXT,
    command_permissions TEXT,
    file_access_scope TEXT,
    kanban_permissions TEXT DEFAULT 'full',
    safety_profile TEXT DEFAULT 'moderate',
    escalation_rules TEXT,
    rationale TEXT
);

-- 18. Mission Preview Proposed Cards
CREATE TABLE IF NOT EXISTS mission_preview_cards (
    id TEXT PRIMARY KEY,
    preview_id TEXT REFERENCES mission_previews(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    suggested_agent_role TEXT,
    suggested_agent_id TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'backlog',
    acceptance_criteria TEXT,
    required_files TEXT,
    related_files TEXT,
    dependencies TEXT,
    evidence_gate TEXT,
    review_required INTEGER DEFAULT 0,
    approval_required INTEGER DEFAULT 0
);

-- 19. Agent Contracts
CREATE TABLE IF NOT EXISTS mission_agent_contracts (
    agent_id TEXT PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    responsibilities TEXT,
    allowed_actions TEXT,
    required_context_before_work TEXT,
    required_outputs TEXT,
    validation_rules TEXT,
    handoff_rules TEXT,
    escalation_rules TEXT,
    done_definition TEXT
);

-- 20. Work Receipts
CREATE TABLE IF NOT EXISTS mission_work_receipts (
    card_id TEXT PRIMARY KEY REFERENCES kanban_cards(id) ON DELETE CASCADE,
    agent_id TEXT REFERENCES agents(id),
    summary TEXT NOT NULL,
    files_created TEXT,
    files_modified TEXT,
    commands_run TEXT,
    tests_run TEXT,
    validation_status TEXT NOT NULL,
    evidence_links TEXT,
    known_limitations TEXT,
    follow_up_recommendations TEXT,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS task_work_receipts (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES kanban_cards(id) ON DELETE CASCADE,
    agent_id TEXT REFERENCES agents(id),
    summary TEXT NOT NULL,
    instructions_followed TEXT,
    acceptance_criteria_results TEXT,
    files_created TEXT,
    files_modified TEXT,
    commands_run TEXT,
    tests_run TEXT,
    validation_status TEXT NOT NULL,
    evidence_links TEXT,
    known_limitations TEXT,
    follow_up_recommendations TEXT,
    completed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 21. Autopilot Settings
CREATE TABLE IF NOT EXISTS autopilot_settings (
    workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
    autopilot_enabled INTEGER DEFAULT 0,
    autopilot_scope TEXT DEFAULT 'off',
    approval_requirements TEXT DEFAULT 'moderate',
    command_permissions_override TEXT,
    file_permissions_override TEXT,
    network_permissions TEXT DEFAULT 'none',
    done_approval_rules TEXT DEFAULT 'reviewer_or_user'
);

-- 22. Mission Recommendations
CREATE TABLE IF NOT EXISTS mission_recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    recommendation_type TEXT NOT NULL,
    content TEXT NOT NULL,
    action_target TEXT,
    status TEXT DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 23. Mission Audit Events Log
CREATE TABLE IF NOT EXISTS mission_audit_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id TEXT REFERENCES workspaces(id),
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 24. Models Registry
CREATE TABLE IF NOT EXISTS models (
    model_id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    source_repo TEXT,
    source_file TEXT,
    local_path TEXT,
    architecture TEXT,
    quantization TEXT,
    parameter_count TEXT,
    file_size_bytes INTEGER,
    checksum_sha256 TEXT,
    install_status TEXT NOT NULL,
    compatibility_status TEXT NOT NULL,
    runnable_status INTEGER DEFAULT 0,
    active_status INTEGER DEFAULT 0,
    license TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_inspected_at DATETIME,
    last_validated_at DATETIME
);

-- 25. Model Files Registry
CREATE TABLE IF NOT EXISTS model_files (
    file_id TEXT PRIMARY KEY,
    model_id TEXT REFERENCES models(model_id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    provider_url TEXT NOT NULL,
    local_path TEXT,
    file_size_bytes INTEGER,
    downloaded_bytes INTEGER DEFAULT 0,
    checksum_sha256 TEXT,
    download_status TEXT DEFAULT 'idle',
    install_status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 26. Model Inspections
CREATE TABLE IF NOT EXISTS model_inspections (
    inspection_id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT UNIQUE REFERENCES models(model_id) ON DELETE CASCADE,
    gguf_version INTEGER,
    architecture TEXT,
    tokenizer_model TEXT,
    context_length INTEGER,
    embedding_length INTEGER,
    block_count INTEGER,
    feed_forward_length INTEGER,
    attention_head_count INTEGER,
    attention_head_count_kv INTEGER,
    rope_dimension_count INTEGER,
    rope_freq_base REAL,
    rope_freq_scale REAL,
    quantization_summary TEXT,
    tensor_count INTEGER,
    supported_tensor_types TEXT,
    unsupported_tensor_types TEXT,
    required_runtime_features TEXT,
    inspection_status TEXT NOT NULL,
    inspection_errors TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 27. Model Tensor Layout Summaries
CREATE TABLE IF NOT EXISTS model_tensor_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT REFERENCES models(model_id) ON DELETE CASCADE,
    tensor_name TEXT NOT NULL,
    tensor_type TEXT NOT NULL,
    shape TEXT NOT NULL,
    layout_status TEXT DEFAULT 'valid',
    supported INTEGER DEFAULT 1,
    notes TEXT
);

-- 28. Model Downloads
CREATE TABLE IF NOT EXISTS model_downloads (
    download_id TEXT PRIMARY KEY,
    model_id TEXT REFERENCES models(model_id),
    provider TEXT NOT NULL,
    url TEXT NOT NULL,
    destination_path TEXT NOT NULL,
    status TEXT NOT NULL,
    total_bytes INTEGER,
    downloaded_bytes INTEGER DEFAULT 0,
    resume_supported INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    error_message TEXT
);

-- 29. Scoped Model Activations
CREATE TABLE IF NOT EXISTS model_activations (
    activation_id INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id TEXT REFERENCES models(model_id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    activated_by TEXT DEFAULT 'user'
);
