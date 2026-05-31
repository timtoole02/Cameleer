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
        
        <div style={{ backgroundColor: '#f8f9fa', padding: '1rem', borderRadius: '4px', marginBottom: '1rem', fontSize: '0.9rem' }}>
          <p><strong>Backend status:</strong> {health?.status || 'offline'}</p>
          <p><strong>Database status:</strong> {health?.database_ready ? 'Ready' : 'Not Ready'}</p>
          <p><strong>Migration status:</strong> {health?.migrations_applied ? 'Applied' : 'Pending'}</p>
          <p><strong>Active project:</strong> {health?.active_project_id || 'None'}</p>
          <p><strong>Default model profile:</strong> {health?.default_model_profile_id || 'None'}</p>
          <div style={{ marginTop: '0.5rem', color: 'var(--color-danger)' }}>
            <strong>Error message:</strong> {errorMsg || health?.message || 'Unknown connection error.'}
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
