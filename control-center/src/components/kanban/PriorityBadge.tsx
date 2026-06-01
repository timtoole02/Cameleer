import React from 'react';

interface PriorityBadgeProps {
  priority?: string | null;
}

const labels: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export const PriorityBadge: React.FC<PriorityBadgeProps> = ({ priority }) => {
  const normalized = (priority || 'medium').toLowerCase();
  return (
    <span className={`kanban-pill priority-${normalized}`}>
      {labels[normalized] || normalized}
    </span>
  );
};
