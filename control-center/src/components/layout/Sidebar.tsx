import React from 'react';
import { useAppStore } from '../../state/appStore';

const TABS = ['Chat', 'Kanban', 'Backlog', 'Agents', 'Memory', 'Context', 'Models', 'Runtime', 'Audit', 'Settings'];

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();

  return (
    <div style={{
      width: '240px',
      backgroundColor: 'var(--color-sidebar)',
      color: 'var(--color-text-on-dark)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '1rem 0'
    }}>
      <div style={{ padding: '0 1.5rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.2rem', margin: 0 }}>Cameleer</h1>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: isActive ? 'var(--sidebar-active-bg, #1f2937)' : 'transparent',
                color: isActive ? 'var(--sidebar-text, #f9fafb)' : 'var(--sidebar-muted, #cbd5e1)',
                textAlign: 'left',
                padding: '0.8rem 1.5rem',
                border: 'none',
                borderLeft: isActive ? '4px solid var(--sidebar-active-border, #60a5fa)' : '4px solid transparent',
                borderRadius: '0',
                cursor: 'pointer',
                fontSize: '0.95rem',
                fontWeight: isActive ? 600 : 500,
                width: '100%',
                display: 'block',
                transition: 'all 0.15s ease'
              }}
            >
              {tab}
            </button>
          );
        })}
      </nav>
    </div>
  );
};
