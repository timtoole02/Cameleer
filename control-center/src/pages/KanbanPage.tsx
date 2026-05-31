import React, { useEffect, useState } from 'react';
import { getBoardSnapshot } from '../api/kanban';
import { KanbanCard } from '../types';
import { LoadingSpinner, ErrorBanner, EmptyState } from '../components/common/UIStates';

export const KanbanPage: React.FC = () => {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBoardSnapshot("default-workspace")
      .then(setCards)
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (cards.length === 0) return <EmptyState title="Empty Board" description="No tasks are currently on the Kanban board." />;

  return (
    <div>
      <h3>Kanban Board</h3>
      <div>{cards.length} cards loaded.</div>
    </div>
  );
};
