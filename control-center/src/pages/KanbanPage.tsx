import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getAgents } from '../api/agents';
import { BackendHealth } from '../api/health';
import { BoardColumn, listBoardColumns } from '../api/kanban';
import {
  blockTask,
  createTask,
  deleteTask,
  getTask,
  getTasks,
  listTaskActivity,
  listTaskProgressUpdates,
  moveTask,
  reopenTask,
  unblockTask,
  updateTask,
} from '../api/tasks';
import {
  approveWorkReceipt,
  generateWorkReceipt,
  getTaskWorkReceipt,
  listTaskRuns,
  sendTaskBackToAgent,
  startAgentTaskRun,
} from '../api/taskRuns';
import { Agent } from '../types/agent';
import { CreateTaskInput, Task, TaskActivity, TaskProgressUpdate } from '../types/task';
import { TaskRun } from '../types/taskRun';
import { WorkReceipt } from '../types/workReceipt';
import { CreateTaskModal } from '../components/kanban/CreateTaskModal';
import { KanbanBoard } from '../components/kanban/KanbanBoard';
import { TaskDetailDrawer } from '../components/kanban/TaskDetailDrawer';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { PageShell } from '../components/common/PageShell';
import { useAppStore } from '../state/appStore';

type Filters = {
  search: string;
  agentId: string;
  priority: string;
  status: string;
  typeName: string;
  blockedOnly: boolean;
};

const defaultFilters: Filters = {
  search: '',
  agentId: '',
  priority: '',
  status: '',
  typeName: '',
  blockedOnly: false,
};

function startDisabledReason(task: Task | null, agent: Agent | undefined, health: BackendHealth | null): string | null {
  if (!task) return 'No task is selected.';
  if (health?.database_status !== 'ready') return `Database is ${health?.database_status || 'unknown'}.`;
  if (health?.camelid_status !== 'connected') {
    return `Camelid is ${health?.camelid_status || 'unknown'} at ${health?.camelid_endpoint || 'unknown endpoint'}.`;
  }
  if (!task.instructions?.trim()) return 'Task has no detailed instructions.';
  if (!task.assigned_agent_id) return 'No agent is assigned.';
  if (!agent) return 'Assigned agent could not be loaded.';
  if (!agent.model_name?.trim()) return `${agent.name} has no model assigned.`;
  return null;
}

function completeDisabledReason(task: Task | null, receipt: WorkReceipt | null): string | null {
  if (!task) return 'No task is selected.';
  if (!['review', 'in_progress'].includes(task.status)) return 'Task must be in Review or In Progress.';
  if (!receipt) return 'No work receipt exists yet.';
  return null;
}

function matchesFilters(task: Task, filters: Filters): boolean {
  const haystack = [task.title, task.description, task.instructions, task.labels].filter(Boolean).join(' ').toLowerCase();
  const search = filters.search.trim().toLowerCase();
  if (search && !haystack.includes(search)) return false;
  if (filters.agentId && task.assigned_agent_id !== filters.agentId) return false;
  if (filters.priority && task.priority !== filters.priority) return false;
  if (filters.status && task.status !== filters.status) return false;
  if (filters.typeName && task.type_name !== filters.typeName) return false;
  if (filters.blockedOnly && task.status !== 'blocked' && !task.blocked_reason) return false;
  return true;
}

