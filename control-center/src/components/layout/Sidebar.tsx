import React from 'react';
import { useAppStore } from '../../state/appStore';

const TABS = ['Chat', 'Kanban', 'Backlog', 'Agents', 'Memory', 'Models', 'Runtime', 'Audit', 'Settings'];

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
                background: isActive ? 'var(--color-primary)' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--color-text-muted-on-dark)',
                textAlign: 'left',
                padding: '0.8rem 1.5rem',
                border: 'none',
                borderRadius: '0',
                cursor: 'pointer',
                fontSize: '1rem',
                width: '100%',
                display: 'block'
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
