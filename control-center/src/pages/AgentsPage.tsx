import React, { useEffect, useState } from 'react';
import { getAgents, createAgent, getAgentOrgTree } from '../api/agents';
import { Agent, AgentOrgNode } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { PageShell } from '../components/common/PageShell';

export const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [orgTree, setOrgTree] = useState<AgentOrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form State
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [persona, setPersona] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      getAgents(),
      getAgentOrgTree("default-workspace")
    ])
    .then(([agentsData, treeData]) => {
      setAgents(agentsData);
      setOrgTree(treeData);
    })
    .catch((e: any) => setError(e.toString()))
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    const newAgent: Agent = {
      id: crypto.randomUUID(),
      name,
      role,
      persona,
      model_provider: "local",
      model_name: "default",
      temperature: 0.7,
      max_tokens: 2048,
      can_spawn_subtasks: true,
      can_talk_globally: true,
      is_continuous: false,
      status: "idle",
      last_heartbeat: null
    };

    try {
      await createAgent(newAgent);
      setName('');
      setRole('');
      setPersona('');
      setShowForm(false);
      loadData();
    } catch (err: any) {
      setError(err.toString());
    }
  };

  if (loading) return <PageShell title="Agent Roster"><LoadingState /></PageShell>;

  return (
    <PageShell title="Agent Roster">
      {showForm && (
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ccc' }}>
          <input type="text" placeholder="Agent Name (e.g. Alice)" value={name} onChange={e => setName(e.target.value)} style={{ padding: '0.5rem' }} autoFocus />
          <input type="text" placeholder="Role (e.g. Frontend Developer)" value={role} onChange={e => setRole(e.target.value)} style={{ padding: '0.5rem' }} />
          <textarea placeholder="Persona Description..." value={persona} onChange={e => setPersona(e.target.value)} style={{ padding: '0.5rem', minHeight: '60px' }} />
          <button type="submit" style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}>
            Initialize Agent
          </button>
        </form>
      )}

      <div style={{ display: 'flex', gap: '1rem', flex: 1, overflow: 'hidden' }}>
        {/* Org Tree View */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '1rem', borderRadius: '4px', overflowY: 'auto' }}>
          <h4>Organization Structure</h4>
          {orgTree.length === 0 ? <p>No teams configured.</p> : (
            <ul style={{ listStyleType: 'none', paddingLeft: 0 }}>
              {orgTree.map(node => (
                <li key={node.id} style={{ paddingLeft: `${node.sort_order * 20}px`, padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                  {node.node_type === 'team' ? '🏢' : '🤖'} <strong>{node.display_name}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Registry View */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '1rem', borderRadius: '4px', overflowY: 'auto' }}>
          <h4>All Agents ({agents.length})</h4>
          {agents.length === 0 ? <EmptyState title="No Agents" description="Hire an agent to begin." /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Name</th>
                  <th style={{ padding: '0.5rem' }}>Role</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                  <th style={{ padding: '0.5rem' }}>Model</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}><strong>{a.name}</strong></td>
                    <td style={{ padding: '0.5rem' }}>{a.role}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <span style={{ padding: '0.2rem 0.5rem', borderRadius: '12px', backgroundColor: a.status === 'idle' ? '#e2e3e5' : '#cce5ff', fontSize: '0.8rem' }}>
                        {a.status}
                      </span>
                    </td>
                    <td style={{ padding: '0.5rem', fontSize: '0.9rem', color: '#666' }}>{a.model_provider}</td>
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
