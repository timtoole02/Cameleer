import { useState } from "react";
import { KanbanCard } from "../../types";

interface Props {
  card: KanbanCard | null;
  onClose: () => void;
  agents: any[];
}

export default function CardDrawer({ card, onClose, agents }: Props) {
  if (!card) return null;
  
  const [activeTab, setActiveTab] = useState<'details' | 'history' | 'validation'>('details');

  const assigneeName = agents.find(a => a.id === card.assigned_agent_id || a.id === card.assigned_human_id)?.name || "unassigned";

  return (
    <div style={{
      position: "fixed",
      top: 0,
      right: 0,
      width: "400px",
      height: "100vh",
      backgroundColor: "var(--bg-sidebar)",
      borderLeft: "1px solid var(--border-default)",
      boxShadow: "var(--shadow-lg)",
      display: "flex",
      flexDirection: "column",
      zIndex: 100,
      animation: "slideInRight 0.2s ease-out"
    }}>
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
      
      <div style={{
        padding: "var(--space-md) var(--space-lg)",
        borderBottom: "1px solid var(--border-default)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)" }}>
          <span style={{ color: "var(--text-secondary)", fontSize: "12px" }}>{card.id.split('-')[0]}</span>
          <span className={`badge ${card.priority === 'high' ? 'danger' : 'accent'}`}>{card.priority}</span>
        </div>
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: "16px" }}>✕</button>
      </div>

      <div style={{ padding: "var(--space-lg)", flex: 1, overflowY: "auto" }}>
        <h2 style={{ margin: "0 0 var(--space-md) 0", fontSize: "20px", fontWeight: 600, lineHeight: 1.3 }}>
          {card.title}
        </h2>
        
        <div style={{ display: "flex", gap: "var(--space-md)", marginBottom: "var(--space-lg)" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "4px" }}>Status</div>
            <div className="badge">{card.status}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "4px" }}>Assignee</div>
            <div style={{ fontSize: "14px", fontWeight: 500 }}>{assigneeName}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-sm)", borderBottom: "1px solid var(--border-default)", marginBottom: "var(--space-md)" }}>
          {['details', 'history', 'validation'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              style={{
                background: "transparent",
                border: "none",
                padding: "var(--space-sm) 0",
                color: activeTab === tab ? "var(--accent-blue)" : "var(--text-secondary)",
                fontWeight: activeTab === tab ? 600 : 400,
                borderBottom: activeTab === tab ? "2px solid var(--accent-blue)" : "2px solid transparent",
                cursor: "pointer",
                textTransform: "capitalize"
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'details' && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)", fontWeight: 600 }}>DESCRIPTION</div>
              <div style={{ fontSize: "14px", lineHeight: 1.5, color: "var(--text-secondary)" }}>
                {card.description || "No description provided."}
              </div>
            </div>
            
            {card.acceptance_criteria && (
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)", fontWeight: 600 }}>ACCEPTANCE CRITERIA</div>
                <pre style={{ 
                  margin: 0, 
                  padding: "var(--space-sm)", 
                  backgroundColor: "var(--bg-main)", 
                  borderRadius: "var(--radius-sm)", 
                  fontSize: "13px",
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-system)"
                }}>
                  {card.acceptance_criteria}
                </pre>
              </div>
            )}
            
            {card.dependencies && (
              <div>
                <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)", fontWeight: 600 }}>DEPENDENCIES</div>
                <div style={{ fontSize: "13px", color: "var(--warning-yellow)" }}>
                  {card.dependencies}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)", fontWeight: 600 }}>PROGRESS LOG (COMMENTS)</div>
              {card.comments ? (
                <div style={{ 
                  margin: 0, 
                  padding: "var(--space-md)", 
                  backgroundColor: "var(--bg-main)", 
                  borderRadius: "var(--radius-sm)", 
                  fontSize: "13px",
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                  color: "var(--text-secondary)"
                }}>
                  {card.comments}
                </div>
              ) : (
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No comments recorded yet.</div>
              )}
            </div>
            
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)", fontWeight: 600 }}>SYSTEM ACTIVITY LOG</div>
              {card.activity_log ? (
                <pre style={{ 
                  margin: 0, 
                  padding: "var(--space-md)", 
                  backgroundColor: "var(--bg-main)", 
                  borderRadius: "var(--radius-sm)", 
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  whiteSpace: "pre-wrap",
                  color: "var(--text-secondary)"
                }}>
                  {card.activity_log}
                </pre>
              ) : (
                <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>No system activity recorded yet.</div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'validation' && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)", fontWeight: 600 }}>VALIDATION STATUS</div>
              <div className={`badge ${card.validation_status === 'passed' ? 'success' : card.validation_status === 'failed' ? 'danger' : ''}`}>
                {card.validation_status || "Pending"}
              </div>
            </div>
            
            <div>
              <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "var(--space-sm)", fontWeight: 600 }}>COMPLETION EVIDENCE & RECEIPT</div>
              {card.completion_evidence ? (
                <div style={{ 
                  padding: "var(--space-md)", 
                  backgroundColor: "rgba(48, 209, 88, 0.1)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid rgba(48, 209, 88, 0.2)"
                }}>
                  <div style={{ fontSize: "13px", color: "var(--success-green)", marginBottom: "8px", fontWeight: 500 }}>
                    Receipt ID: {card.work_receipt_id || "N/A"}
                  </div>
                  <pre style={{ 
                    margin: 0, 
                    fontSize: "12px",
                    fontFamily: "var(--font-mono)",
                    whiteSpace: "pre-wrap",
                    color: "var(--text-primary)"
                  }}>
                    {card.completion_evidence}
                  </pre>
                </div>
              ) : (
                <div style={{ 
                  padding: "var(--space-md)", 
                  backgroundColor: "rgba(255, 69, 58, 0.1)", 
                  borderRadius: "var(--radius-sm)",
                  border: "1px dashed rgba(255, 69, 58, 0.3)",
                  fontSize: "13px",
                  color: "var(--danger-red)"
                }}>
                  No evidence provided. Card cannot be moved to Done.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
