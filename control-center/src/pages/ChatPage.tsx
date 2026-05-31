import React, { useEffect, useState } from 'react';
import { getMessages, saveMessage, triggerAgentReply, Message } from '../api/chat';
import { getAgents } from '../api/agents';
import { Agent } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { PageShell } from '../components/common/PageShell';
import { useAppStore } from '../state/appStore';

export const ChatPage: React.FC = () => {
  const { backendHealth, activeProjectId, activeProjectName, selectedAgentId, setSelectedAgentId } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');

  const sessionId = "global-chat";

  const loadData = () => {
    if (!backendHealth || backendHealth.status !== 'connected') {
      setLoading(false);
      return;
    }

    setLoading(true);
    Promise.all([
      getMessages(sessionId).catch(() => []),
      getAgents().catch(() => [])
    ])
    .then(([msgs, agts]) => {
      setMessages(msgs);
      setAgents(agts);
      if (agts.length > 0 && !selectedAgentId) {
        setSelectedAgentId(agts[0].id);
      }
    })
    .catch((e: any) => setError(e.toString()))
    .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [backendHealth]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !canSend) return;

    try {
      await saveMessage(sessionId, "user", input, "human-user", activeProjectId || undefined, undefined, selectedAgentId || undefined);
      setInput('');
      const msgs = await getMessages(sessionId);
      setMessages(msgs);

      if (selectedAgentId) {
        await triggerAgentReply(sessionId, selectedAgentId, activeProjectId || undefined);
        const updatedMsgs = await getMessages(sessionId);
        setMessages(updatedMsgs);
      }
    } catch (err: any) {
      setError(err.toString());
    }
  };

  let disableReason = "";
  if (backendHealth?.status !== 'connected') disableReason = "Backend offline";
  else if (!activeProjectId) disableReason = "No project selected";
  else if (!selectedAgentId) disableReason = "No agent selected";
  else if (!backendHealth?.default_model_profile_id) disableReason = "Model profile missing";

  const canSend = !disableReason;

  const renderEmptyState = () => (
    <EmptyState title="No messages yet" description="">
      <div style={{ textAlign: 'left', marginBottom: '1rem', backgroundColor: 'var(--color-bg-dark)', padding: '1rem', borderRadius: '4px' }}>
        <p><strong>Project:</strong> {activeProjectName || 'None'}</p>
        <p><strong>Agent:</strong> {selectedAgentId || 'None'}</p>
        <p><strong>Backend:</strong> {backendHealth?.status || 'offline'}</p>
        <p><strong>Model:</strong> {backendHealth?.default_model_profile_id || 'None'}</p>
      </div>
      <p style={{ color: 'var(--color-text)' }}>Send a message below to start a thread.</p>
    </EmptyState>
  );

  if (loading && messages.length === 0) return <PageShell title="Workspace Chat"><LoadingState /></PageShell>;

  const agentSelect = (
    <select value={selectedAgentId || ''} onChange={e => setSelectedAgentId(e.target.value)} style={{ padding: '0.5rem', borderRadius: '4px' }}>
      <option value="">(No Agent Selected)</option>
      {agents.map(a => <option key={a.id} value={a.id}>Talk to {a.name}</option>)}
    </select>
  );

  return (
    <PageShell title="Workspace Chat" actions={agentSelect}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {error && <div style={{ marginBottom: '1rem' }}><ErrorState message={error} onRetry={loadData} /></div>}

        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--color-panel)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', padding: messages.length === 0 ? 0 : '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {messages.length === 0 ? renderEmptyState() : messages.map(m => (
            <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', backgroundColor: m.role === 'user' ? 'var(--color-primary)' : 'var(--color-panel-muted)', color: m.role === 'user' ? '#fff' : 'var(--color-text)', padding: '0.8rem', borderRadius: '8px', maxWidth: '70%', border: m.role !== 'user' ? '1px solid var(--color-border)' : 'none' }}>
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
            placeholder={canSend ? "Type your message..." : disableReason} 
            disabled={!canSend}
            style={{ flex: 1, padding: '0.8rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}
          />
          <button type="submit" disabled={!canSend || !input.trim()}>
            Send
          </button>
        </form>
      </div>
    </PageShell>
  );
};
