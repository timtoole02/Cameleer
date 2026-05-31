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
    if (!backendHealth) {
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

  // Compute precise disable reason
  let disableReason = "";
  if (!activeProjectId) {
    disableReason = "Workspace not selected. Select a workspace to start.";
  } else if (!selectedAgentId) {
    disableReason = "Agent not selected. Select an agent to chat.";
  } else if (backendHealth?.database_status !== 'ready') {
    if (backendHealth?.database_status === 'schema_error') {
      disableReason = `Database schema error. ${
        backendHealth.errors.length > 0 ? backendHealth.errors.join(", ") : "Missing columns/tables."
      }`;
    } else {
      disableReason = `Database is not ready (Status: ${backendHealth?.database_status || 'offline'}).`;
    }
  } else if (backendHealth?.camelid_status !== 'connected') {
    disableReason = `Camelid is offline at ${backendHealth?.camelid_endpoint || 'http://127.0.0.1:8181'}.`;
  } else if (!backendHealth?.camelid_model) {
    disableReason = "No model is loaded.";
  }

  const canSend = !disableReason;
  const selectedAgentName = agents.find(a => a.id === selectedAgentId)?.name || selectedAgentId || 'None';

  const renderEmptyState = () => (
    <EmptyState title="No messages yet" description="">
      <div style={{ textAlign: 'left', marginBottom: '1rem', backgroundColor: 'var(--surface-2)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)' }}>
        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text)' }}><strong>Workspace:</strong> {activeProjectName || 'None'}</p>
        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text)' }}><strong>Agent:</strong> {selectedAgentName}</p>
        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text)' }}><strong>DB Status:</strong> {backendHealth?.database_status || 'offline'}</p>
        <p style={{ margin: '0', color: 'var(--text)' }}><strong>Model Loaded:</strong> {backendHealth?.camelid_model || 'none'}</p>
      </div>
      <p style={{ color: 'var(--text-muted)' }}>Send a message below to start a thread.</p>
    </EmptyState>
  );

  if (loading && messages.length === 0) return <PageShell title="Workspace Chat"><LoadingState /></PageShell>;

  const agentSelect = (
    <select value={selectedAgentId || ''} onChange={e => setSelectedAgentId(e.target.value)} style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
      <option value="">(No Agent Selected)</option>
      {agents.map(a => <option key={a.id} value={a.id}>Talk to {a.name}</option>)}
    </select>
  );

  return (
    <PageShell title="Workspace Chat" actions={agentSelect}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Diagnostics subheader row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 16px',
          backgroundColor: 'var(--surface-2)',
          borderRadius: '8px',
          border: '1px solid var(--border)',
          marginBottom: '1rem',
          fontSize: '0.8rem'
        }}>
          <div style={{ color: 'var(--text)' }}><strong>Agent:</strong> {selectedAgentName}</div>
          <div style={{ color: 'var(--text)' }}>
            <strong>DB:</strong> <span style={{ color: backendHealth?.database_status === 'ready' ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 'bold' }}>{backendHealth?.database_status || 'offline'}</span>
          </div>
          <div style={{ color: 'var(--text)' }}>
            <strong>Camelid:</strong> <span style={{ color: backendHealth?.camelid_status === 'connected' ? 'var(--success-text)' : 'var(--danger-text)', fontWeight: 'bold' }}>{backendHealth?.camelid_status || 'offline'}</span>
          </div>
          <div style={{ color: 'var(--text)' }}><strong>Model:</strong> {backendHealth?.camelid_model || 'none'}</div>
        </div>

        {error && <div style={{ marginBottom: '1rem' }}><ErrorState message={error} onRetry={loadData} /></div>}

        {/* Diagnostics details if chat is unavailable */}
        {!canSend && (
          <div style={{
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger-text)',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid rgba(153, 27, 27, 0.15)',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Chat unavailable</h4>
            <p style={{ margin: '0 0 0.5rem 0' }}>{disableReason}</p>
            {backendHealth?.database_status === 'schema_error' && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <strong>Fix:</strong> Run migrations or click <strong>Reset Dev Database</strong> in Settings after migration repair.
              </div>
            )}
            {backendHealth?.camelid_status === 'offline' && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
                <strong>Fix:</strong> Ensure Camelid inference service is running on <code>{backendHealth.camelid_endpoint}</code>.
              </div>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', backgroundColor: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', padding: messages.length === 0 ? 0 : '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {messages.length === 0 ? renderEmptyState() : messages.map(m => (
            <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', backgroundColor: m.role === 'user' ? 'var(--accent)' : 'var(--surface-2)', color: m.role === 'user' ? '#fff' : 'var(--text)', padding: '0.8rem', borderRadius: '8px', maxWidth: '70%', border: m.role !== 'user' ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '0.2rem' }}>{m.role} {m.sender_id ? `(${m.sender_id})` : ''}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          ))}
        </div>

        {/* Input box showing disable reason directly above the input */}
        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', marginTop: '1rem', gap: '0.5rem' }}>
          {!canSend && (
            <div style={{ fontSize: '0.8rem', color: 'var(--danger-text)', fontWeight: 600 }}>
              Chat disabled: {disableReason}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input 
              type="text" 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              placeholder={canSend ? "Type your message..." : "Chat is disabled"} 
              disabled={!canSend}
              style={{ flex: 1, padding: '0.8rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text)' }}
            />
            <button type="submit" disabled={!canSend || !input.trim()} style={{ borderRadius: 'var(--radius)', padding: '0 1.5rem', fontWeight: 'bold' }}>
              Send
            </button>
          </div>
        </form>
      </div>
    </PageShell>
  );
};

