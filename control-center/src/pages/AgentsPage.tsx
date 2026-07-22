import React, { useEffect, useState } from 'react';
import {
  getAgents, createAgent, getAgentOrgTree,
  createProject, createTeam, moveAgentToTeam,
} from '../api/agents';
import { Agent, AgentOrgNode } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { PageShell } from '../components/common/PageShell';

const WORKSPACE = 'default-workspace';

const NODE_ICON: Record<string, string> = {
  workspace: '🗂️', project: '📁', team: '🏢', agent: '🤖',
};

// allowed_tools / permissions come back as a string that may be a JSON array or
// a comma-separated list. Render a compact summary; full value is in the title.
function formatList(value: string | null | undefined): string {
  if (!value) return '—';
  let items: string[];
  try {
    const parsed = JSON.parse(value);
    items = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    items = value.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (items.length === 0) return '—';
  return items.length <= 2 ? items.join(', ') : `${items.slice(0, 2).join(', ')} +${items.length - 2}`;
}

export const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [orgTree, setOrgTree] = useState<AgentOrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Agent form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [persona, setPersona] = useState('');

  // Org management form
  const [projectName, setProjectName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [teamProjectId, setTeamProjectId] = useState('');
  const [assignAgentId, setAssignAgentId] = useState('');
  const [assignTeamId, setAssignTeamId] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([getAgents(), getAgentOrgTree(WORKSPACE)])
      .then(([agentsData, treeData]) => {
        setAgents(agentsData);
        setOrgTree(treeData);
        setError(null);
      })
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const projects = orgTree.filter(n => n.node_type === 'project');
  const teams = orgTree.filter(n => n.node_type === 'team');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const newAgent: Agent = {
      id: crypto.randomUUID(),
      name, role, persona,
      model_provider: 'camelid',
      model_name: 'camelid-default',
      temperature: 0.7,
      max_tokens: 2048,
      can_spawn_subtasks: true,
      can_talk_globally: true,
      is_continuous: false,
      status: 'idle',
      last_heartbeat: null,
    };
    try {
      await createAgent(newAgent);
      setName(''); setRole(''); setPersona(''); setShowForm(false);
      loadData();
    } catch (err: any) { setError(err.toString()); }
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return;
    try { await createProject(WORKSPACE, projectName.trim()); setProjectName(''); loadData(); }
    catch (err: any) { setError(err.toString()); }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim()) return;
    try { await createTeam(WORKSPACE, teamName.trim(), teamProjectId || undefined); setTeamName(''); setTeamProjectId(''); loadData(); }
    catch (err: any) { setError(err.toString()); }
  };

  const handleAssign = async () => {
    if (!assignAgentId || !assignTeamId) return;
    const team = teams.find(t => t.team_id === assignTeamId);
    try {
      await moveAgentToTeam(assignAgentId, team?.project_id || '', assignTeamId);
      setAssignAgentId(''); setAssignTeamId('');
      loadData();
    } catch (err: any) { setError(err.toString()); }
  };

  // Recursive render of the org tree by parent_node_id.
  const renderNodes = (parentId: string | null, depth: number): React.ReactNode => {
    const children = orgTree.filter(n =>
      (parentId === null ? (n.parent_node_id === null || n.node_type === 'workspace') : n.parent_node_id === parentId)
    );
    if (children.length === 0) return null;
    return children.map(node => (
      <React.Fragment key={node.id}>
        <li style={{ paddingLeft: `${depth * 20}px`, padding: '0.4rem 0.5rem', borderBottom: '1px solid #eee' }}>
          {NODE_ICON[node.node_type] || '•'} <strong>{node.display_name}</strong>
          <span style={{ color: '#888', fontSize: '0.75rem', marginLeft: '0.5rem' }}>{node.node_type}</span>
        </li>
        {renderNodes(node.id, depth + 1)}
      </React.Fragment>
    ));
  };

  if (loading) return <PageShell title="Agent Roster"><LoadingState /></PageShell>;

  return (
    <PageShell title="Agent Roster">
      {error && <div style={{ color: '#991b1b', padding: '0.5rem' }}>{error}</div>}

      <div style={{ marginBottom: '0.75rem' }}>
        <button onClick={() => setShowForm(s => !s)} style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px' }}>
          {showForm ? 'Cancel' : '+ New Agent'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ccc', marginBottom: '0.75rem' }}>
          <input type="text" placeholder="Agent Name (e.g. Alice)" value={name} onChange={e => setName(e.target.value)} style={{ padding: '0.5rem' }} autoFocus />
          <input type="text" placeholder="Role (e.g. Frontend Developer)" value={role} onChange={e => setRole(e.target.value)} style={{ padding: '0.5rem' }} />
          <textarea placeholder="Persona Description..." value={persona} onChange={e => setPersona(e.target.value)} style={{ padding: '0.5rem', minHeight: '60px' }} />
          <button type="submit" style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}>
            Initialize Agent
          </button>
        </form>
      )}

      <div style={{ display: 'flex', gap: '1rem', flex: 1, overflow: 'hidden' }}>
        {/* Org Tree + management */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '1rem', borderRadius: '4px', overflowY: 'auto' }}>
          <h4 style={{ marginTop: 0 }}>Organization Structure</h4>
          <ul style={{ listStyleType: 'none', paddingLeft: 0, margin: '0 0 1rem 0' }}>
            {renderNodes(null, 0)}
          </ul>

          <div style={{ borderTop: '1px solid #eee', paddingTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input placeholder="New project name" value={projectName} onChange={e => setProjectName(e.target.value)} style={{ flex: 1, padding: '0.4rem' }} />
              <button onClick={handleCreateProject} style={{ padding: '0.4rem 0.8rem', cursor: 'pointer' }}>Add Project</button>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input placeholder="New team name" value={teamName} onChange={e => setTeamName(e.target.value)} style={{ flex: 1, padding: '0.4rem' }} />
              <select value={teamProjectId} onChange={e => setTeamProjectId(e.target.value)} style={{ padding: '0.4rem' }}>
                <option value="">(no project)</option>
                {projects.map(p => <option key={p.id} value={p.project_id || ''}>{p.display_name}</option>)}
              </select>
              <button onClick={handleCreateTeam} style={{ padding: '0.4rem 0.8rem', cursor: 'pointer' }}>Add Team</button>
            </div>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <select value={assignAgentId} onChange={e => setAssignAgentId(e.target.value)} style={{ flex: 1, padding: '0.4rem' }}>
                <option value="">Select agent…</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={assignTeamId} onChange={e => setAssignTeamId(e.target.value)} style={{ flex: 1, padding: '0.4rem' }}>
                <option value="">Select team…</option>
                {teams.map(t => <option key={t.id} value={t.team_id || ''}>{t.display_name}</option>)}
              </select>
              <button onClick={handleAssign} style={{ padding: '0.4rem 0.8rem', cursor: 'pointer' }}>Assign</button>
            </div>
          </div>
        </div>

        {/* Registry */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '1rem', borderRadius: '4px', overflowY: 'auto' }}>
          <h4 style={{ marginTop: 0 }}>All Agents ({agents.length})</h4>
          {agents.length === 0 ? <EmptyState title="No Agents" description="Hire an agent to begin." /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Name</th>
                  <th style={{ padding: '0.5rem' }}>Role</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                  <th style={{ padding: '0.5rem' }}>Model</th>
                  <th style={{ padding: '0.5rem' }}>Reasoning</th>
                  <th style={{ padding: '0.5rem' }}>Tools</th>
                  <th style={{ padding: '0.5rem' }}>Safety</th>
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
                    <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#666' }}>{a.reasoning_level || '—'}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#666' }} title={a.allowed_tools || ''}>{formatList(a.allowed_tools)}</td>
                    <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#666' }} title={a.command_permissions || ''}>{a.safety_profile || '—'}</td>
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
