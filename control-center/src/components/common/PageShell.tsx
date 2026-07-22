import React from 'react';

interface PageShellProps {
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}

export const PageShell: React.FC<PageShellProps> = ({ title, children, actions }) => {
  return (
    <div className="page-shell">
      <div className="page-shell-header">
        <h2>{title}</h2>
        {actions && <div>{actions}</div>}
      </div>
      <div className="page-shell-body">
        {children}
      </div>
    </div>
  );
};
