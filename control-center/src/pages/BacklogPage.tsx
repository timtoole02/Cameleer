import React, { useEffect, useMemo, useState } from 'react';
import { convertBacklogItemToCard, createBacklogItem, getBacklogSnapshot, updateBacklogItem } from '../api/backlog';
import { BacklogItem, CreateBacklogItemInput, UpdateBacklogItemInput } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { PageShell } from '../components/common/PageShell';
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
  if (!form.suggested_agent_role.trim()) missing.push('suggested agent');
  return missing;
}

function readinessScore(form: BacklogForm): number {
  const presentFields = [
    form.title.trim(),
    form.description.trim() || form.instructions.trim(),
    form.type_name.trim(),
    form.priority.trim(),
    form.acceptance_criteria.trim(),
    form.suggested_agent_role.trim(),
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

function compactText(value?: string | null, fallback = 'None'): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
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
    suggested_agent_role: form.suggested_agent_role.trim() || null,
    acceptance_criteria: form.acceptance_criteria.trim() || null,
    definition_of_done: form.definition_of_done.trim() || null,
    dependencies: form.dependencies.trim() || null,
    rejected_reason: form.rejected_reason.trim() || null,
  };
}

export const BacklogPage: React.FC = () => {
  const { backendHealth, activeProjectId } = useAppStore();
  const workspaceId = backendHealth?.active_workspace_id || activeProjectId || 'default-workspace';
  const [items, setItems] = useState<BacklogItem[]>([]);
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
    const next = await getBacklogSnapshot(workspaceId);
    setItems(next);
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
      await convertBacklogItemToCard(selected.id);
    }, selected.id);
  };

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
            <button type="button" onClick={startCreate}>New item</button>
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
          <section className="backlog-list" aria-label="Backlog items">
            {groups.map((group) => (
              <div key={group.id} className="backlog-group">
                <div className="backlog-group-header">
                  <h2>{group.label}</h2>
                  <span>{group.items.length}</span>
                </div>
                <div className="backlog-card-stack">
                  {group.items.length === 0 ? (
                    <div className="backlog-empty">No items</div>
                  ) : group.items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`backlog-card ${selectedId === item.id ? 'selected' : ''}`}
                      onClick={() => selectItem(item)}
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
                  ))}
                </div>
              </div>
            ))}
          </section>

          <aside className="backlog-drawer">
            <div className="drawer-header">
              <div>
                <span className="eyebrow">{creating ? 'New intake' : selected ? humanize(selected.status) : 'No item selected'}</span>
                <h2>{creating ? 'Create backlog item' : selected?.title || 'Select an item'}</h2>
              </div>
            </div>

            {(creating || selected) ? (
              <>
                <div className="readiness-panel">
                  <div>
                    <strong>{readinessLabel(currentReadinessScore)}</strong>
                    <span>{currentReadinessScore}% ready</span>
                  </div>
                  <progress max={100} value={currentReadinessScore} />
                  {missing.length > 0 ? (
                    <p>Missing: {missing.join(', ')}</p>
                  ) : (
                    <p>Ready fields are present. Promote when the task belongs on the execution board.</p>
                  )}
                </div>

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
                      <select value={form.priority} onChange={(event) => setForm((value) => ({ ...value, priority: event.target.value }))}>
                        {priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                      </select>
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
                    <button type="button" disabled={busy || missing.length > 0 || selected?.status === 'converted'} onClick={convert}>Convert to Kanban</button>
                    <button type="button" className="secondary-button" disabled={busy} onClick={() => save('archived')}>Archive</button>
                  </div>
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
          </aside>
        </div>
      </div>
    </PageShell>
  );
};
