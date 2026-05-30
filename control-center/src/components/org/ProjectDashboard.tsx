import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AgentOrgNode } from '../../types';
import KanbanBoard from '../board/KanbanBoard';

interface ProjectDashboardProps {
  activeNode: AgentOrgNode;
  agents: any[];
  onCardClick: (card: any) => void;
  refreshTrigger: number;
}

interface OrgMetrics {
  active_work: number;
  blocked_cards: number;
  active_agents: number;
}

export function ProjectDashboard({ activeNode, agents, onCardClick, refreshTrigger }: ProjectDashboardProps) {
  const [metrics, setMetrics] = useState<OrgMetrics>({ active_work: 0, blocked_cards: 0, active_agents: 0 });

  useEffect(() => {
    let targetId = null;
    if (activeNode.node_type === 'team') targetId = activeNode.team_id || activeNode.id;
    if (activeNode.node_type === 'project') targetId = activeNode.project_id || activeNode.id;

    invoke<OrgMetrics>('get_org_node_metrics', { 
      nodeType: activeNode.node_type, 
      targetId 
    }).then(setMetrics).catch(console.error);
  }, [activeNode]);

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
          <div style={{ fontSize: '2rem', fontWeight: 600 }}>{metrics.active_work}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Blocked Cards</h3>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: metrics.blocked_cards > 0 ? '#f87171' : 'inherit' }}>{metrics.blocked_cards}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase' }}>Active Agents</h3>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#34d399' }}>{metrics.active_agents}</div>
        </div>
      </div>

      <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ marginBottom: '16px' }}>Scoped Context Snippet</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          When an agent operates in this scope, they receive narrowed memory boundaries. They will only see Kanban Cards, File Artifacts, and Handoffs explicitly registered to this {activeNode.node_type}.
        </p>
      </div>

      <div>
        <h2 style={{ marginBottom: '16px' }}>Scoped Kanban Board</h2>
        <div style={{ border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden', height: '400px' }}>
          <KanbanBoard 
            workspaceId="default"
            agents={agents}
            onCardClick={onCardClick}
            refreshTrigger={refreshTrigger}
            scopeType={activeNode.node_type}
            scopeId={activeNode.node_type === 'team' ? (activeNode.team_id || activeNode.id) : (activeNode.project_id || activeNode.id)}
          />
        </div>
      </div>
    </div>
  );
}
