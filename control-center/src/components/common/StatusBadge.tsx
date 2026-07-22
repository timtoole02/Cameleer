import React from 'react';

export type BackendStatus = 'checking' | 'connected' | 'degraded' | 'offline';

interface StatusBadgeProps {
  status: BackendStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let color = 'var(--color-text-muted)';
  let bg = 'var(--color-bg)';
  
  if (status === 'connected') {
    color = 'var(--success-text)';
    bg = 'var(--success-bg)';
  } else if (status === 'degraded') {
    color = 'var(--warning-text)';
    bg = 'var(--warning-bg)';
  } else if (status === 'offline') {
    color = 'var(--danger-text)';
    bg = 'var(--danger-bg)';
  } else if (status === 'checking') {
    color = 'var(--accent)';
    bg = 'var(--accent-soft)';
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 8px',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: bg,
      color: color,
      fontSize: '0.8rem',
      fontWeight: 'bold',
      textTransform: 'uppercase'
    }}>
      {status}
    </div>
  );
};
