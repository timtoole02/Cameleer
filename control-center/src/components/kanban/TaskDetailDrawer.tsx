import React from 'react';
import { BackendHealth } from '../../api/health';
import { Agent } from '../../types/agent';
import { CreateTaskInput, Task, TaskActivity, TaskProgressUpdate } from '../../types/task';
import { TaskRun } from '../../types/taskRun';
import { WorkReceipt } from '../../types/workReceipt';
import { AgentRunPanel } from './AgentRunPanel';
import { EditTaskForm } from './EditTaskForm';
import { PriorityBadge } from './PriorityBadge';
import { StatusBadge } from './StatusBadge';
import { TaskActivityTimeline } from './TaskActivityTimeline';
import { WorkReceiptPanel } from './WorkReceiptPanel';

interface TaskDetailDrawerProps {
  task: Task | null;
  agents: Agent[];
  activity: TaskActivity[];
  progress: TaskProgressUpdate[];
  runs: TaskRun[];
  receipt: WorkReceipt | null;
  backendHealth: BackendHealth | null;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (fields: Partial<CreateTaskInput> & { blocked_reason?: string | null }) => Promise<void>;
  onMove: (status: string) => Promise<void>;
  onStartWork: () => Promise<void>;
  onGenerateReceipt: () => Promise<void>;
  onApproveReceipt: () => Promise<void>;
  onSendBack: (feedback: string) => Promise<void>;
  onBlock: () => Promise<void>;
  onUnblock: () => Promise<void>;
  onReopen: () => Promise<void>;
  onDelete: () => Promise<void>;
  startDisabledReason: string | null;
  completeDisabledReason: string | null;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  task,
  agents,
  activity,
  progress,
  runs,
  receipt,
  backendHealth,
  busy,
  error,
  onClose,
  onSave,
  onMove,
  onStartWork,
  onGenerateReceipt,
  onApproveReceipt,
  onSendBack,
  onBlock,
  onUnblock,
  onReopen,
  onDelete,
  startDisabledReason,
  completeDisabledReason,
}) => {
  const agentsById = React.useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const agent = task?.assigned_agent_id ? agentsById.get(task.assigned_agent_id) : undefined;

  if (!task) {
    return (
      <aside className="task-drawer empty">
        <div className="drawer-empty">
          <strong>Select a task</strong>
          <p>Task instructions, activity, agent work, and receipts will appear here.</p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="task-drawer">
      <div className="drawer-header">
        <div>
          <span className="task-key">{task.task_key || task.id.slice(0, 8)}</span>
          <h2>{task.title}</h2>
          <div className="drawer-badges">
            <StatusBadge status={task.status} />
            <PriorityBadge priority={task.priority} />
            <span className="kanban-pill neutral">{task.type_name || 'task'}</span>
          </div>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Close task">x</button>
      </div>

      {error && <div className="kanban-error">{error}</div>}

      <section className="drawer-section">
        <h3>Assignment</h3>
        <div className="drawer-meta-grid">
          <span>Agent</span>
          <strong>{agent?.name || 'Unassigned'}</strong>
          <span>Role</span>
          <strong>{agent?.role || 'No role'}</strong>
          <span>Model</span>
          <strong>{agent?.model_name || 'No model assigned'}</strong>
          <span>Backend</span>
          <strong>{backendHealth?.camelid_status || 'unknown'}</strong>
        </div>
      </section>

      <section className="drawer-section actions">
        {startDisabledReason && <div className="kanban-warning">Start disabled: {startDisabledReason}</div>}
        {completeDisabledReason && <div className="kanban-warning">Complete disabled: {completeDisabledReason}</div>}
        <div className="drawer-action-grid">
          <button type="button" onClick={onStartWork} disabled={busy || Boolean(startDisabledReason)}>Start Work</button>
          <button type="button" className="secondary-button" onClick={() => onMove('review')} disabled={busy}>Move to Review</button>
          <button type="button" className="secondary-button" onClick={() => onMove('ready')} disabled={busy}>Move to Ready</button>
          <button type="button" onClick={onApproveReceipt} disabled={busy || Boolean(completeDisabledReason)}>Complete</button>
          {task.status === 'blocked' ? (
            <button type="button" className="secondary-button" onClick={onUnblock} disabled={busy}>Unblock</button>
          ) : (
            <button type="button" className="secondary-button" onClick={onBlock} disabled={busy}>Block</button>
          )}
          <button type="button" className="secondary-button" onClick={onReopen} disabled={busy}>Reopen</button>
        </div>
      </section>

      <EditTaskForm task={task} agents={agents} onSave={onSave} />

      <AgentRunPanel runs={runs} progress={progress} agentsById={agentsById} />
      <WorkReceiptPanel
        receipt={receipt}
        agentsById={agentsById}
        busy={busy}
        onGenerate={onGenerateReceipt}
        onApprove={onApproveReceipt}
        onSendBack={onSendBack}
      />
      <TaskActivityTimeline activity={activity} />

      <section className="drawer-section danger-zone">
        <h3>Danger zone</h3>
        <button type="button" className="danger-button" onClick={onDelete} disabled={busy}>Delete task</button>
      </section>
    </aside>
  );
};
