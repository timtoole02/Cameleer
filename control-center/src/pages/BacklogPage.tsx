import React, { useEffect, useMemo, useState } from 'react';
import { getAgents } from '../api/agents';
import { convertBacklogItemToCard, createBacklogItem, getBacklogSnapshot, updateBacklogItem } from '../api/backlog';
import { getTask } from '../api/tasks';
import { BacklogItem, CreateBacklogItemInput, UpdateBacklogItemInput } from '../types';
import { Agent } from '../types/agent';
import { Task } from '../types/task';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { PageShell } from '../components/common/PageShell';
import { BacklogDetailDrawer } from '../components/backlog/BacklogDetailDrawer';
import { BacklogList } from '../components/backlog/BacklogList';
import { BacklogReadinessPanel } from '../components/backlog/BacklogReadinessPanel';
import { ConvertToTaskPanel } from '../components/backlog/ConvertToTaskPanel';
import { CreateBacklogItemModal } from '../components/backlog/CreateBacklogItemModal';
import { PrioritySelector } from '../components/kanban/PrioritySelector';
import { useAppStore } from '../state/appStore';

const statuses = [
  { id: 'captured', label: 'Captured' },
  { id: 'triage', label: 'Triage' },
  { id: 'needs_refinement', label: 'Needs Refinement' },
  { id: 'refined', label: 'Refined' },
  { id: 'ready', label: 'Ready' },
  { id: 'converted', label: 'Converted' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'archived', label: 'Archived' },
];

const priorities = ['low', 'medium', 'high', 'critical'];
const types = ['task', 'bug', 'feature', 'research', 'documentation', 'test', 'chore', 'idea'];
const risks = ['low', 'medium', 'high', 'unknown'];

type BacklogForm = {
  title: string;
  description: string;
  instructions: string;
  type_name: string;
  priority: string;
  risk_level: string;
  labels: string;
  owner_agent_id: string;
  suggested_agent_role: string;
  acceptance_criteria: string;
  definition_of_done: string;
  dependencies: string;
  effort_estimate: string;
  rejected_reason: string;
};

const emptyForm: BacklogForm = {
  title: '',
  description: '',
  instructions: '',
  type_name: 'task',
  priority: 'medium',
  risk_level: 'unknown',
  labels: '',
  owner_agent_id: '',
  suggested_agent_role: '',
  acceptance_criteria: '',
  definition_of_done: '',
  dependencies: '',
  effort_estimate: '',
  rejected_reason: '',
};

function toForm(item: BacklogItem | null): BacklogForm {
  if (!item) return emptyForm;
  return {
    title: item.title || '',
    description: item.description || '',
    instructions: item.instructions || '',
    type_name: item.type_name || 'task',
    priority: item.priority || 'medium',
    risk_level: item.risk_level || 'unknown',
    labels: item.labels || '',
    owner_agent_id: item.owner_agent_id || '',
    suggested_agent_role: item.suggested_agent_role || item.proposed_agent_role || '',
    acceptance_criteria: item.acceptance_criteria || '',
    definition_of_done: item.definition_of_done || '',
    dependencies: item.dependencies || '',
    effort_estimate: item.effort_estimate || '',
    rejected_reason: item.rejected_reason || '',
  };
}

function readinessMissing(form: BacklogForm): string[] {
  const missing: string[] = [];
  if (!form.title.trim()) missing.push('title');
  if (!form.description.trim() && !form.instructions.trim()) missing.push('description or instructions');
  if (!form.type_name.trim()) missing.push('type');
  if (!form.priority.trim()) missing.push('priority');
  if (!form.acceptance_criteria.trim()) missing.push('acceptance criteria');
  if (!form.owner_agent_id.trim() && !form.suggested_agent_role.trim()) missing.push('assigned or suggested agent');
  return missing;
}

function readinessScore(form: BacklogForm): number {
  const presentFields = [
    form.title.trim(),
    form.description.trim() || form.instructions.trim(),
    form.type_name.trim(),
    form.priority.trim(),
    form.acceptance_criteria.trim(),
    form.owner_agent_id.trim() || form.suggested_agent_role.trim(),
  ].filter(Boolean).length;

  return Math.round((presentFields / 6) * 100);
}

