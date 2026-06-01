import React from 'react';

interface BacklogDetailDrawerProps {
  children: React.ReactNode;
}

export const BacklogDetailDrawer: React.FC<BacklogDetailDrawerProps> = ({ children }) => (
  <aside className="backlog-drawer">{children}</aside>
);
