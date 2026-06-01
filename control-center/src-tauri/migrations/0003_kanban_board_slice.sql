-- Migration: 0003_kanban_board_slice
-- Adds task instructions, activity, progress updates, and receipt-backed closeout.

ALTER TABLE kanban_cards ADD COLUMN task_key TEXT;
ALTER TABLE kanban_cards ADD COLUMN instructions TEXT;
ALTER TABLE kanban_cards ADD COLUMN blocked_reason TEXT;

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

UPDATE model_configs
SET model_name = 'Llama 3.2 1B Instruct',
    endpoint_url = COALESCE(endpoint_url, 'http://127.0.0.1:8181/v1/chat/completions'),
    is_default = 1
WHERE provider = 'camelid' AND (model_name = 'camelid-default' OR is_default = 1);

UPDATE agents
SET model_name = CASE
        WHEN model_provider = 'camelid' AND model_name = 'camelid-default'
        THEN 'Llama 3.2 1B Instruct'
        ELSE model_name
    END;