function readinessLabel(score: number): string {
  if (score >= 90) return 'Ready';
  if (score >= 70) return 'Refined';
  if (score >= 40) return 'Needs refinement';
  return 'Captured';
}

function displayDate(value?: string): string {
  if (!value) return 'unknown';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function humanize(value: string): string {
  return value.replace(/_/g, ' ');
}

function toCreateInput(workspaceId: string, form: BacklogForm): CreateBacklogItemInput {
  return {
    workspace_id: workspaceId,
    title: form.title.trim(),
    description: form.description.trim() || null,
    instructions: form.instructions.trim() || null,
    type_name: form.type_name,
    priority: form.priority,
    risk_level: form.risk_level,
    labels: form.labels.trim() || null,
    owner_agent_id: form.owner_agent_id || null,
    suggested_agent_role: form.suggested_agent_role.trim() || null,
    acceptance_criteria: form.acceptance_criteria.trim() || null,
    definition_of_done: form.definition_of_done.trim() || null,
    dependencies: form.dependencies.trim() || null,
    effort_estimate: form.effort_estimate.trim() || null,
  };
}

function toUpdateInput(form: BacklogForm, status?: string): UpdateBacklogItemInput {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    instructions: form.instructions.trim() || null,
    type_name: form.type_name,
    priority: form.priority,
    status,
    labels: form.labels.trim() || null,
    risk_level: form.risk_level,
    effort_estimate: form.effort_estimate.trim() || null,
    owner_agent_id: form.owner_agent_id || null,
    suggested_agent_role: form.suggested_agent_role.trim() || null,
    acceptance_criteria: form.acceptance_criteria.trim() || null,
    definition_of_done: form.definition_of_done.trim() || null,
    dependencies: form.dependencies.trim() || null,
    rejected_reason: form.rejected_reason.trim() || null,
  };
}

