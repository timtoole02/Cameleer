import React from 'react';
import { Agent } from '../../types/agent';
import { Task } from '../../types/task';
import { parseAcceptanceCriteria } from './AcceptanceCriteriaEditor';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';

interface TaskCardProps {
  task: Task;
  agent?: Agent;
  selected?: boolean;
  onSelect: (task: Task) => void;
  onDragStart: (taskId: string, event: React.DragEvent<HTMLButtonElement>) => void;
}

function formatUpdated(value?: string | null): string {
  if (!value) return 'Updated recently';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Updated recently';
  const diff = Date.now() - timestamp;
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  return `Updated ${Math.round(hours / 24)}d ago`;
}

function labelsFor(task: Task): string[] {
  return (task.labels || '')
    .split(',')
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, agent, selected, onSelect, onDragStart }) => {
  const criteriaCount = parseAcceptanceCriteria(task.acceptance_criteria).length;
  const labels = labelsFor(task);

  return (
    <button
      className={`kanban-task-card ${selected ? 'selected' : ''}`}
      onClick={() => onSelect(task)}
      draggable
      onDragStart={(event) => onDragStart(task.id, event)}
    >
      <div className="task-card-topline">
        <span className="task-key">{task.task_key || task.id.slice(0, 8)}</span>
        <StatusBadge status={task.status} />
      </div>
      <strong className="task-title">{task.title}</strong>
      {task.blocked_reason && <span className="task-blocked">Blocked: {task.blocked_reason}</span>}
      <div className="task-card-meta">
        <PriorityBadge priority={task.priority} />
        <span>{task.type_name || 'task'}</span>
      </div>
      <div className="task-card-footer">
        <span>Assigned: {agent?.name || 'Unassigned'}</span>
        <span>{criteriaCount} criteria</span>
      </div>
      {task.status === 'done' || task.work_receipt_id ? (
        <span className="receipt-state">{task.work_receipt_id ? 'Receipt attached' : 'Receipt required'}</span>
      ) : null}
      {labels.length > 0 && (
        <div className="task-labels">
          {labels.map((label) => <span key={label}>{label}</span>)}
        </div>
      )}
      <span className="task-updated">{formatUpdated(task.updated_at)}</span>
    </button>
  );
};
