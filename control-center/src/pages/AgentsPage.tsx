import React, { useEffect, useState } from 'react';
import {
  getAgents, createAgent, getAgentOrgTree,
  createProject, createTeam, moveAgentToTeam,
} from '../api/agents';
import { Agent, AgentOrgNode } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { EmptyState } from '../components/common/EmptyState';
import { PageShell } from '../components/common/PageShell';
import { useAppStore } from '../state/appStore';

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
  const { backendHealth } = useAppStore();
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
      // Inherit the concrete model the backend is actually serving.
      // (Hardcoding 'camelid-default' made every UI-created agent un-runnable:
      // start_agent_task_run rejects that placeholder as "no concrete model".)
      model_name: backendHealth?.camelid_model || 'camelid-default',
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
        <li className="org-tree-node" style={{ paddingLeft: `${10 + depth * 20}px` }}>
          <span>{NODE_ICON[node.node_type] || '•'}</span>
          <strong>{node.display_name}</strong>
          <span className="muted">{node.node_type}</span>
        </li>
        {renderNodes(node.id, depth + 1)}
      </React.Fragment>
    ));
  };

  if (loading) return <PageShell title="Agent Roster"><LoadingState /></PageShell>;

  return (
    <PageShell title="Agent Roster">
      {error && <div className="error-text">{error}</div>}

      <div style={{ marginBottom: 'var(--space-sm)' }}>
        <button onClick={() => setShowForm(s => !s)}>
          {showForm ? 'Cancel' : '+ New Agent'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="panel form-dark agent-create-form">
          <div className="form-field">
            <label>Agent Name</label>
            <input type="text" placeholder="e.g. Alice" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="form-field">
            <label>Role</label>
            <input type="text" placeholder="e.g. Frontend Developer" value={role} onChange={e => setRole(e.target.value)} />
          </div>
          <div className="form-field">
            <label>Persona</label>
            <textarea placeholder="Persona description…" value={persona} onChange={e => setPersona(e.target.value)} />
          </div>
          <button type="submit">Initialize Agent</button>
        </form>
      )}

      <div className="split-layout">
        {/* Org Tree + management */}
        <div className="panel form-dark">
          <h4 className="panel-title">Organization Structure</h4>
          <ul className="org-tree">
            {renderNodes(null, 0)}
          </ul>

          <div className="org-actions">
            <div className="inline-row">
              <input placeholder="New project name" value={projectName} onChange={e => setProjectName(e.target.value)} />
              <button className="secondary-button" onClick={handleCreateProject}>Add Project</button>
            </div>
            <div className="inline-row">
              <input placeholder="New team name" value={teamName} onChange={e => setTeamName(e.target.value)} />
              <select value={teamProjectId} onChange={e => setTeamProjectId(e.target.value)}>
                <option value="">(no project)</option>
                {projects.map(p => <option key={p.id} value={p.project_id || ''}>{p.display_name}</option>)}
              </select>
              <button className="secondary-button" onClick={handleCreateTeam}>Add Team</button>
            </div>
            <div className="inline-row">
              <select value={assignAgentId} onChange={e => setAssignAgentId(e.target.value)}>
                <option value="">Select agent…</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <select value={assignTeamId} onChange={e => setAssignTeamId(e.target.value)}>
                <option value="">Select team…</option>
                {teams.map(t => <option key={t.id} value={t.team_id || ''}>{t.display_name}</option>)}
              </select>
              <button className="secondary-button" onClick={handleAssign}>Assign</button>
            </div>
          </div>
        </div>

        {/* Registry */}
        <div className="panel">
          <h4 className="panel-title">All Agents ({agents.length})</h4>
          {agents.length === 0 ? <EmptyState title="No Agents" description="Hire an agent to begin." /> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Model</th>
                  <th>Reasoning</th>
                  <th>Tools</th>
                  <th>Safety</th>
                </tr>
              </thead>
              <tbody>
                {agents.map(a => (
                  <tr key={a.id}>
                    <td><strong>{a.name}</strong></td>
                    <td>{a.role}</td>
                    <td>
                      <span className={`status-dot ${a.status}`} />{a.status}
                    </td>
                    <td className="muted">{a.model_provider}</td>
                    <td className="muted">{a.reasoning_level || '—'}</td>
                    <td className="muted" title={a.allowed_tools || ''}>{formatList(a.allowed_tools)}</td>
                    <td className="muted" title={a.command_permissions || ''}>{a.safety_profile || '—'}</td>
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
