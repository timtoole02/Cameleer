import React from 'react';
import { Agent } from '../../types/agent';

interface AgentAssignmentSelectProps {
  agents: Agent[];
  value?: string | null;
  onChange: (agentId: string | null) => void;
  compact?: boolean;
}

export const AgentAssignmentSelect: React.FC<AgentAssignmentSelectProps> = ({ agents, value, onChange, compact }) => (
  <label className={compact ? 'kanban-field compact' : 'kanban-field'}>
    <span>Assigned agent</span>
    <select value={value || ''} onChange={(event) => onChange(event.target.value || null)}>
      <option value="">Unassigned</option>
      {agents.map((agent) => (
        <option key={agent.id} value={agent.id}>
          {agent.name} - {agent.role || 'Agent'} - {agent.model_name || 'No model'}
        </option>
      ))}
    </select>
  </label>
);
