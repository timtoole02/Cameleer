import React from 'react';

interface WorkspaceAreaProps {
  children: React.ReactNode;
}

export const WorkspaceArea: React.FC<WorkspaceAreaProps> = ({ children }) => {
  return (
    <main className="layout-workspace-area">
      {children}
    </main>
  );
};
