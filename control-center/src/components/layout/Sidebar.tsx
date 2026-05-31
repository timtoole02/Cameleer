import React from 'react';
import { useAppStore } from '../../state/appStore';

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab } = useAppStore();
  const tabs = ['Chat', 'Kanban', 'Backlog', 'Agents', 'Memory', 'Models', 'Runtime', 'Audit', 'Settings'];

  return (
    <div className="layout-sidebar" style={{ width: '250px', borderRight: '1px solid #ccc', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <h3>Workspace</h3>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.5rem',
              textAlign: 'left',
              backgroundColor: activeTab === tab ? '#e0e0e0' : 'transparent',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '4px'
            }}
          >
            {tab}
          </button>
        ))}
      </nav>
    </div>
  );
};
