import React, { useEffect, useMemo, useState } from 'react';
import { getMessages, saveMessage, triggerAgentReply, Message } from '../api/chat';
import { getAgents } from '../api/agents';
import { Agent } from '../types';
import { LoadingState } from '../components/common/LoadingState';
import { ErrorState } from '../components/common/ErrorState';
import { EmptyState } from '../components/common/EmptyState';
import { PageShell } from '../components/common/PageShell';
import { useAppStore } from '../state/appStore';

const GLOBAL_CHANNEL_ID = 'global';

const channelSessionId = (channelId: string) =>
  channelId === GLOBAL_CHANNEL_ID ? 'global-chat' : `agent-chat:${channelId}`;

const initialsFor = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('') || '?';

export const ChatPage: React.FC = () => {
  const { backendHealth, activeProjectId, activeProjectName, setSelectedAgentId } = useAppStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState(GLOBAL_CHANNEL_ID);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');

  const sessionId = channelSessionId(selectedChannelId);
  const selectedAgent = agents.find(agent => agent.id === selectedChannelId) || null;
  const isGlobalChannel = selectedChannelId === GLOBAL_CHANNEL_ID;
  const globalAgents = useMemo(
    () => agents.filter(agent => agent.can_talk_globally),
    [agents]
  );

  const loadData = () => {
    if (!backendHealth) {
      setLoading(false);
      return;
    }

    setLoading(messages.length === 0);
    setError(null);
    Promise.all([
      getMessages(sessionId).catch(() => []),
      getAgents().catch(() => [])
    ])
      .then(([msgs, agts]) => {
        setMessages(msgs);
        setAgents(agts);
        if (selectedChannelId !== GLOBAL_CHANNEL_ID && !agts.some(agent => agent.id === selectedChannelId)) {
          setSelectedChannelId(GLOBAL_CHANNEL_ID);
          setSelectedAgentId(null);
        }
      })
      .catch((e: any) => setError(e.toString()))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [backendHealth?.database_status, sessionId]);

  const selectGlobalChannel = () => {
    setSelectedChannelId(GLOBAL_CHANNEL_ID);
    setSelectedAgentId(null);
    setInput('');
    setError(null);
  };

  const selectAgentChannel = (agent: Agent) => {
    setSelectedChannelId(agent.id);
    setSelectedAgentId(agent.id);
    setInput('');
    setError(null);
  };

  let disableReason = '';
  if (!activeProjectId) {
    disableReason = 'Workspace not selected. Select a workspace to start.';
  } else if (backendHealth?.database_status !== 'ready') {
    if (backendHealth?.database_status === 'schema_error') {
      disableReason = `Database schema error. ${
        backendHealth.errors.length > 0 ? backendHealth.errors.join(', ') : 'Missing columns/tables.'
      }`;
    } else {
      disableReason = `Database is not ready (Status: ${backendHealth?.database_status || 'offline'}).`;
    }
  } else if (backendHealth?.camelid_status !== 'connected') {
    disableReason = `Camelid is offline at ${backendHealth?.camelid_endpoint || 'http://127.0.0.1:8181'}.`;
  } else if (!backendHealth?.camelid_model) {
    disableReason = 'No model is loaded.';
  } else if (isGlobalChannel && globalAgents.length === 0) {
    disableReason = 'No agents are enabled for global chat.';
  } else if (!isGlobalChannel && !selectedAgent) {
    disableReason = 'Agent not found. Pick another direct chat.';
  }

  const canSend = !disableReason && !sending;
  const channelTitle = isGlobalChannel ? 'Global Chat' : selectedAgent?.name || 'Direct Chat';
  const channelSubtitle = isGlobalChannel
    ? `${globalAgents.length} globally available agent${globalAgents.length === 1 ? '' : 's'}`
    : selectedAgent?.role || 'Direct agent channel';

  const refreshMessages = async () => {
    const updatedMsgs = await getMessages(sessionId);
    setMessages(updatedMsgs);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content || !canSend) return;

    setSending(true);
    setError(null);
    try {
      await saveMessage(
        sessionId,
        'user',
        content,
        'human-user',
        activeProjectId || undefined,
        undefined,
        isGlobalChannel ? undefined : selectedAgent?.id
      );
      setInput('');
      await refreshMessages();

      if (isGlobalChannel) {
        const failures: string[] = [];
        for (const agent of globalAgents) {
          try {
            await triggerAgentReply(sessionId, agent.id, activeProjectId || undefined);
            await refreshMessages();
          } catch (err: any) {
            failures.push(`${agent.name}: ${err.toString()}`);
          }
        }
        if (failures.length > 0) {
          setError(`Some agents could not reply. ${failures.join(' ')}`);
        }
      } else if (selectedAgent) {
        await triggerAgentReply(sessionId, selectedAgent.id, activeProjectId || undefined);
        await refreshMessages();
      }
    } catch (err: any) {
      setError(err.toString());
    } finally {
      setSending(false);
    }
  };

  const renderEmptyState = () => (
    <EmptyState title={`No messages in ${channelTitle}`} description="">
      <div style={{
        textAlign: 'left',
        marginBottom: '1rem',
        backgroundColor: 'var(--surface-2)',
        padding: '1rem',
        borderRadius: '8px',
        border: '1px solid var(--border)'
      }}>
        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text)' }}><strong>Workspace:</strong> {activeProjectName || 'None'}</p>
        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text)' }}><strong>Channel:</strong> {channelTitle}</p>
        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--text)' }}><strong>DB Status:</strong> {backendHealth?.database_status || 'offline'}</p>
        <p style={{ margin: '0', color: 'var(--text)' }}><strong>Model Loaded:</strong> {backendHealth?.camelid_model || 'none'}</p>
      </div>
      <p style={{ color: 'var(--text-muted)' }}>Send a message below to start this channel.</p>
    </EmptyState>
  );

  if (loading && messages.length === 0) {
    return <PageShell title="Workspace Chat"><LoadingState /></PageShell>;
  }

  return (
    <PageShell title="Workspace Chat">
      <div style={{
        display: 'grid',
        gridTemplateColumns: '260px minmax(0, 1fr)',
        height: '100%',
        minHeight: 0,
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        backgroundColor: 'var(--surface)'
      }}>
        <aside style={{
          borderRight: '1px solid var(--border)',
          backgroundColor: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0 }}>
              Channels
            </div>
          </div>

          <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={selectGlobalChannel}
              style={{
                width: '100%',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem',
                borderRadius: '8px',
                border: selectedChannelId === GLOBAL_CHANNEL_ID ? '1px solid var(--accent)' : '1px solid transparent',
                backgroundColor: selectedChannelId === GLOBAL_CHANNEL_ID ? 'var(--accent-soft)' : 'transparent',
                color: 'var(--text)'
              }}
            >
              <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '1rem' }}>#</span>
              <span>
                <span style={{ display: 'block', fontWeight: 700 }}>Global</span>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  Talk to everyone
                </span>
              </span>
            </button>
          </div>

          <div style={{ padding: '0.75rem 1rem 0.25rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>
            Direct Messages
          </div>
          <div style={{ overflowY: 'auto', padding: '0 0.75rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {agents.map(agent => {
              const active = selectedChannelId === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => selectAgentChannel(agent)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.65rem 0.75rem',
                    borderRadius: '8px',
                    border: active ? '1px solid var(--accent)' : '1px solid transparent',
                    backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                    color: 'var(--text)'
                  }}
                >
                  <span style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto',
                    backgroundColor: active ? 'var(--accent)' : 'var(--surface-2)',
                    color: active ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)',
                    fontWeight: 800,
                    fontSize: '0.75rem'
                  }}>
                    {initialsFor(agent.name)}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {agent.name}
                    </span>
                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.72rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {agent.role}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.25rem',
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--surface)'
          }}>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ color: 'var(--text)', margin: 0, fontSize: '1.05rem' }}>{channelTitle}</h3>
              <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0', fontSize: '0.82rem' }}>{channelSubtitle}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <span><strong style={{ color: backendHealth?.database_status === 'ready' ? 'var(--success-text)' : 'var(--danger-text)' }}>DB</strong> {backendHealth?.database_status || 'offline'}</span>
              <span><strong style={{ color: backendHealth?.camelid_status === 'connected' ? 'var(--success-text)' : 'var(--danger-text)' }}>Camelid</strong> {backendHealth?.camelid_status || 'offline'}</span>
              <span><strong>Model</strong> {backendHealth?.camelid_model || 'none'}</span>
            </div>
          </div>

          {error && <div style={{ margin: '1rem 1rem 0' }}><ErrorState message={error} onRetry={loadData} /></div>}

          {!canSend && (
            <div style={{
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger-text)',
              padding: '0.9rem 1rem',
              borderRadius: '8px',
              border: '1px solid rgba(153, 27, 27, 0.15)',
              margin: '1rem 1rem 0',
              fontSize: '0.9rem'
            }}>
              <strong>Chat unavailable</strong>
              <p style={{ margin: '0.35rem 0 0' }}>{disableReason}</p>
            </div>
          )}

          <div style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            padding: messages.length === 0 ? 0 : '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            backgroundColor: 'var(--surface)'
          }}>
            {messages.length === 0 ? renderEmptyState() : messages.map(message => {
              const isUser = message.role === 'user';
              const senderAgent = agents.find(agent => agent.id === message.sender_id);
              const senderLabel = isUser ? 'You' : senderAgent?.name || message.sender_id || message.role;
              return (
                <div
                  key={message.id}
                  style={{
                    display: 'flex',
                    alignSelf: isUser ? 'flex-end' : 'flex-start',
                    gap: '0.65rem',
                    maxWidth: '78%',
                    flexDirection: isUser ? 'row-reverse' : 'row'
                  }}
                >
                  <div style={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto',
                    backgroundColor: isUser ? 'var(--accent)' : 'var(--surface-2)',
                    color: isUser ? '#fff' : 'var(--text)',
                    border: '1px solid var(--border)',
                    fontWeight: 800,
                    fontSize: '0.75rem'
                  }}>
                    {isUser ? 'ME' : initialsFor(senderLabel)}
                  </div>
                  <div style={{
                    backgroundColor: isUser ? 'var(--accent)' : 'var(--surface-2)',
                    color: isUser ? '#fff' : 'var(--text)',
                    padding: '0.7rem 0.85rem',
                    borderRadius: '8px',
                    border: isUser ? 'none' : '1px solid var(--border)'
                  }}>
                    <div style={{ fontSize: '0.72rem', opacity: 0.78, marginBottom: '0.25rem', fontWeight: 700 }}>
                      {senderLabel}
                    </div>
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{message.content}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSend} style={{ padding: '1rem', borderTop: '1px solid var(--border)', backgroundColor: 'var(--surface)' }}>
            {!canSend && (
              <div style={{ fontSize: '0.8rem', color: 'var(--danger-text)', fontWeight: 600, marginBottom: '0.5rem' }}>
                Chat disabled: {disableReason}
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={canSend ? `Message ${isGlobalChannel ? '#global' : selectedAgent?.name || 'agent'}` : 'Chat is disabled'}
                disabled={!canSend}
                style={{
                  flex: 1,
                  padding: '0.85rem 0.95rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--surface)',
                  color: 'var(--text)'
                }}
              />
              <button
                type="submit"
                disabled={!canSend || !input.trim()}
                style={{ borderRadius: 'var(--radius)', padding: '0 1.35rem', fontWeight: 'bold', minWidth: 88 }}
              >
                {sending ? 'Sending' : 'Send'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </PageShell>
  );
};
