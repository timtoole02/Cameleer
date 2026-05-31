import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AgentOrgNode } from '../../types';

interface OrgModalsProps {
  isOpen: boolean;
  modalType: 'project' | 'team' | 'move_agent' | null;
  onClose: () => void;
  onSuccess: () => void;
  workspaceId: string;
  selectedNode: AgentOrgNode | null;
  agents: any[];
}

export function OrgModals({ isOpen, modalType, onClose, onSuccess, workspaceId, selectedNode, agents }: OrgModalsProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');

  if (!isOpen || !modalType) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (modalType === 'project') {
        await invoke('create_project', { workspaceId, name, description });
      } else if (modalType === 'team') {
        const projectId = selectedNode?.node_type === 'project' ? selectedNode.project_id : null;
        await invoke('create_team', { workspaceId, projectId, name, description });
      } else if (modalType === 'move_agent') {
        const projectId = selectedNode?.project_id;
        const teamId = selectedNode?.node_type === 'team' ? selectedNode.team_id : null;
        if (!projectId || !teamId || !selectedAgentId) {
          alert('Select a valid team and agent.');
          return;
        }
        await invoke('move_agent_to_team', { agentId: selectedAgentId, projectId, teamId });
      }
      onSuccess();
      onClose();
    } catch (err) {
      alert(`Failed to execute: ${err}`);
    }
  };

  const title = modalType === 'project' ? 'Create New Project' :
                modalType === 'team' ? 'Create New Team' : 'Move Agent to Team';

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: 'var(--bg-panel)', padding: '24px', borderRadius: '12px', width: '400px', border: '1px solid var(--border-color)' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px' }}>{title}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          
          {(modalType === 'project' || modalType === 'team') && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Name</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required 
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Description</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(0,0,0,0.2)', color: 'white', height: '60px' }}
                />
              </div>
            </>
          )}

          {modalType === 'move_agent' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>Select Agent</label>
              <select 
                value={selectedAgentId} 
                onChange={e => setSelectedAgentId(e.target.value)}
                required
                style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'var(--bg-panel)', color: 'white' }}
              >
                <option value="">-- Choose an Agent --</option>
                {agents.map((a: any) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.role})</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button type="button" onClick={onClose} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid var(--border-color)', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" style={{ padding: '6px 12px', background: 'var(--accent-primary)', border: 'none', color: 'black', fontWeight: 'bold', borderRadius: '4px', cursor: 'pointer' }}>Confirm</button>
          </div>
        </form>
      </div>
    </div>
  );
}