export const KanbanPage: React.FC = () => {
  const { backendHealth, activeProjectId, focusedTaskId, setFocusedTaskId } = useAppStore();
  const workspaceId = backendHealth?.active_workspace_id || activeProjectId || 'default-workspace';
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activity, setActivity] = useState<TaskActivity[]>([]);
  const [progress, setProgress] = useState<TaskProgressUpdate[]>([]);
  const [runs, setRuns] = useState<TaskRun[]>([]);
  const [receipt, setReceipt] = useState<WorkReceipt | null>(null);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [createStatus, setCreateStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const selectedAgent = selectedTask?.assigned_agent_id ? agentsById.get(selectedTask.assigned_agent_id) : undefined;
  const filteredTasks = useMemo(() => tasks.filter((task) => matchesFilters(task, filters)), [tasks, filters]);

  const loadDetailById = useCallback(async (taskId: string | null) => {
    if (!taskId) {
      setSelectedTask(null);
      setActivity([]);
      setProgress([]);
      setRuns([]);
      setReceipt(null);
      return;
    }
    const [nextTask, nextActivity, nextProgress, nextRuns, nextReceipt] = await Promise.all([
      getTask(taskId),
      listTaskActivity(taskId),
      listTaskProgressUpdates(taskId),
      listTaskRuns(taskId),
      getTaskWorkReceipt(taskId),
    ]);
    setSelectedTask(nextTask);
    setActivity(nextActivity);
    setProgress(nextProgress);
    setRuns(nextRuns);
    setReceipt(nextReceipt);
  }, []);

  const loadBoard = useCallback(async () => {
    setError(null);
    const [nextColumns, nextTasks, nextAgents] = await Promise.all([
      listBoardColumns(workspaceId),
      getTasks(),
      getAgents(),
    ]);
    setColumns(nextColumns.sort((a, b) => a.rank - b.rank));
    setTasks(nextTasks);
    setAgents(nextAgents);
    const taskToFocus = focusedTaskId
      ? nextTasks.find((task) => task.id === focusedTaskId) || null
      : selectedTask
        ? nextTasks.find((task) => task.id === selectedTask.id) || null
        : null;
    if (taskToFocus) {
      if (focusedTaskId) setFocusedTaskId(null);
      await loadDetailById(taskToFocus.id);
    }
  }, [workspaceId, selectedTask?.id, focusedTaskId, setFocusedTaskId, loadDetailById]);

  useEffect(() => {
    setLoading(true);
    loadBoard()
      .catch((err: any) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [loadBoard]);

  useEffect(() => {
    loadDetailById(selectedTask?.id || null).catch((err: any) => setError(String(err)));
  }, [selectedTask?.id, loadDetailById]);

  const refreshSelected = async (taskId?: string | null) => {
    await loadBoard();
    await loadDetailById(taskId ?? selectedTask?.id ?? null);
  };

  const runTaskAction = async (
    action: () => Promise<Task | void | WorkReceipt | TaskRun>,
    taskForDetail = selectedTask,
  ) => {
    setBusy(true);
    setError(null);
    try {
      const taskId = taskForDetail?.id || selectedTask?.id || null;
      await action();
      await refreshSelected(taskId);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <PageShell title="Kanban"><LoadingState /></PageShell>;
  }

  const startReason = startDisabledReason(selectedTask, selectedAgent, backendHealth);
  const doneReason = completeDisabledReason(selectedTask, receipt);

  return (
    <PageShell title="Kanban">
      <div className="kanban-page">
        <header className="kanban-page-header">
          <div>
            <span className="eyebrow">Agent Work Board</span>
            <h1>Kanban</h1>
            <p>Create detailed work, assign agents, track progress, and close only with a receipt.</p>
          </div>
          <div className="kanban-header-actions">
            <button type="button" className="secondary-button" onClick={() => loadBoard().catch((err: any) => setError(String(err)))}>
              Refresh
            </button>
            <button type="button" onClick={() => setCreateStatus('backlog')}>Create Task</button>
          </div>
        </header>

        <div className="kanban-filters" aria-label="Board filters">
          <input
            value={filters.search}
            onChange={(event) => setFilters((value) => ({ ...value, search: event.target.value }))}
            placeholder="Search title, description, instructions"
          />
          <select value={filters.agentId} onChange={(event) => setFilters((value) => ({ ...value, agentId: event.target.value }))}>
            <option value="">All agents</option>
            {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
          </select>
          <select value={filters.priority} onChange={(event) => setFilters((value) => ({ ...value, priority: event.target.value }))}>
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <select value={filters.status} onChange={(event) => setFilters((value) => ({ ...value, status: event.target.value }))}>
            <option value="">All statuses</option>
            {columns.map((column) => <option key={column.id} value={column.status_mapping}>{column.name}</option>)}
          </select>
          <select value={filters.typeName} onChange={(event) => setFilters((value) => ({ ...value, typeName: event.target.value }))}>
            <option value="">All types</option>
            <option value="task">Task</option>
            <option value="bug">Bug</option>
            <option value="feature">Feature</option>
            <option value="research">Research</option>
            <option value="documentation">Documentation</option>
            <option value="test">Test</option>
          </select>
          <label className="kanban-filter-check">
            <input
              type="checkbox"
              checked={filters.blockedOnly}
              onChange={(event) => setFilters((value) => ({ ...value, blockedOnly: event.target.checked }))}
            />
            Blocked only
          </label>
        </div>

        {error && <ErrorState message={error} />}

        <div className="kanban-workspace">
          <KanbanBoard
            columns={columns}
            tasks={filteredTasks}
            agents={agents}
            selectedTaskId={selectedTask?.id}
            onSelectTask={setSelectedTask}
            onCreateTask={setCreateStatus}
            onMoveTask={(taskId, status) => runTaskAction(async () => moveTask(taskId, status), tasks.find((task) => task.id === taskId) || null)}
          />

          <TaskDetailDrawer
            task={selectedTask}
            agents={agents}
            activity={activity}
            progress={progress}
            runs={runs}
            receipt={receipt}
            backendHealth={backendHealth}
            busy={busy}
            error={error}
            startDisabledReason={startReason}
            completeDisabledReason={doneReason}
            onClose={() => setSelectedTask(null)}
            onSave={(fields) => runTaskAction(async () => selectedTask ? updateTask(selectedTask.id, fields) : undefined)}
            onMove={(status) => runTaskAction(async () => selectedTask ? moveTask(selectedTask.id, status) : undefined)}
            onStartWork={() => runTaskAction(async () => selectedTask ? startAgentTaskRun(selectedTask.id) : undefined)}
            onGenerateReceipt={() => runTaskAction(async () => selectedTask ? generateWorkReceipt(selectedTask.id) : undefined)}
            onApproveReceipt={() => runTaskAction(async () => selectedTask && receipt ? approveWorkReceipt(selectedTask.id, receipt.id) : undefined)}
            onSendBack={(feedback) => runTaskAction(async () => selectedTask ? sendTaskBackToAgent(selectedTask.id, feedback) : undefined)}
            onBlock={() => {
              const reason = window.prompt('Why is this task blocked?');
              return reason ? runTaskAction(async () => selectedTask ? blockTask(selectedTask.id, reason) : undefined) : Promise.resolve();
            }}
            onUnblock={() => runTaskAction(async () => selectedTask ? unblockTask(selectedTask.id) : undefined)}
            onReopen={() => runTaskAction(async () => selectedTask ? reopenTask(selectedTask.id, 'Reopened from board') : undefined)}
            onDelete={async () => {
              if (!selectedTask || !window.confirm(`Delete ${selectedTask.task_key || selectedTask.title}?`)) return;
              await runTaskAction(async () => {
                await deleteTask(selectedTask.id);
                setSelectedTask(null);
              }, null);
            }}
          />
        </div>

        {createStatus && (
          <CreateTaskModal
            agents={agents}
            initialStatus={createStatus}
            onClose={() => setCreateStatus(null)}
            onCreate={async (input: CreateTaskInput) => {
              const task = await createTask({ ...input, workspace_id: workspaceId });
              setCreateStatus(null);
              await refreshSelected(task.id);
            }}
          />
        )}
      </div>
    </PageShell>
  );
};