export const BacklogPage: React.FC = () => {
  const { backendHealth, activeProjectId, setActiveTab, setFocusedTaskId } = useAppStore();
  const workspaceId = backendHealth?.active_workspace_id || activeProjectId || 'default-workspace';
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [convertedTask, setConvertedTask] = useState<Task | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<BacklogForm>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [view, setView] = useState<'status' | 'priority' | 'agent'>('status');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = useMemo(() => items.find((item) => item.id === selectedId) || null, [items, selectedId]);
  const missing = readinessMissing(form);
  const currentReadinessScore = readinessScore(form);
  const canConvertToKanban = Boolean(selected) && !creating && selected?.status !== 'converted' && missing.length === 0;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => [
      item.title,
      item.description,
      item.instructions,
      item.labels,
      item.suggested_agent_role,
      item.proposed_agent_role,
      item.status,
      item.priority,
      item.type_name,
    ].filter(Boolean).join(' ').toLowerCase().includes(needle));
  }, [items, search]);

  const groups = useMemo(() => {
    if (view === 'priority') {
      return priorities.map((priority) => ({ id: priority, label: priority, items: filtered.filter((item) => item.priority === priority) }));
    }
    if (view === 'agent') {
      const roles = Array.from(new Set(filtered.map((item) => item.suggested_agent_role || item.proposed_agent_role || 'unassigned')));
      return roles.sort().map((role) => ({ id: role, label: role, items: filtered.filter((item) => (item.suggested_agent_role || item.proposed_agent_role || 'unassigned') === role) }));
    }
    return statuses.map((status) => ({ ...status, items: filtered.filter((item) => item.status === status.id) }));
  }, [filtered, view]);

  const loadBacklog = async (preferredId?: string | null) => {
    setError(null);
    const [next, nextAgents] = await Promise.all([getBacklogSnapshot(workspaceId), getAgents()]);
    setItems(next);
    setAgents(nextAgents);
    const nextSelected = preferredId ? next.find((item) => item.id === preferredId) : selectedId ? next.find((item) => item.id === selectedId) : null;
    if (nextSelected) {
      setSelectedId(nextSelected.id);
      setForm(toForm(nextSelected));
      setCreating(false);
    } else if (!creating) {
      setSelectedId(next[0]?.id || null);
      setForm(toForm(next[0] || null));
    }
  };

  useEffect(() => {
    setLoading(true);
    loadBacklog()
      .catch((err: any) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  useEffect(() => {
    if (!selected?.converted_card_id) {
      setConvertedTask(null);
      return;
    }
    getTask(selected.converted_card_id)
      .then(setConvertedTask)
      .catch(() => setConvertedTask(null));
  }, [selected?.converted_card_id]);

  const selectItem = (item: BacklogItem) => {
    setCreating(false);
    setSelectedId(item.id);
    setForm(toForm(item));
  };

  const startCreate = () => {
    setCreating(true);
    setSelectedId(null);
    setForm(emptyForm);
  };

  const run = async (action: () => Promise<BacklogItem | void>, preferredId?: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      await loadBacklog((result as BacklogItem | undefined)?.id || preferredId || selectedId);
    } catch (err: any) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async (status?: string) => {
    if (!form.title.trim()) {
      setError('Title is required.');
      return;
    }
    if (creating) {
      await run(() => createBacklogItem({ ...toCreateInput(workspaceId, form), ...(status ? { status } : {}) } as CreateBacklogItemInput));
      setCreating(false);
      return;
    }
    if (selected) {
      await run(() => updateBacklogItem(selected.id, toUpdateInput(form, status)), selected.id);
    }
  };

  const convert = async () => {
    if (!selected) return;
    await run(async () => {
      await updateBacklogItem(selected.id, toUpdateInput(form, 'ready'));
      const card = await convertBacklogItemToCard(selected.id);
      setConvertedTask(card as unknown as Task);
    }, selected.id);
  };

  const openConvertedTask = () => {
    const taskId = selected?.converted_card_id || convertedTask?.id;
    if (!taskId) return;
    setFocusedTaskId(taskId);
    setActiveTab('Kanban');
  };

  const convertDisabledReason = creating
    ? 'save the backlog item first'
    : missing.length
      ? `missing ${missing.join(', ')}`
      : selected?.status === 'converted'
        ? 'item is already converted'
        : null;

  if (loading) return <PageShell title="Backlog"><LoadingState /></PageShell>;

  return (
    <PageShell title="Backlog">
      <div className="backlog-page">
        <header className="kanban-page-header">
          <div>
            <span className="eyebrow">Planning intake</span>
            <h1>Backlog</h1>
            <p>Capture rough ideas, refine them into executable tasks, then promote only ready work to Kanban.</p>
          </div>
          <div className="kanban-header-actions">
            <button type="button" className="secondary-button" onClick={() => loadBacklog().catch((err: any) => setError(String(err)))}>
              Refresh
            </button>
            <CreateBacklogItemModal onCreate={startCreate} />
          </div>
        </header>

        <div className="backlog-toolbar">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search backlog" />
          <div className="backlog-view-toggle" aria-label="Backlog view">
            {(['status', 'priority', 'agent'] as const).map((nextView) => (
              <button
                key={nextView}
                type="button"
                className={view === nextView ? 'active' : ''}
                onClick={() => setView(nextView)}
              >
                {nextView}
              </button>
            ))}
          </div>
        </div>

        {error && <ErrorState message={error} />}

        <div className="backlog-workspace">
          <BacklogList groups={groups} selectedId={selectedId} onSelectItem={selectItem} />

          <BacklogDetailDrawer>
            <div className="drawer-header">
              <div>
                <span className="eyebrow">{creating ? 'New intake' : selected ? humanize(selected.status) : 'No item selected'}</span>
                <h2>{creating ? 'Create backlog item' : selected?.title || 'Select an item'}</h2>
              </div>
            </div>

            {(creating || selected) ? (
              <>
                <BacklogReadinessPanel score={currentReadinessScore} label={readinessLabel(currentReadinessScore)} missing={missing} />

                <div className="backlog-form">
                  <label className="kanban-field">
                    <span>Title</span>
                    <input value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} />
                  </label>
                  <label className="kanban-field">
                    <span>Description</span>
                    <textarea rows={3} value={form.description} onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))} />
                  </label>
                  <label className="kanban-field">
                    <span>Instructions</span>
                    <textarea rows={5} value={form.instructions} onChange={(event) => setForm((value) => ({ ...value, instructions: event.target.value }))} />
                  </label>
                  <label className="kanban-field">
                    <span>Acceptance criteria</span>
                    <textarea rows={4} value={form.acceptance_criteria} onChange={(event) => setForm((value) => ({ ...value, acceptance_criteria: event.target.value }))} />
                  </label>
                  <div className="kanban-form-grid">
                    <label className="kanban-field">
                      <span>Type</span>
                      <select value={form.type_name} onChange={(event) => setForm((value) => ({ ...value, type_name: event.target.value }))}>
                        {types.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    <label className="kanban-field">
                      <span>Priority</span>
                      <PrioritySelector
                        value={form.priority}
                        onChange={(priority) => setForm((value) => ({ ...value, priority }))}
                      />
                    </label>
                  </div>
                  <div className="kanban-form-grid">
                    <label className="kanban-field">
                      <span>Risk</span>
                      <select value={form.risk_level} onChange={(event) => setForm((value) => ({ ...value, risk_level: event.target.value }))}>
                        {risks.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
                      </select>
                    </label>
                    <label className="kanban-field">
                      <span>Effort</span>
                      <input value={form.effort_estimate} onChange={(event) => setForm((value) => ({ ...value, effort_estimate: event.target.value }))} placeholder="S / M / L or points" />
                    </label>
                  </div>
                  <label className="kanban-field">
                    <span>Assigned agent</span>
                    <select value={form.owner_agent_id} onChange={(event) => setForm((value) => ({ ...value, owner_agent_id: event.target.value }))}>
                      <option value="">Unassigned</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.name} - {agent.role || 'Agent'} - {agent.model_name || 'No model'} - {agent.status || 'unknown'}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="kanban-field">
                    <span>Suggested agent role</span>
                    <input value={form.suggested_agent_role} onChange={(event) => setForm((value) => ({ ...value, suggested_agent_role: event.target.value }))} placeholder="Frontend Engineer, QA, Backend Engineer" />
                  </label>
                  <label className="kanban-field">
                    <span>Labels</span>
                    <input value={form.labels} onChange={(event) => setForm((value) => ({ ...value, labels: event.target.value }))} />
                  </label>
                  <label className="kanban-field">
                    <span>Dependencies</span>
                    <textarea rows={2} value={form.dependencies} onChange={(event) => setForm((value) => ({ ...value, dependencies: event.target.value }))} />
                  </label>
                  <label className="kanban-field">
                    <span>Definition of done</span>
                    <textarea rows={3} value={form.definition_of_done} onChange={(event) => setForm((value) => ({ ...value, definition_of_done: event.target.value }))} />
                  </label>
                  {form.rejected_reason || selected?.status === 'rejected' ? (
                    <label className="kanban-field">
                      <span>Rejected reason</span>
                      <textarea rows={2} value={form.rejected_reason} onChange={(event) => setForm((value) => ({ ...value, rejected_reason: event.target.value }))} />
                    </label>
                  ) : null}
                </div>

                <div className="drawer-section">
                  <h3>Actions</h3>
                  <div className="backlog-action-grid">
                    <button type="button" disabled={busy} onClick={() => save()}>{busy ? 'Saving...' : 'Save'}</button>
                    <button type="button" className="secondary-button" disabled={busy} onClick={() => save('needs_refinement')}>Needs refinement</button>
                    <button type="button" className="secondary-button" disabled={busy} onClick={() => save('refined')}>Mark refined</button>
                    <button type="button" className="secondary-button" disabled={busy || missing.length > 0} onClick={() => save('ready')}>Mark ready</button>
                    <button type="button" className="secondary-button" disabled={busy} onClick={() => save('archived')}>Archive</button>
                  </div>
                  <ConvertToTaskPanel
                    convertedLabel={selected?.status === 'converted' || selected?.converted_card_id ? convertedTask?.task_key || selected?.converted_card_id || 'Kanban task' : null}
                    canConvert={canConvertToKanban}
                    disabledReason={convertDisabledReason}
                    busy={busy}
                    onConvert={convert}
                    onOpenTask={openConvertedTask}
                  />
                </div>

                {selected ? (
                  <div className="drawer-meta-grid">
                    <span>Updated</span><strong>{displayDate(selected.updated_at)}</strong>
                    <span>Created</span><strong>{displayDate(selected.created_at)}</strong>
                    <span>Converted</span><strong>{selected.converted_card_id || 'No'}</strong>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="drawer-empty">
                <strong>No backlog item selected</strong>
                <span>Create or select an intake item to refine it.</span>
              </div>
            )}
          </BacklogDetailDrawer>
        </div>
      </div>
    </PageShell>
  );
};
