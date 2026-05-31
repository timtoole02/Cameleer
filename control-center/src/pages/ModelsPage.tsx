import React, { useEffect, useState } from 'react';
import { listModelCatalog } from '../api/models';
import { ModelCatalogEntry } from '../types';
import { LoadingSpinner, ErrorBanner, EmptyState } from '../components/common/UIStates';

export const ModelsPage: React.FC = () => {
  const [models, setModels] = useState<ModelCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listModelCatalog()
      .then(setModels)
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorBanner message={error} />;
  if (models.length === 0) return <EmptyState title="No Models" description="No models are currently loaded." />;

  return (
    <div>
      <h3>Models</h3>
      <ul>
        {models.map(m => <li key={m.model_id}>{m.display_name} ({m.compatibility_status})</li>)}
      </ul>
    </div>
  );
};
