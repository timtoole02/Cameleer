import React from 'react';

export const LoadingSpinner: React.FC = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>Loading...</div>
);

export const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ backgroundColor: '#f8d7da', color: '#721c24', padding: '1rem', borderRadius: '4px', margin: '1rem 0' }}>
    {message}
  </div>
);

export const EmptyState: React.FC<{ title: string, description: string }> = ({ title, description }) => (
  <div style={{ textAlign: 'center', padding: '3rem', color: '#6c757d' }}>
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
);
