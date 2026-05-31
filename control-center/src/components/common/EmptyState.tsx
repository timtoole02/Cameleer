import React from 'react';

interface EmptyStateProps {
  title: string;
  description: string;
  children?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, children }) => {
  return (
    <div className="empty-state" style={{ padding: '3rem 1rem', width: '100%', height: '100%' }}>
      <h3 style={{ color: 'var(--color-text)', marginBottom: '0.5rem' }}>{title}</h3>
      <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{description}</p>
      {children}
    </div>
  );
};
