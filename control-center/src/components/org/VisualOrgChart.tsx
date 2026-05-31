import React, { useMemo } from 'react';
import { AgentOrgNode } from '../../types';

interface VisualOrgChartProps {
  nodes: AgentOrgNode[];
  activeNodeId: string;
  onNodeClick: (node: AgentOrgNode) => void;
  agents: any[];
}

export const VisualOrgChart: React.FC<VisualOrgChartProps> = ({ nodes, activeNodeId, onNodeClick, agents }) => {
  // Build a tree structure from the flat nodes array
  const tree = useMemo(() => {
    const rootNodes = nodes.filter(n => !n.parent_node_id);
    
    const buildTree = (node: AgentOrgNode): any => {
      const children = nodes.filter(n => n.parent_node_id === node.id).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      return {
        ...node,
        children: children.map(buildTree)
      };
    };

    return rootNodes.map(buildTree);
  }, [nodes]);

  const renderNode = (node: any, level: number = 0) => {
    const isActive = node.id === activeNodeId || 
                     (node.node_type === 'team' && node.team_id === activeNodeId) || 
                     (node.node_type === 'project' && node.project_id === activeNodeId);
                     
    let icon = '📁';
    let colorClass = 'var(--bg-card)';
    let borderColor = 'rgba(255,255,255,0.1)';
    
    if (node.node_type === 'workspace') { icon = '🏢'; colorClass = 'rgba(255,255,255,0.02)'; }
    if (node.node_type === 'project') { icon = '📦'; colorClass = 'rgba(59, 130, 246, 0.1)'; borderColor = 'rgba(59, 130, 246, 0.3)'; }
    if (node.node_type === 'team') { icon = '👥'; colorClass = 'rgba(16, 185, 129, 0.1)'; borderColor = 'rgba(16, 185, 129, 0.3)'; }
    if (node.node_type === 'agent') { icon = '🤖'; colorClass = 'rgba(139, 92, 246, 0.1)'; borderColor = 'rgba(139, 92, 246, 0.3)'; }

    const agentData = node.node_type === 'agent' ? agents.find(a => a.id === node.agent_id) : null;
    const statusColor = agentData?.status === 'working' ? '#10b981' : (agentData?.status === 'idle' ? '#6b7280' : '#ef4444');

    return (
      <div key={node.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div 
          onClick={() => onNodeClick(node)}
          style={{
            background: colorClass,
            border: `1px solid ${isActive ? 'var(--accent-blue)' : borderColor}`,
            boxShadow: isActive ? '0 0 0 2px rgba(10, 132, 255, 0.3)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            borderRadius: '12px',
            padding: '12px 20px',
            minWidth: '160px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'relative',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.2s ease'
          }}
        >
          <div style={{ fontSize: '1.5rem', marginBottom: '8px', position: 'relative' }}>
            {icon}
            {node.node_type === 'agent' && (
              <div style={{ position: 'absolute', bottom: 0, right: '-4px', width: '10px', height: '10px', borderRadius: '50%', background: statusColor, border: '2px solid var(--bg-card)' }} />
            )}
          </div>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', textAlign: 'center' }}>
            {node.display_name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>
            {node.node_type}
          </div>
        </div>

        {node.children && node.children.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Vertical Line */}
            <div style={{ width: '2px', height: '24px', background: 'rgba(255,255,255,0.1)' }} />
            
            {/* Horizontal Line connecting children */}
            {node.children.length > 1 && (
              <div style={{ 
                height: '2px', 
                background: 'rgba(255,255,255,0.1)', 
                width: `calc(100% - ${100 / node.children.length}%)`,
                marginBottom: '16px'
              }} />
            )}
            {node.children.length === 1 && (
              <div style={{ height: '16px' }} /> // Spacer if only 1 child
            )}

            {/* Children Container */}
            <div style={{ display: 'flex', gap: '32px', justifyContent: 'center' }}>
              {node.children.map((child: any) => renderNode(child, level + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (!tree || tree.length === 0) return <div>No organizational data found.</div>;

  return (
    <div style={{ 
      width: '100%', 
      overflowX: 'auto', 
      padding: '24px 0',
      display: 'flex',
      justifyContent: 'center'
    }}>
      {tree.map(rootNode => renderNode(rootNode))}
    </div>
  );
};
