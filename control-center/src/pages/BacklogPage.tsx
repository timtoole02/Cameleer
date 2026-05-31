import React, { useEffect, useState } from 'react';
import { getBacklogSnapshot, createBacklogItem, convertBacklogItemToCard } from '../api/backlog';
import { BacklogItem } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { PageShell } from '../components/common/PageShell';

export const BacklogPage: React.FC = () => {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const loadBacklog = () => {
    setLoading(true);
    getBacklogSnapshot("default-workspace")
      .then(setItems)
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBacklog();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await createBacklogItem("default-workspace", title, description);
      setTitle('');
      setDescription('');
      setShowForm(false);
      loadBacklog();
    } catch (err: any) {
      setError(err.toString());
    }
  };

  const handlePromote = async (id: string) => {
    try {
      await convertBacklogItemToCard(id);
      loadBacklog();
    } catch (err: any) {
      setError(err.toString());
    }
  };

  if (loading) return <PageShell title="Backlog"><LoadingState /></PageShell>;
  
  return (
    <PageShell title="Backlog">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Backlog</h3>
          <button onClick={() => setShowForm(!showForm)} style={{ padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>
            {showForm ? 'Cancel' : 'Add Item'}
          </button>
        </div>

        {error && <ErrorState message={error} />}

        {showForm && (
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', backgroundColor: 'white', borderRadius: '4px', border: '1px solid #ccc' }}>
            <input 
              type="text" 
              placeholder="Title" 
              value={title} 
              onChange={e => setTitle(e.target.value)} 
              style={{ padding: '0.5rem' }}
              autoFocus
            />
            <textarea 
              placeholder="Description..." 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              style={{ padding: '0.5rem', minHeight: '60px' }}
            />
            <button type="submit" style={{ alignSelf: 'flex-start', padding: '0.5rem 1rem', cursor: 'pointer', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}>
              Save Item
            </button>
          </form>
        )}

        {items.length === 0 && !showForm ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>No tasks in the backlog. Add one to get started.</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
                  <th style={{ padding: '0.5rem' }}>Title</th>
                  <th style={{ padding: '0.5rem' }}>Status</th>
                  <th style={{ padding: '0.5rem' }}>Priority</th>
                  <th style={{ padding: '0.5rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '0.5rem' }}>
                      <strong>{item.title}</strong>
                      <div style={{ fontSize: '0.8rem', color: '#666' }}>{item.description}</div>
                    </td>
                    <td style={{ padding: '0.5rem' }}>{item.status}</td>
                    <td style={{ padding: '0.5rem' }}>{item.priority}</td>
                    <td style={{ padding: '0.5rem' }}>
                      {item.status !== 'ready_for_board' && (
                        <button 
                          onClick={() => handlePromote(item.id)}
                          style={{ padding: '0.2rem 0.5rem', cursor: 'pointer', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px', fontSize: '0.8rem' }}
                        >
                          Promote to Board
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
};
