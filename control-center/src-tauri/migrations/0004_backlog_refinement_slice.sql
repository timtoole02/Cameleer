ALTER TABLE backlog_items ADD COLUMN instructions TEXT;
ALTER TABLE backlog_items ADD COLUMN suggested_agent_role TEXT;
ALTER TABLE backlog_items ADD COLUMN converted_card_id TEXT;
ALTER TABLE backlog_items ADD COLUMN archived_at TEXT;
ALTER TABLE backlog_items ADD COLUMN rejected_reason TEXT;

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

UPDATE backlog_items
SET status = CASE
    WHEN status = 'backlog' THEN 'captured'
    WHEN status = 'ready_for_board' THEN 'converted'
    ELSE status
END;

UPDATE backlog_items
SET suggested_agent_role = proposed_agent_role
WHERE suggested_agent_role IS NULL AND proposed_agent_role IS NOT NULL;
