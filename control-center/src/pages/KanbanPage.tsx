import React, { useEffect, useState } from 'react';
import { getBoardSnapshot, moveCard } from '../api/kanban';
import { KanbanCard } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { PageShell } from '../components/common/PageShell';

const COLUMNS = ['Ready', 'In Progress', 'Done'];

export const KanbanPage: React.FC = () => {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBoard = () => {
    setLoading(true);
    getBoardSnapshot("default-workspace")
      .then(setCards)
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBoard();
  }, []);

  const handleMove = async (id: string, newStatus: string) => {
    try {
      setError(null); // clear prior errors
      await moveCard(id, newStatus);
      loadBoard();
    } catch (err: any) {
      setError(err.toString());
    }
  };

  if (loading) return <PageShell title="Kanban"><LoadingState /></PageShell>;

  return (
    <PageShell title="Kanban">
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3>Kanban Board</h3>
          <button onClick={loadBoard} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Refresh</button>
        </div>

        {error && <ErrorState message={error} />}

        {cards.length === 0 ? (
          <p>No tasks are currently on the Kanban board. Promote them from the backlog.</p>
        ) : (
          <div style={{ display: 'flex', flex: 1, gap: '1rem', overflowX: 'auto' }}>
            {COLUMNS.map(col => {
              const colCards = cards.filter(c => c.status.toLowerCase() === col.toLowerCase());
              return (
                <div key={col} style={{ flex: 1, minWidth: '300px', backgroundColor: '#e9ecef', borderRadius: '4px', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', padding: '0.5rem', borderBottom: '2px solid #ccc' }}>{col} ({colCards.length})</h4>
                  <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {colCards.map(card => (
                      <div key={card.id} style={{ backgroundColor: 'white', padding: '0.8rem', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <strong>{card.title}</strong>
                        {card.description && <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.5rem 0' }}>{card.description}</p>}
                        <div style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'space-between', color: '#999', marginBottom: '0.5rem' }}>
                          <span>Priority: {card.priority}</span>
                          <span>Assignee: {card.assigned_agent_id || 'Unassigned'}</span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                          {COLUMNS.filter(c => c.toLowerCase() !== col.toLowerCase()).map(targetCol => (
                            <button 
                              key={targetCol}
                              onClick={() => handleMove(card.id, targetCol)}
                              style={{ flex: 1, padding: '0.2rem', fontSize: '0.7rem', cursor: 'pointer' }}
                            >
                              Move to {targetCol}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
};
