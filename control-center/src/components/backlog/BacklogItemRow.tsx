import React from 'react';
import { BacklogItem } from '../../types/backlog';

interface BacklogItemRowProps {
  item: BacklogItem;
  selected?: boolean;
  onSelect: (item: BacklogItem) => void;
}

function compactText(value?: string | null, fallback = 'None'): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

export const BacklogItemRow: React.FC<BacklogItemRowProps> = ({ item, selected, onSelect }) => (
  <button
    type="button"
    className={`backlog-card ${selected ? 'selected' : ''}`}
    onClick={() => onSelect(item)}
  >
    <div className="backlog-card-topline">
      <span className={`status-pill status-${item.status}`}>{humanize(item.status)}</span>
      <span className={`priority-pill priority-${item.priority}`}>{item.priority}</span>
    </div>
    <strong>{item.title}</strong>
    <p>{compactText(item.description || item.instructions, 'No detail yet')}</p>
    <div className="backlog-card-meta">
      <span>{item.type_name}</span>
      <span>{item.readiness_score}%</span>
      <span>{compactText(item.suggested_agent_role || item.proposed_agent_role, 'unassigned')}</span>
    </div>
  </button>
);
