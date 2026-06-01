import React from 'react';

interface StatusBadgeProps {
  status?: string | null;
}

const labels: Record<string, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  in_progress: 'In Progress',
  review: 'Review',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = (status || 'backlog').toLowerCase().replace(/ /g, '_');
  return (
    <span className={`kanban-pill status-${normalized}`}>
      {labels[normalized] || normalized}
    </span>
  );
};
