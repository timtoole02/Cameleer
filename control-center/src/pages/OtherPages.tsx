import React, { useEffect, useState } from 'react';
import { getAgentRuns, getPendingCommandApproval, resolveCommandApproval } from '../api/runtime';
import { getMissionAuditEvents, AuditEvent } from '../api/audit';
import { AgentRun, CommandApproval } from '../types';
import { PageShell } from '../components/common/PageShell';
import { useAppStore } from '../state/appStore';
import { resetDevDatabase, getBackendHealth } from '../api/health';


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
  return <PageShell title="Memory"><div><p>Memory search and contextual retrieval UI coming soon.</p></div></PageShell>;
};
