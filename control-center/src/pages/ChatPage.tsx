import React, { useEffect, useState } from 'react';
import { getMessages, saveMessage, triggerAgentReply, Message } from '../api/chat';
import { getAgents } from '../api/agents';
import { Agent } from '../types';
import { LoadingSpinner, ErrorBanner } from '../components/common/UIStates';

export const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [input, setInput] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');

  const sessionId = "global-chat"; // Simple global session for MVP

  const loadData = () => {
    setLoading(true);
    Promise.all([
      getMessages(sessionId),
      getAgents()
    ])
    .then(([msgs, agts]) => {
      setMessages(msgs);
      setAgents(agts);
      if (agts.length > 0 && !selectedAgentId) setSelectedAgentId(agts[0].id);
    })
    .catch((e: any) => setError(e.toString()))
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    try {
      await saveMessage(sessionId, "user", input, "human-user");
      setInput('');
      const msgs = await getMessages(sessionId);
      setMessages(msgs);

      if (selectedAgentId) {
        await triggerAgentReply(sessionId, selectedAgentId);
        const updatedMsgs = await getMessages(sessionId);
        setMessages(updatedMsgs);
      }
    } catch (err: any) {
      setError(err.toString());
    }
  };

  if (loading && messages.length === 0) return <LoadingSpinner />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3>Workspace Chat</h3>
        <select value={selectedAgentId} onChange={e => setSelectedAgentId(e.target.value)} style={{ padding: '0.5rem' }}>
          <option value="">(No Agent Reply)</option>
          {agents.map(a => <option key={a.id} value={a.id}>Talk to {a.name}</option>)}
        </select>
      </div>

      {error && <ErrorBanner message={error} />}

      <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'white', padding: '1rem', borderRadius: '4px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {messages.map(m => (
          <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', backgroundColor: m.role === 'user' ? '#007bff' : '#e9ecef', color: m.role === 'user' ? 'white' : 'black', padding: '0.8rem', borderRadius: '8px', maxWidth: '70%' }}>
            <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.2rem' }}>{m.role} {m.sender_id ? `(${m.sender_id})` : ''}</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', marginTop: '1rem', gap: '0.5rem' }}>
        <input 
          type="text" 
          value={input} 
          onChange={e => setInput(e.target.value)} 
          placeholder="Type your message..." 
          style={{ flex: 1, padding: '0.8rem', borderRadius: '4px', border: '1px solid #ccc' }}
        />
        <button type="submit" style={{ padding: '0 1.5rem', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Send
        </button>
      </form>
    </div>
  );
};
