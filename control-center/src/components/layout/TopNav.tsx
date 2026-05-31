import React from 'react';
import { useAppStore } from '../../state/appStore';

export const TopNav: React.FC = () => {
  const { backendHealth, activeProjectName, selectedAgentId } = useAppStore();

  const appStatus = backendHealth?.app_status || 'offline';
  const dbStatus = backendHealth?.database_status || 'offline';
  const camelidStatus = backendHealth?.camelid_status || 'unknown';
  const modelLoaded = backendHealth?.camelid_model || 'none loaded';

  const getStatusStyles = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'online' || s === 'ready' || s === 'connected') {
      return {
        bg: 'var(--success-bg, #dcfce7)',
        text: 'var(--success-text, #166534)',
        border: '1px solid rgba(22, 101, 52, 0.15)'
      };
    }
    if (s === 'degraded' || s === 'migrating' || s === 'starting' || s === 'unknown') {
      return {
        bg: 'var(--warning-bg, #fef3c7)',
        text: 'var(--warning-text, #92400e)',
        border: '1px solid rgba(146, 64, 14, 0.15)'
      };
    }
    if (s === 'offline' || s === 'schema_error' || s === 'error') {
      return {
        bg: 'var(--danger-bg, #fee2e2)',
        text: 'var(--danger-text, #991b1b)',
        border: '1px solid rgba(153, 27, 27, 0.15)'
      };
    }
    // Gray fallback
    return {
      bg: 'var(--surface-2, #f2f2f7)',
      text: 'var(--text-muted, #4b5563)',
      border: '1px solid var(--border, #d1d5db)'
    };
  };

  const Badge: React.FC<{ label: string; value: string }> = ({ label, value }) => {
    const styles = getStatusStyles(value);
    const displayValue = value.replace('_', ' ').toUpperCase();
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--sidebar-muted, #cbd5e1)', fontWeight: 500 }}>{label}:</span>
        <span style={{
          padding: '2px 8px',
          borderRadius: '6px',
          backgroundColor: styles.bg,
          color: styles.text,
          border: styles.border,
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: 0
        }}>
          {displayValue}
        </span>
      </div>
    );
  };

  return (
    <div style={{
      height: '60px',
      backgroundColor: 'var(--sidebar-bg, #111827)',
      color: 'var(--sidebar-text, #f9fafb)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 1.5rem',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
    }}>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-muted, #cbd5e1)' }}>Workspace: </span>
          <strong style={{ color: 'var(--sidebar-text, #f9fafb)' }}>{activeProjectName || 'None'}</strong>
        </div>
        <div>
          <span style={{ fontSize: '0.8rem', color: 'var(--sidebar-muted, #cbd5e1)' }}>Agent: </span>
          <strong style={{ color: 'var(--sidebar-text, #f9fafb)' }}>{selectedAgentId || 'None'}</strong>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <Badge label="App" value={appStatus} />
        <Badge label="DB" value={dbStatus} />
        <Badge label="Camelid" value={camelidStatus} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--sidebar-muted, #cbd5e1)', fontWeight: 500 }}>Model:</span>
          <span style={{
            fontSize: '0.75rem',
            color: 'var(--sidebar-text, #f9fafb)',
            fontWeight: 600,
            backgroundColor: 'var(--sidebar-active-bg, #1f2937)',
            padding: '2px 8px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.05)'
          }}>
            {modelLoaded}
          </span>
        </div>
      </div>
    </div>
  );
};
