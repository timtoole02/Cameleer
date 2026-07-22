import React, { useEffect, useState } from 'react';
import { listModelCatalog, runModelSmokeTest, listProviderConfigs, saveProviderConfig, Model, ProviderConfig } from '../api/models';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { PageShell } from '../components/common/PageShell';

export const ModelsPage: React.FC = () => {
  const [models, setModels] = useState<Model[]>([]);
  const [configs, setConfigs] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Smoke test state
  const [testingModel, setTestingModel] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string, success: boolean } | null>(null);

  // Config form state
  const [provider, setProvider] = useState('openai');
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      listModelCatalog().catch(() => []), // gracefully handle if empty
      listProviderConfigs().catch(() => [])
    ])
    .then(([m, c]) => {
      setModels(m);
      setConfigs(c);
    })
    .catch((e: any) => setError(e.toString()))
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTest = async (modelId: string) => {
    setTestingModel(modelId);
    setTestResult(null);
    try {
      const success = await runModelSmokeTest(modelId);
      setTestResult({ id: modelId, success });
    } catch {
      setTestResult({ id: modelId, success: false });
    }
    setTestingModel(null);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveProviderConfig(provider, endpoint, apiKey);
      setApiKey('');
      loadData();
    } catch (err: any) {
      setError(err.toString());
    }
  };

  if (loading) return <PageShell title="Model Catalog"><LoadingState /></PageShell>;
  if (error) return <PageShell title="Model Catalog"><ErrorState message={error} onRetry={loadData} /></PageShell>;

  return (
    <PageShell title="Model Catalog">
      <div className="split-layout">
        {/* Providers Config Form */}
        <div className="panel form-dark">
          <h4 className="panel-title">Provider Configuration</h4>
          <form onSubmit={handleSaveConfig}>
            <div className="form-field">
              <label>Provider Name</label>
              <input type="text" value={provider} onChange={e => setProvider(e.target.value)} />
            </div>
            <div className="form-field">
              <label>Endpoint URL (OpenAI Compatible)</label>
              <input type="text" value={endpoint} onChange={e => setEndpoint(e.target.value)} />
            </div>
            <div className="form-field">
              <label>API Key</label>
              <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." />
            </div>
            <button type="submit">Save Config</button>
          </form>

          <h5 className="panel-title" style={{ marginTop: 'var(--space-md)' }}>Saved Providers</h5>
          <ul className="plain-list">
            {configs.map(c => (
              <li key={c.provider}>
                <strong>{c.provider}</strong> <span className="muted">{c.endpoint_url}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Local Model Catalog */}
        <div className="panel">
          <h4 className="panel-title">Model Catalog</h4>
          {models.length === 0 ? <p className="muted">No models imported or configured.</p> : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Connection Test</th>
                </tr>
              </thead>
              <tbody>
                {models.map(m => (
                  <tr key={m.model_id}>
                    <td><strong>{m.display_name}</strong></td>
                    <td>{m.provider}</td>
                    <td>{m.install_status}</td>
                    <td>
                      <button
                        className="secondary-button"
                        onClick={() => handleTest(m.model_id)}
                        disabled={testingModel === m.model_id}
                      >
                        {testingModel === m.model_id ? 'Testing...' : 'Smoke Test'}
                      </button>
                      {testResult?.id === m.model_id && (
                        <span className={testResult.success ? 'test-result-pass' : 'test-result-fail'} style={{ marginLeft: 'var(--space-sm)' }}>
                          {testResult.success ? '✓ OK' : '✗ Failed'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </PageShell>
  );
};
