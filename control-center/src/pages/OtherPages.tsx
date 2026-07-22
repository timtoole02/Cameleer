import React, { useEffect, useState } from 'react';
import { getAgentRuns, getPendingCommandApproval, resolveCommandApproval } from '../api/runtime';
import { getMissionAuditEvents, AuditEvent } from '../api/audit';
import { AgentRun, CommandApproval } from '../types';
import { PageShell } from '../components/common/PageShell';
import { useAppStore } from '../state/appStore';
import { resetDevDatabase, getBackendHealth } from '../api/health';
import { getMemories, searchMemories, createMemory, deleteMemory, Memory } from '../api/memory';
import { getCoordinationDetails, recordDecision, resolveHandoff, Decision, Handoff } from '../api/context';

const statePillClass = (state: string) => {
  const s = state.toLowerCase();
  if (s.includes('fail') || s.includes('error') || s.includes('cancel')) return 'pill pill-danger';
  if (s.includes('run') || s.includes('pend') || s.includes('wait')) return 'pill pill-warning';
  if (s.includes('done') || s.includes('complete') || s.includes('success')) return 'pill pill-success';
  return 'pill pill-neutral';
};

export const RuntimePage: React.FC = () => {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [approvals, setApprovals] = useState<CommandApproval[]>([]);

  useEffect(() => {
    getAgentRuns().then(setRuns).catch(console.error);
    getPendingCommandApproval("default-workspace").then(setApprovals).catch(console.error);
  }, []);

  const handleApprove = async (id: string, approved: boolean) => {
    await resolveCommandApproval(id, approved);
    const updated = await getPendingCommandApproval("default-workspace");
    setApprovals(updated);
  };

  return (
    <PageShell title="Runtime & Execution">
      <div className="page-stack">
        <div className="panel">
          <h4 className="panel-title">Pending Approvals ({approvals.length})</h4>
          {approvals.length === 0 ? <p className="text-muted">No pending approvals.</p> : (
            <ul className="list-plain">
              {approvals.map(a => (
                <li key={a.id} className="list-row">
                  <div className="min-w-0">
                    <strong>{a.tool_name}</strong>
                    <pre className="mono-well">{a.arguments}</pre>
                  </div>
                  <div className="row-actions">
                    <button onClick={() => handleApprove(a.invocation_id, true)} className="success-button">Approve</button>
                    <button onClick={() => handleApprove(a.invocation_id, false)} className="danger-button">Deny</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <h4 className="panel-title">Agent Runs</h4>
          {runs.length === 0 ? <p className="text-muted">No agents are currently running.</p> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent ID</th>
                  <th>State</th>
                  <th>Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id}>
                    <td>{r.agent_id}</td>
                    <td><span className={statePillClass(r.state)}>{r.state}</span></td>
                    <td className="cell-muted">{r.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export const AuditPage: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    getMissionAuditEvents("default-workspace").then(setEvents).catch(console.error);
  }, []);

  return (
    <PageShell title="Audit Log">
      <div className="page-stack">
        <div className="panel panel-scroll">
          {events.length === 0 ? <p className="text-muted">No events logged.</p> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Payload</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id}>
                    <td className="cell-muted">{e.timestamp}</td>
                    <td><span className="pill pill-neutral">{e.event_type}</span></td>
                    <td>
                      <pre className="cell-pre">{e.payload}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export const SettingsPage: React.FC = () => {
  const { backendHealth, setBackendHealth } = useAppStore();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await resetDevDatabase();
      const updatedHealth = await getBackendHealth();
      setBackendHealth(updatedHealth);
      setMessage(`Success: ${res}`);
      setConfirming(false);
    } catch (err: any) {
      setMessage(`Error: ${err.toString()}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="Settings">
      <div className="settings-stack">
        <div className="panel">
          <h3 className="panel-title">System Diagnostics</h3>
          <table className="kv-table">
            <tbody>
              <tr>
                <td>Database Path</td>
                <td>{backendHealth?.database_path || 'unknown'}</td>
              </tr>
              <tr>
                <td>Schema Version</td>
                <td>{backendHealth?.schema_version} / {backendHealth?.required_schema_version}</td>
              </tr>
              <tr>
                <td>Camelid Endpoint</td>
                <td>{backendHealth?.camelid_endpoint || 'none'}</td>
              </tr>
              <tr>
                <td>Camelid Model</td>
                <td>{backendHealth?.camelid_model || 'none'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="panel">
          <h3 className="panel-title">Developer Recovery</h3>
          <p className="panel-desc">
            If you are running into SQLite schema errors or need to clear the developer database, click below. This will safely delete the local SQLite file, recreate the initial schema, run all outstanding migrations, and reseed initial agent contracts.
          </p>

          {message && (
            <div className={`alert ${message.startsWith('Error') ? 'alert-danger' : 'alert-success'} mb-md`}>
              {message}
            </div>
          )}

          <div className="row-actions">
            <button
              onClick={handleReset}
              disabled={loading}
              className={confirming ? 'danger-button' : 'secondary-button'}
            >
              {loading ? 'Resetting...' : confirming ? 'Confirm Reset (Deletes Dev DB)' : 'Reset Dev Database'}
            </button>
            {confirming && (
              <button
                onClick={() => setConfirming(false)}
                disabled={loading}
                className="text-button"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
};

export const MemoryPage: React.FC = () => {
  const { backendHealth } = useAppStore();
  const workspaceId = backendHealth?.active_workspace_id || 'default';
  const [memories, setMemories] = useState<Memory[]>([]);
  const [query, setQuery] = useState('');
  const [content, setContent] = useState('');
  const [context, setContext] = useState('');
  const [importance, setImportance] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const data = query.trim() ? await searchMemories(query.trim()) : await getMemories();
      setMemories(data);
      setError(null);
    } catch (err: any) {
      setError(err.toString());
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleCreate = async () => {
    if (!content.trim()) return;
    try {
      await createMemory({ content: content.trim(), context: context.trim() || undefined, importance, workspaceId });
      setContent(''); setContext(''); setImportance(1);
      await refresh();
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const handleDelete = async (id: string) => {
    await deleteMemory(id);
    await refresh();
  };

  return (
    <PageShell title="Shared Memory">
      <div className="page-stack">
        {error && <div className="error-text">{error}</div>}

        <div className="panel form-dark">
          <h4 className="panel-title">Write a memory</h4>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="What should be remembered?"
            className="mb-sm" />
          <div className="form-row">
            <input value={context} onChange={e => setContext(e.target.value)} placeholder="Context (optional)"
              className="grow" />
            <label className="form-field inline">Importance
              <input type="number" min={1} max={10} value={importance} onChange={e => setImportance(Number(e.target.value))} />
            </label>
            <button onClick={handleCreate}>Save Memory</button>
          </div>
        </div>

        <div className="form-row form-dark">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') refresh(); }}
            placeholder="Search memories…" className="grow" />
          <button onClick={refresh}>Search</button>
        </div>

        <div className="panel panel-scroll">
          <h4 className="panel-title">Memories ({memories.length})</h4>
          {memories.length === 0 ? <p className="text-muted">No memories yet.</p> : (
            <ul className="list-plain">
              {memories.map(m => (
                <li key={m.id} className="list-row">
                  <div className="min-w-0">
                    <div>{m.content}</div>
                    <div className="row-meta">
                      {m.context ? `${m.context} · ` : ''}importance {m.importance}{m.agent_id ? ` · by ${m.agent_id}` : ''} · {m.created_at}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(m.id)} className="danger-button btn-sm self-start">Delete</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
};

export const ContextPage: React.FC = () => {
  const { backendHealth } = useAppStore();
  const workspaceId = backendHealth?.active_workspace_id || 'default';
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [decisionText, setDecisionText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const details = await getCoordinationDetails();
      setDecisions(details.decisions);
      setHandoffs(details.handoffs);
      setError(null);
    } catch (err: any) {
      setError(err.toString());
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleRecord = async () => {
    if (!decisionText.trim()) return;
    try {
      await recordDecision(workspaceId, decisionText.trim(), 'user');
      setDecisionText('');
      await refresh();
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const handleResolve = async (id: number | null, status: string) => {
    if (id == null) return;
    await resolveHandoff(id, status);
    await refresh();
  };

  return (
    <PageShell title="Project Context">
      <div className="page-stack">
        {error && <div className="error-text">{error}</div>}

        <div className="panel form-dark">
          <h4 className="panel-title">Record a decision</h4>
          <div className="form-row">
            <input value={decisionText} onChange={e => setDecisionText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRecord(); }}
              placeholder="Decision the team should remember…" className="grow" />
            <button onClick={handleRecord}>Record</button>
          </div>
        </div>

        <div className="panel">
          <h4 className="panel-title">Decisions ({decisions.length})</h4>
          {decisions.length === 0 ? <p className="text-muted">No decisions recorded.</p> : (
            <ul className="list-plain">
              {decisions.map(d => (
                <li key={d.id ?? d.timestamp} className="list-row stack">
                  <div>{d.decision}</div>
                  <div className="row-meta">by {d.decided_by} · {d.timestamp}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel">
          <h4 className="panel-title">Handoffs ({handoffs.length})</h4>
          {handoffs.length === 0 ? <p className="text-muted">No handoffs.</p> : (
            <ul className="list-plain">
              {handoffs.map(h => (
                <li key={h.id ?? h.timestamp} className="list-row">
                  <div className="min-w-0">
                    <div>{h.source_agent_id} → {h.target_agent_id}</div>
                    <div className="row-meta">{h.reason} · status: {h.status} · {h.timestamp}</div>
                  </div>
                  {h.status === 'pending' && (
                    <div className="row-actions">
                      <button onClick={() => handleResolve(h.id, 'accepted')} className="success-button btn-sm">Accept</button>
                      <button onClick={() => handleResolve(h.id, 'rejected')} className="danger-button btn-sm">Reject</button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </PageShell>
  );
};
