import React from 'react';

interface PageShellProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({ title, children, actions }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', borderBottom: '1px solid var(--color-border)', backgroundColor: 'var(--color-panel)' }}>
        <h2 style={{ color: 'var(--color-text)', margin: 0 }}>{title}</h2>
        {actions && <div>{actions}</div>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', backgroundColor: 'var(--color-panel-muted)' }}>
        {children}
      </div>
    </div>
  );
};
