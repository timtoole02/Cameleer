import React, { useEffect, useState } from 'react';
import { getBacklogSnapshot } from '../api/backlog';
import { BacklogItem } from '../types';
import { LoadingSpinner, ErrorBanner, EmptyState } from '../components/common/UIStates';

export const BacklogPage: React.FC = () => {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBacklogSnapshot("default-workspace")
      .then(setItems)
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (items.length === 0) return <EmptyState title="Empty Backlog" description="No tasks in the backlog." />;

  return (
    <div>
      <h3>Backlog</h3>
      <ul>
        {items.map(i => <li key={i.id}>{i.title} - {i.status}</li>)}
      </ul>
    </div>
  );
};
