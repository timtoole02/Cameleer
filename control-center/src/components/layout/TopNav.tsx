import React from 'react';
import { useAppStore } from '../../state/appStore';
import { StatusBadge } from '../common/StatusBadge';

export const TopNav: React.FC = () => {
  const { backendHealth, activeProjectName, selectedAgentId } = useAppStore();

  const status = backendHealth?.status || 'checking';

  return (
    <div style={{
      height: '60px',
      backgroundColor: 'var(--color-header)',
      color: 'var(--color-text-on-dark)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      borderBottom: '1px solid #1f2937' // dark subtle border
    }}>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted-on-dark)' }}>Project: </span>
          <strong>{activeProjectName || 'None'}</strong>
        </div>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted-on-dark)' }}>Agent: </span>
          <strong>{selectedAgentId || 'None'}</strong>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted-on-dark)' }}>Backend:</span>
        <StatusBadge status={status} />
      </div>
    </div>
  );
};
