import React from 'react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  details?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry, details }) => {
  return (
    <div style={{ padding: '2rem', backgroundColor: 'var(--color-panel)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-danger)' }}>
      <h3 style={{ color: 'var(--color-danger)', marginBottom: '0.5rem' }}>Error</h3>
      <p style={{ color: 'var(--color-text)', marginBottom: '1rem' }}>{message}</p>
      {details && <pre style={{ backgroundColor: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius-sm)', overflowX: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{details}</pre>}
      {onRetry && (
        <button onClick={onRetry} style={{ marginTop: '1rem', backgroundColor: 'var(--color-danger)' }}>
          Retry
        </button>
      )}
    </div>
  );
};
