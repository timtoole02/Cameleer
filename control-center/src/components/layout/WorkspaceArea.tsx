import React from 'react';

interface WorkspaceAreaProps {
  children: React.ReactNode;
}

export const WorkspaceArea: React.FC<WorkspaceAreaProps> = ({ children }) => {
  return (
    <main className="layout-workspace-area" style={{ flex: 1, overflow: 'auto', padding: '1rem', backgroundColor: '#f9f9f9' }}>
      {children}
    </main>
  );
};
