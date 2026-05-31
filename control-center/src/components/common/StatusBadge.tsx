import React from 'react';

export type BackendStatus = 'checking' | 'connected' | 'degraded' | 'offline';

interface StatusBadgeProps {
  status: BackendStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  let color = 'var(--color-text-muted)';
  let bg = 'var(--color-bg)';
  
  if (status === 'connected') {
    color = 'var(--color-success)';
    bg = '#dcfce7'; // light green
  } else if (status === 'degraded') {
    color = 'var(--color-warning)';
    bg = '#fef3c7'; // light yellow
  } else if (status === 'offline') {
    color = 'var(--color-danger)';
    bg = '#fee2e2'; // light red
  } else if (status === 'checking') {
    color = 'var(--color-primary)';
    bg = '#dbeafe'; // light blue
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
