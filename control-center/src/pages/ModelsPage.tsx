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
      setApiKey(''); // clear for security
      loadData();
    } catch (err: any) {
      setError(err.toString());
    }
  };

  if (loading) return <PageShell title="Model Catalog"><LoadingState /></PageShell>;
  if (error) return <PageShell title="Model Catalog"><ErrorState message={error} onRetry={loadData} /></PageShell>;

  return (
    <PageShell title="Model Catalog">
      <div style={{ display: 'flex', gap: '1rem' }}>
        {/* Providers Config Form */}
        <div style={{ flex: 1, backgroundColor: 'white', padding: '1rem', borderRadius: '4px' }}>
          <h4>Provider Configuration</h4>
          <form onSubmit={handleSaveConfig} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label>Provider Name</label>
            <input type="text" value={provider} onChange={e => setProvider(e.target.value)} style={{ padding: '0.5rem' }} />
            
            <label>Endpoint URL (OpenAI Compatible)</label>
            <input type="text" value={endpoint} onChange={e => setEndpoint(e.target.value)} style={{ padding: '0.5rem' }} />
            
            <label>API Key</label>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." style={{ padding: '0.5rem' }} />
            
            <button type="submit" style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save Config</button>
          </form>

          <h5 style={{ marginTop: '1rem' }}>Saved Providers</h5>
          <ul style={{ listStyleType: 'none', padding: 0 }}>
            {configs.map(c => (
              <li key={c.provider} style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                <strong>{c.provider}</strong> - {c.endpoint_url}
              </li>
            ))}
          </ul>
        </div>

        {/* Local Model Catalog */}
        <div style={{ flex: 2, backgroundColor: 'white', padding: '1rem', borderRadius: '4px' }}>
          <h4>Model Catalog</h4>
          {models.length === 0 ? <p>No models imported or configured.</p> : (
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd' }}>
                  <th style={{ padding: '0.5rem' }}>Name</th>
                  <th style={{ padding: '0.5rem' }}>Provider</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                  <th style={{ padding: '0.5rem' }}>Connection Test</th>
                </tr>
              </thead>
              <tbody>
                {models.map(m => (
                  <tr key={m.model_id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}><strong>{m.display_name}</strong></td>
                    <td style={{ padding: '0.5rem' }}>{m.provider}</td>
                    <td style={{ padding: '0.5rem' }}>{m.install_status}</td>
                    <td style={{ padding: '0.5rem' }}>
                      <button 
                        onClick={() => handleTest(m.model_id)}
                        disabled={testingModel === m.model_id}
                        style={{ padding: '0.2rem 0.5rem', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc' }}
                      >
                        {testingModel === m.model_id ? 'Testing...' : 'Smoke Test'}
                      </button>
                      {testResult?.id === m.model_id && (
                        <span style={{ marginLeft: '0.5rem', color: testResult.success ? 'green' : 'red' }}>
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
