-- Migration: 0002_agent_contract_done_definition
-- Adds done_definition to mission_agent_contracts table.

ALTER TABLE mission_agent_contracts ADD COLUMN done_definition TEXT;
