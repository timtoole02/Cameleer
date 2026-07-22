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
      <div className="chat-empty-details">
        <p><strong>Workspace:</strong> {activeProjectName || 'None'}</p>
        <p><strong>Channel:</strong> {channelTitle}</p>
        <p><strong>DB Status:</strong> {backendHealth?.database_status || 'offline'}</p>
        <p><strong>Model Loaded:</strong> {backendHealth?.camelid_model || 'none'}</p>
      </div>
      <p className="text-muted">Send a message below to start this channel.</p>
    </EmptyState>
  );

  if (loading && messages.length === 0) {
    return <PageShell title="Workspace Chat"><LoadingState /></PageShell>;
  }

  return (
    <PageShell title="Workspace Chat">
      <div className="chat-layout">
        <aside className="chat-rail">
          <div className="chat-rail-header">
            <div className="eyebrow">
              Channels
            </div>
          </div>

          <div className="chat-rail-section">
            <button
              type="button"
              onClick={selectGlobalChannel}
              className={selectedChannelId === GLOBAL_CHANNEL_ID ? 'chat-channel active' : 'chat-channel'}
            >
              <span className="chat-channel-glyph">#</span>
              <span className="min-w-0">
                <span className="chat-channel-name">Global</span>
                <span className="chat-channel-sub">
                  Talk to everyone
                </span>
              </span>
            </button>
          </div>

          <div className="chat-rail-label eyebrow">
            Direct Messages
          </div>
          <div className="chat-channel-list">
            {agents.map(agent => {
              const active = selectedChannelId === agent.id;
              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => selectAgentChannel(agent)}
                  className={active ? 'chat-channel active' : 'chat-channel'}
                >
                  <span className="chat-avatar">
                    {initialsFor(agent.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="chat-channel-name">
                      {agent.name}
                    </span>
                    <span className="chat-channel-sub">
                      {agent.role}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="chat-thread-pane">
          <div className="chat-thread-header">
            <div className="min-w-0">
              <h3>{channelTitle}</h3>
              <p>{channelSubtitle}</p>
            </div>
            <div className="stat-row">
              <span className="stat-tile"><strong className={backendHealth?.database_status === 'ready' ? 'stat-ok' : 'stat-err'}>DB</strong> {backendHealth?.database_status || 'offline'}</span>
              <span className="stat-tile"><strong className={backendHealth?.camelid_status === 'connected' ? 'stat-ok' : 'stat-err'}>Camelid</strong> {backendHealth?.camelid_status || 'offline'}</span>
              <span className="stat-tile"><strong>Model</strong> {backendHealth?.camelid_model || 'none'}</span>
            </div>
          </div>

          {error && <div className="chat-inline"><ErrorState message={error} onRetry={loadData} /></div>}

          {!canSend && (
            <div className="alert alert-danger chat-inline">
              <strong>Chat unavailable</strong>
              <p>{disableReason}</p>
            </div>
          )}

          <div className={messages.length === 0 ? 'chat-thread empty' : 'chat-thread'}>
            {messages.length === 0 ? renderEmptyState() : messages.map(message => {
              const isUser = message.role === 'user';
              const senderAgent = agents.find(agent => agent.id === message.sender_id);
              const senderLabel = isUser ? 'You' : senderAgent?.name || message.sender_id || message.role;
              return (
                <div
                  key={message.id}
                  className={isUser ? 'chat-message own' : 'chat-message'}
                >
                  <div className="chat-avatar">
                    {isUser ? 'ME' : initialsFor(senderLabel)}
                  </div>
                  <div className="chat-bubble">
                    <div className="chat-author">
                      {senderLabel}
                    </div>
                    <div className="chat-body">{message.content}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSend} className="chat-composer form-dark">
            {!canSend && (
              <div className="composer-note">
                Chat disabled: {disableReason}
              </div>
            )}
            <div className="chat-composer-row">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder={canSend ? `Message ${isGlobalChannel ? '#global' : selectedAgent?.name || 'agent'}` : 'Chat is disabled'}
                disabled={!canSend}
              />
              <button
                type="submit"
                disabled={!canSend || !input.trim()}
                className="chat-send"
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
