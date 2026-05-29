import { clampText, formatCompactNumber, formatHistoryDate, formatPreview } from '../lib/formatters'

function getConversationStats(conversation) {
  const messageCount = conversation.messages?.length || 0
  const assistantCount = conversation.messages?.filter((message) => message.role === 'assistant').length || 0
  const latestMessage = conversation.messages?.[messageCount - 1]

  return {
    messageCount,
    assistantCount,
    latestMessage,
  }
}

export default function HistoryView({ filteredConversations, setSelectedConversationId, setTab, deleteConversation }) {
  const totalMessages = filteredConversations.reduce((sum, conversation) => sum + (conversation.messages?.length || 0), 0)
  const activeToday = filteredConversations.filter((conversation) => {
    if (!conversation.updated_at) return false
    return new Date(conversation.updated_at).toDateString() === new Date().toDateString()
  }).length
  const hasConversations = filteredConversations.length > 0

  return (
    <section className="view-stack history-view view-shell">
      <div className="panel panel-hero view-hero">
        <div className="view-hero-copy">
          <p className="panel-kicker">Persistent history</p>
          <h2>Local conversations, ready to revisit</h2>
          <p className="hero-summary">Every thread stays searchable on this machine, so it is easy to jump back into earlier work, skim what changed, and pick up the next prompt without losing context.</p>
        </div>
        <div className="view-hero-stats">
          <div className="context-chip context-chip-emphasis">
            <span>Conversations</span>
            <strong>{filteredConversations.length}</strong>
            <small>{hasConversations ? 'Visible in this history view right now' : 'Nothing matched the current history search'}</small>
          </div>
          <div className="context-chip">
            <span>Messages stored</span>
            <strong>{totalMessages}</strong>
            <small>{hasConversations ? `${activeToday} updated today` : 'Start a chat to build local history'}</small>
          </div>
        </div>
      </div>

      <div className="history-grid history-grid-polished">
        {filteredConversations.length === 0 && <div className="empty-state">No conversations matched this view. Try a broader search or start a fresh chat.</div>}
        {filteredConversations.map((conversation) => {
          const { messageCount, assistantCount, latestMessage } = getConversationStats(conversation)

          return (
            <article key={conversation.id} className="history-card history-card-polished">
              <div className="history-card-head">
                <div className="history-card-title-group">
                  <strong title={conversation.title || 'Untitled chat'}>{clampText(conversation.title || 'Untitled chat', 70) || 'Untitled chat'}</strong>
                  <span className="history-card-model" title={conversation.model_id || 'No model recorded'}>{conversation.model_id || 'No model recorded'}</span>
                </div>
                <div className="pin-badge history-count-badge">{formatCompactNumber(messageCount)} messages</div>
              </div>

              <p className="history-card-preview">{formatPreview(latestMessage?.content, 160)}</p>

              <div className="history-card-footer">
                <div className="history-card-metrics">
                  <div className="history-metric-pill">
                    <span>Assistant replies</span>
                    <strong>{formatCompactNumber(assistantCount)}</strong>
                  </div>
                  <div className="history-metric-pill history-metric-pill-wide">
                    <span>Last updated</span>
                    <strong title={conversation.updated_at || 'Unknown'}>{formatHistoryDate(conversation.updated_at) || 'Unknown'}</strong>
                  </div>
                </div>
                <div className="history-card-actions">
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setSelectedConversationId(conversation.id)
                      setTab('chat')
                    }}
                  >
                    Open chat
                  </button>
                  <button
                    type="button"
                    className="ghost-button history-delete-button"
                    onClick={() => deleteConversation(conversation.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
