import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { KanbanCard } from "../../types";
import { toastManager } from "../ui/Toast";

interface Props {
  workspaceId: string;
  agents: any[];
  onCardClick: (card: KanbanCard) => void;
  refreshTrigger: number;
  scopeType?: string;
  scopeId?: string;
}

export default function KanbanBoard({ workspaceId, agents, onCardClick, refreshTrigger, scopeType, scopeId }: Props) {
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBoard = async () => {
    try {
      const data = await invoke<KanbanCard[]>("get_board_snapshot", { workspaceId });
      setCards(data);
    } catch (e: any) {
      toastManager.show(`Failed to load board: ${e}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, [workspaceId, refreshTrigger]);

  const columns = [
    { id: "Backlog", label: "Backlog", colorClass: "backlog" },
    { id: "Ready", label: "Ready", colorClass: "ready" },
    { id: "Assigned", label: "Assigned", colorClass: "assigned" },
    { id: "In Progress", label: "In Progress", colorClass: "working" },
    { id: "Blocked", label: "Blocked", colorClass: "blocked" },
    { id: "In Review", label: "In Review", colorClass: "review" },
    { id: "Done", label: "Done", colorClass: "working" },
  ];

  if (loading) {
    return <div style={{ padding: "var(--space-xl)", color: "var(--text-secondary)", textAlign: "center" }}>Loading workspace board...</div>;
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("text/plain");
    if (!cardId) return;

    try {
      await invoke("move_card", { cardId, newStatus, reason: "Manual Drag and Drop" });
      loadBoard();
      toastManager.show(`Card moved to ${newStatus}`, 'success');
    } catch (err: any) {
      toastManager.show(`${err}`, 'error');
    }
  };

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData("text/plain", cardId);
  };

  return (
    <div style={{
      display: "flex",
      gap: "var(--space-md)",
      padding: "var(--space-lg)",
      overflowX: "auto",
      height: "100%",
      alignItems: "flex-start"
    }}>
      {columns.map(col => {
        let displayCards = cards.filter(c => c.status === col.id);
        
        if (scopeType === 'team' && scopeId) {
          displayCards = displayCards.filter(c => c.team_id === scopeId);
        } else if (scopeType === 'project' && scopeId) {
          displayCards = displayCards.filter(c => c.project_id === scopeId);
        }

        return (
          <div 
            key={col.id} 
            style={{
              minWidth: "280px",
              maxWidth: "320px",
              flex: "0 0 auto",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
              backgroundColor: "var(--bg-sidebar)",
              padding: "var(--space-md)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border-default)"
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-sm)"
            }}>
              <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{col.label}</span>
              <span className="badge" style={{ backgroundColor: "var(--bg-surface)" }}>{displayCards.length}</span>
            </div>
            
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-sm)",
              minHeight: "100px"
            }}>
              {displayCards.length === 0 ? (
                <div style={{ padding: "var(--space-md)", textAlign: "center", color: "var(--text-tertiary)", fontSize: "13px" }}>No cards</div>
              ) : (
                displayCards.map(card => {
                  let completedCriteria = 0;
                  let totalCriteria = 0;
                  try {
                    const criteriaArr = JSON.parse(card.acceptance_criteria || "[]");
                    if (Array.isArray(criteriaArr)) {
                      totalCriteria = criteriaArr.length;
                      completedCriteria = criteriaArr.filter((c: string) => c.startsWith("[x]")).length;
                    }
                  } catch (e) { }

                  const assigneeName = agents.find(a => a.id === card.assigned_agent_id || a.id === card.assigned_human_id)?.name || "unassigned";

                  return (
                    <div 
                      key={card.id} 
                      className="card"
                      draggable
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onClick={() => onCardClick(card)}
                      style={{ cursor: "grab", position: "relative" }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "var(--space-xs)", fontSize: "12px", color: "var(--text-secondary)" }}>
                        <span>{card.id.split('-')[0]}</span>
                        <span style={{ 
                          color: card.priority === 'high' ? "var(--danger-red)" : card.priority === 'low' ? "var(--success-green)" : "var(--text-secondary)"
                        }}>{card.priority}</span>
                      </div>
                      
                      <div style={{ fontWeight: 500, fontSize: "14px", marginBottom: "var(--space-sm)", lineHeight: 1.4 }}>{card.title}</div>
                      
                      {totalCriteria > 0 && (
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "var(--space-sm)" }}>
                          <div style={{ flex: 1, height: "4px", backgroundColor: "var(--bg-main)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ height: "100%", backgroundColor: "var(--success-green)", width: `${(completedCriteria / totalCriteria) * 100}%` }} />
                          </div>
                          <span>{completedCriteria}/{totalCriteria}</span>
                        </div>
                      )}
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px" }}>
                        <span className="badge">{assigneeName}</span>
                        {card.validation_status === 'passed' && (
                          <span className="badge success">✓ Passed</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
