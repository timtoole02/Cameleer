import React, { useEffect, useState } from 'react';
import { getAgents } from '../api/agents';
import { Agent } from '../types';
import { LoadingSpinner, ErrorBanner, EmptyState } from '../components/common/UIStates';

export const AgentsPage: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getAgents()
      .then(setAgents)
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (agents.length === 0) return <EmptyState title="No Agents" description="You have not created any agents yet." />;

  return (
    <div>
      <h3>Agent Registry</h3>
      <ul>
        {agents.map(a => <li key={a.id}>{a.name} ({a.role}) - {a.status}</li>)}
      </ul>
    </div>
  );
};
