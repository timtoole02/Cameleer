
import { AgentOrgNode } from '../../types';

interface ProjectDashboardProps {
  activeNode: AgentOrgNode;
}

export function ProjectDashboard({ activeNode }: ProjectDashboardProps) {
  return (
    <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
      <h1 style={{ marginBottom: '8px' }}>{activeNode.display_name} Dashboard</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
        {activeNode.node_type === 'project' && 'Project overview and metrics.'}
        {activeNode.node_type === 'team' && 'Team scope and active work.'}
        {activeNode.node_type === 'workspace' && 'Workspace global overview.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Active Work</h3>
          <div style={{ fontSize: '2rem', fontWeight: 600 }}>12</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Blocked Cards</h3>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#f87171' }}>2</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Active Agents</h3>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#34d399' }}>4</div>
        </div>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ marginBottom: '16px' }}>Scoped Context Snippet</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          When an agent operates in this scope, they receive narrowed memory boundaries. They will only see Kanban Cards, File Artifacts, and Handoffs explicitly registered to this {activeNode.node_type}.
        </p>
      </div>
    </div>
  );
}
