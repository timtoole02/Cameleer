interface Agent {
  id: string;
  name: string;
  role: string;
  status: string;
}

interface DbMessage {
  role: string;
  sender_id?: string | null;
  content: string;
}

interface OrgNode {
  node_type: string;
  display_name: string;
}

interface Props {
  activeTab: string;
  agents: Agent[];
  selectedAgentId: string | null;
  activeOrgNode?: OrgNode | null;
  messages: DbMessage[];
  isThinking: boolean;
  inputText: string;
  setInputText: (text: string) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  feedEndRef: React.RefObject<HTMLDivElement | null>;
}

export default function AgentChat({
  activeTab,
  agents,
  selectedAgentId,
  messages,
  isThinking,
  inputText,
  setInputText,
  handleSendMessage,
  feedEndRef,
}: Props) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Messages Feed */}
      <div className="messages-feed" style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "40px" }}>
            No messages in this channel yet. Send a prompt to get started!
          </div>
        )}
        {messages.map((msg, index) => {
          const isUser = msg.role === "user";
          const isSystem = msg.role === "system";
          const senderName = isUser 
            ? "You" 
            : isSystem 
            ? "System" 
            : agents.find((a) => a.id === msg.sender_id)?.name || msg.sender_id;
            
          return (
            <div key={index} className={`message-bubble ${msg.role}`}>
              <div className={`message-avatar ${msg.role}`}>
                {isUser ? "U" : isSystem ? "⚙️" : msg.sender_id?.charAt(0) || "A"}
              </div>
              <div className="message-content-wrapper">
                <div className="message-sender">
                  {senderName}
                </div>
                <div className="message-content">
                  <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{msg.content}</p>
                </div>
              </div>
            </div>
          );
        })}
        {isThinking && (
          <div className="thinking-indicator">
            <span>Agent is reasoning</span>
            <div className="dot-pulse">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
        <div ref={feedEndRef} />
      </div>

      {/* Chat Input */}
      <form onSubmit={handleSendMessage} className="chat-input-area" style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="chat-input-wrapper" style={{ display: "flex", gap: "8px" }}>
          <input
            className="chat-input form-input"
            style={{ flex: 1, height: "44px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.2)", padding: "0 16px", color: "var(--text-main)", outline: "none" }}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              activeTab === "global"
                ? "Broadcast message to the blackboard room..."
                : `Message @${agents.find((a) => a.id === selectedAgentId)?.name || "Agent"}...`
            }
          />
          <button type="submit" className="chat-send-btn primary-btn" style={{ height: "44px", width: "44px", padding: 0, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "8px" }}>
            →
          </button>
        </div>
      </form>
    </div>
  );
}
