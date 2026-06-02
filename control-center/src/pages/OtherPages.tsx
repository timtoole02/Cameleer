import React, { useEffect, useState } from 'react';
import { getAgentRuns, getPendingCommandApproval, resolveCommandApproval } from '../api/runtime';
import { getMissionAuditEvents, AuditEvent } from '../api/audit';
import { AgentRun, CommandApproval } from '../types';
import { PageShell } from '../components/common/PageShell';
import { useAppStore } from '../state/appStore';
import { resetDevDatabase, getBackendHealth } from '../api/health';
import { getMemories, searchMemories, createMemory, deleteMemory, Memory } from '../api/memory';
import { getCoordinationDetails, recordDecision, resolveHandoff, Decision, Handoff } from '../api/context';


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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
        <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '4px' }}>
          <h4>Pending Approvals ({approvals.length})</h4>
          {approvals.length === 0 ? <p>No pending approvals.</p> : (
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {approvals.map(a => (
                <li key={a.id} style={{ borderBottom: '1px solid #ccc', padding: '0.5rem 0', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <strong>{a.tool_name}</strong>
                    <pre style={{ fontSize: '0.8rem', background: '#f8f9fa', padding: '0.5rem' }}>{a.arguments}</pre>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button onClick={() => handleApprove(a.invocation_id, true)} style={{ backgroundColor: '#28a745', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px' }}>Approve</button>
                    <button onClick={() => handleApprove(a.invocation_id, false)} style={{ backgroundColor: '#dc3545', color: 'white', border: 'none', padding: '0.5rem', borderRadius: '4px' }}>Deny</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ backgroundColor: 'white', padding: '1rem', borderRadius: '4px' }}>
          <h4>Agent Runs</h4>
          {runs.length === 0 ? <p>No agents are currently running.</p> : (
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '0.5rem' }}>Agent ID</th>
                  <th style={{ padding: '0.5rem' }}>State</th>
                  <th style={{ padding: '0.5rem' }}>Started</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}>{r.agent_id}</td>
                    <td style={{ padding: '0.5rem' }}>{r.state}</td>
                    <td style={{ padding: '0.5rem' }}>{r.created_at}</td>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'white', padding: '1rem', borderRadius: '4px' }}>
          {events.length === 0 ? <p>No events logged.</p> : (
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '0.5rem' }}>Time</th>
                  <th style={{ padding: '0.5rem' }}>Type</th>
                  <th style={{ padding: '0.5rem' }}>Payload</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}>{e.timestamp}</td>
                    <td style={{ padding: '0.5rem' }}>{e.event_type}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <pre style={{ margin: 0, fontSize: '0.8rem', maxWidth: '300px', overflowX: 'auto' }}>{e.payload}</pre>
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
      <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text)' }}>System Diagnostics</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)', fontWeight: 600 }}>Database Path</td>
                <td style={{ padding: '8px 0', color: 'var(--text)', textAlign: 'right', wordBreak: 'break-all' }}>{backendHealth?.database_path || 'unknown'}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)', fontWeight: 600 }}>Schema Version</td>
                <td style={{ padding: '8px 0', color: 'var(--text)', textAlign: 'right' }}>{backendHealth?.schema_version} / {backendHealth?.required_schema_version}</td>
              </tr>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)', fontWeight: 600 }}>Camelid Endpoint</td>
                <td style={{ padding: '8px 0', color: 'var(--text)', textAlign: 'right' }}>{backendHealth?.camelid_endpoint || 'none'}</td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: 'var(--text-muted)', fontWeight: 600 }}>Camelid Model</td>
                <td style={{ padding: '8px 0', color: 'var(--text)', textAlign: 'right' }}>{backendHealth?.camelid_model || 'none'}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{ backgroundColor: 'var(--surface)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text)' }}>Developer Recovery</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 1.25rem 0', lineHeight: 1.4 }}>
            If you are running into SQLite schema errors or need to clear the developer database, click below. This will safely delete the local SQLite file, recreate the initial schema, run all outstanding migrations, and reseed initial agent contracts.
          </p>

          {message && (
            <div style={{
              padding: '0.75rem 1rem',
              borderRadius: '6px',
              marginBottom: '1rem',
              fontSize: '0.85rem',
              backgroundColor: message.startsWith('Error') ? 'var(--danger-bg)' : 'var(--success-bg)',
              color: message.startsWith('Error') ? 'var(--danger-text)' : 'var(--success-text)',
              border: `1px solid ${message.startsWith('Error') ? 'rgba(153,27,27,0.15)' : 'rgba(22,101,52,0.15)'}`
            }}>
              {message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button 
              onClick={handleReset} 
              disabled={loading}
              style={{
                backgroundColor: confirming ? 'var(--danger-text)' : 'var(--surface-2)',
                color: confirming ? '#fff' : 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                padding: '8px 16px',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Resetting...' : confirming ? 'Confirm Reset (Deletes Dev DB)' : 'Reset Dev Database'}
            </button>
            {confirming && (
              <button 
                onClick={() => setConfirming(false)} 
                disabled={loading}
                style={{
                  backgroundColor: 'transparent',
                  color: 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.85rem'
                }}
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
        {error && <div style={{ color: 'var(--danger-text, #991b1b)' }}>{error}</div>}

        <div style={{ backgroundColor: 'var(--surface, #fff)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border, #e5e7eb)' }}>
          <h4 style={{ marginTop: 0 }}>Write a memory</h4>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="What should be remembered?"
            style={{ width: '100%', minHeight: '60px', marginBottom: '0.5rem', padding: '0.5rem', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input value={context} onChange={e => setContext(e.target.value)} placeholder="Context (optional)"
              style={{ flex: 1, padding: '0.5rem', minWidth: '160px' }} />
            <label style={{ fontSize: '0.85rem' }}>Importance
              <input type="number" min={1} max={10} value={importance} onChange={e => setImportance(Number(e.target.value))}
                style={{ width: '60px', marginLeft: '0.5rem', padding: '0.4rem' }} />
            </label>
            <button onClick={handleCreate} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Save Memory</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') refresh(); }}
            placeholder="Search memories…" style={{ flex: 1, padding: '0.5rem' }} />
          <button onClick={refresh} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Search</button>
        </div>

        <div style={{ flex: 1, backgroundColor: 'var(--surface, #fff)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border, #e5e7eb)' }}>
          <h4 style={{ marginTop: 0 }}>Memories ({memories.length})</h4>
          {memories.length === 0 ? <p style={{ color: 'var(--text-muted, #6b7280)' }}>No memories yet.</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {memories.map(m => (
                <li key={m.id} style={{ borderBottom: '1px solid var(--border, #eee)', padding: '0.6rem 0', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <div>{m.content}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)' }}>
                      {m.context ? `${m.context} · ` : ''}importance {m.importance}{m.agent_id ? ` · by ${m.agent_id}` : ''} · {m.created_at}
                    </div>
                  </div>
                  <button onClick={() => handleDelete(m.id)} style={{ alignSelf: 'flex-start', background: 'transparent', border: '1px solid var(--border, #ccc)', borderRadius: '4px', cursor: 'pointer', padding: '0.25rem 0.5rem' }}>Delete</button>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', overflowY: 'auto' }}>
        {error && <div style={{ color: 'var(--danger-text, #991b1b)' }}>{error}</div>}

        <div style={{ backgroundColor: 'var(--surface, #fff)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border, #e5e7eb)' }}>
          <h4 style={{ marginTop: 0 }}>Record a decision</h4>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input value={decisionText} onChange={e => setDecisionText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleRecord(); }}
              placeholder="Decision the team should remember…" style={{ flex: 1, padding: '0.5rem' }} />
            <button onClick={handleRecord} style={{ backgroundColor: '#2563eb', color: 'white', border: 'none', padding: '0.5rem 1rem', borderRadius: '4px', cursor: 'pointer' }}>Record</button>
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--surface, #fff)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border, #e5e7eb)' }}>
          <h4 style={{ marginTop: 0 }}>Decisions ({decisions.length})</h4>
          {decisions.length === 0 ? <p style={{ color: 'var(--text-muted, #6b7280)' }}>No decisions recorded.</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {decisions.map(d => (
                <li key={d.id ?? d.timestamp} style={{ borderBottom: '1px solid var(--border, #eee)', padding: '0.5rem 0' }}>
                  <div>{d.decision}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)' }}>by {d.decided_by} · {d.timestamp}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ backgroundColor: 'var(--surface, #fff)', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border, #e5e7eb)' }}>
          <h4 style={{ marginTop: 0 }}>Handoffs ({handoffs.length})</h4>
          {handoffs.length === 0 ? <p style={{ color: 'var(--text-muted, #6b7280)' }}>No handoffs.</p> : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {handoffs.map(h => (
                <li key={h.id ?? h.timestamp} style={{ borderBottom: '1px solid var(--border, #eee)', padding: '0.5rem 0', display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <div>
                    <div>{h.source_agent_id} → {h.target_agent_id}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #6b7280)' }}>{h.reason} · status: {h.status} · {h.timestamp}</div>
                  </div>
                  {h.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-start' }}>
                      <button onClick={() => handleResolve(h.id, 'accepted')} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', cursor: 'pointer' }}>Accept</button>
                      <button onClick={() => handleResolve(h.id, 'rejected')} style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', padding: '0.25rem 0.6rem', cursor: 'pointer' }}>Reject</button>
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
