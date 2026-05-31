import React, { useEffect, useState } from 'react';
import { getAgentRuns, getPendingCommandApproval, resolveCommandApproval } from '../api/runtime';
import { getMissionAuditEvents, AuditEvent } from '../api/audit';
import { AgentRun, CommandApproval } from '../types';
import { PageShell } from '../components/common/PageShell';

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
  return <PageShell title="Settings"><div><p>Settings configuration coming soon.</p></div></PageShell>;
};

export const MemoryPage: React.FC = () => {
  return <PageShell title="Memory"><div><p>Memory search and contextual retrieval UI coming soon.</p></div></PageShell>;
};
