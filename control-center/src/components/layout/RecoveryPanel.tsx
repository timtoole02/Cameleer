import React from 'react';
import { BackendHealth } from '../../api/health';
import { PageShell } from '../common/PageShell';

interface RecoveryPanelProps {
  health: BackendHealth | null;
  errorMsg: string | null;
  onRetry: () => void;
}

export const RecoveryPanel: React.FC<RecoveryPanelProps> = ({ health, errorMsg, onRetry }) => {
  return (
    <PageShell title="Startup Recovery">
      <div className="panel" style={{ maxWidth: '600px', margin: '0 auto', marginTop: '2rem' }}>
        <h3 style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>Backend offline</h3>
        <p style={{ marginBottom: '1rem' }}>The Cameleer frontend loaded, but Tauri backend commands are failing or degraded.</p>
        
        <div style={{ backgroundColor: 'var(--surface-2)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text)' }}>
          <p><strong>App status:</strong> {health?.app_status || 'offline'}</p>
          <p><strong>Database status:</strong> {health?.database_status || 'offline'}</p>
          <p><strong>Camelid status:</strong> {health?.camelid_status || 'unknown'}</p>
          <p><strong>Schema version:</strong> {health?.schema_version} / {health?.required_schema_version}</p>
          <p><strong>Database path:</strong> {health?.database_path || 'unknown'}</p>
          <div style={{ marginTop: '0.5rem', color: 'var(--color-danger)' }}>
            <strong>Errors:</strong> {errorMsg || health?.errors.join(', ') || 'Unknown connection error.'}
          </div>
        </div>

        <p style={{ marginBottom: '1rem' }}>
          This usually means:<br/>
          - the command is not registered<br/>
          - the Rust backend failed startup<br/>
          - the database failed initialization<br/>
          - the frontend command name does not match the Rust command name
        </p>

        <p style={{ marginBottom: '1.5rem', fontWeight: 'bold' }}>Next step: Open the dev console and run the P0 backend health smoke test.</p>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={onRetry}>Retry backend check</button>
          <button style={{ backgroundColor: 'var(--color-panel-muted)', color: 'var(--color-text)' }} onClick={() => navigator.clipboard.writeText(JSON.stringify({health, errorMsg}, null, 2))}>
            Copy diagnostics
          </button>
        </div>
      </div>
    </PageShell>
  );
};
