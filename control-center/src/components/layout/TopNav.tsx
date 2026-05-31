import React from 'react';
import { useAppStore } from '../../state/appStore';

export const TopNav: React.FC = () => {
  const { activeTab, backendHealth } = useAppStore();

  return (
    <header className="layout-topnav" style={{ height: '60px', borderBottom: '1px solid #ccc', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1rem' }}>
      <h2>{activeTab}</h2>
      <div>
        <span style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem', borderRadius: '12px', backgroundColor: backendHealth === 'healthy' ? '#d4edda' : '#f8d7da' }}>
          Backend: {backendHealth}
        </span>
      </div>
    </header>
  );
};
