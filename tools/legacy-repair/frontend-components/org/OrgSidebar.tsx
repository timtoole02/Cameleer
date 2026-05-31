import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AgentOrgNode } from '../../types';
import { OrgModals } from './OrgModals';

interface OrgSidebarProps {
  workspaceId: string;
  onNodeSelect: (node: AgentOrgNode) => void;
  agents: any[];
}

export function OrgSidebar({ workspaceId, onNodeSelect, agents }: OrgSidebarProps) {
  const [nodes, setNodes] = useState<AgentOrgNode[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [modalType, setModalType] = useState<'project' | 'team' | 'move_agent' | null>(null);
  const [selectedActionNode, setSelectedActionNode] = useState<AgentOrgNode | null>(null);

  useEffect(() => {
    fetchTree();
  }, [workspaceId]);

  const fetchTree = async () => {
    try {
      const data = await invoke<AgentOrgNode[]>('get_agent_org_tree', { workspaceId });
      setNodes(data);
      // Auto-expand workspace and projects by default
      const initialExpanded = new Set<string>();
      data.forEach(n => {
        if (n.node_type === 'workspace' || n.node_type === 'project') {
          initialExpanded.add(n.id);
        }
      });
      setExpandedNodes(initialExpanded);
    } catch (e) {
      console.error("Failed to load org tree", e);
    }
  };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderTree = (parentId: string | null = null, depth: number = 0) => {
    const children = nodes.filter(n => n.parent_node_id === parentId);
    if (children.length === 0) return null;

    return children.map(node => {
      const isExpanded = expandedNodes.has(node.id);
      const hasChildren = nodes.some(n => n.parent_node_id === node.id);

      let icon = '📁';
      if (node.node_type === 'workspace') icon = '🏢';
      if (node.node_type === 'project') icon = '📦';
      if (node.node_type === 'team') icon = '👥';
      if (node.node_type === 'agent') icon = '🤖';

      return (
        <div key={node.id} style={{ paddingLeft: `${depth * 16}px` }}>
          <div 
            className="org-node" 
            onClick={() => onNodeSelect(node)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '6px 8px',
              cursor: 'pointer',
              borderRadius: '6px',
              userSelect: 'none',
              color: 'var(--text-primary)'
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <span 
                onClick={(e) => hasChildren && toggleExpand(node.id, e)}
                style={{ width: '20px', display: 'inline-block', opacity: hasChildren ? 0.7 : 0 }}
              >
                {hasChildren ? (isExpanded ? '▼' : '▶') : ''}
              </span>
              <span style={{ marginRight: '8px', position: 'relative' }}>
                {icon}
                {node.node_type === 'agent' && (
                  <div 
                    className={`status-badge ${agents.find(a => a.id === node.agent_id)?.status || 'idle'}`} 
                    style={{ position: 'absolute', bottom: '-2px', right: '-4px', width: '8px', height: '8px', borderWidth: '1px' }} 
                  />
                )}
              </span>
              <span style={{ fontSize: '0.9rem', fontWeight: node.node_type === 'agent' ? 400 : 600 }}>
                {node.display_name}
              </span>
            </div>
            
            {node.node_type === 'project' && (
              <span className="node-actions" onClick={(e) => { e.stopPropagation(); setSelectedActionNode(node); setModalType('team'); }} style={{ fontSize: '0.75rem', opacity: 0.6, cursor: 'pointer', padding: '0 4px' }}>+ Team</span>
            )}
            {node.node_type === 'team' && (
              <span className="node-actions" onClick={(e) => { e.stopPropagation(); setSelectedActionNode(node); setModalType('move_agent'); }} style={{ fontSize: '0.75rem', opacity: 0.6, cursor: 'pointer', padding: '0 4px' }}>+ Agent</span>
            )}
          </div>
          {isExpanded && renderTree(node.id, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="org-sidebar" style={{
      width: '280px',
      height: '100%',
      borderRight: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      background: 'rgba(0,0,0,0.2)',
      overflowY: 'auto'
    }}>
      <div style={{ padding: '16px', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Organization</span>
        <button 
          onClick={() => { setSelectedActionNode(null); setModalType('project'); }}
          style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px' }}
        >
          + Project
        </button>
      </div>
      <div style={{ padding: '8px' }}>
        {renderTree(null, 0)}
      </div>

      <OrgModals 
        isOpen={modalType !== null}
        modalType={modalType}
        onClose={() => { setModalType(null); setSelectedActionNode(null); }}
        onSuccess={fetchTree}
        workspaceId={workspaceId}
        selectedNode={selectedActionNode}
        agents={agents}
      />
    </div>
  );
}
