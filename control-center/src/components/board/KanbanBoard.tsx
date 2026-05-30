import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { KanbanCard } from "../../types";

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
    } catch (e) {
      console.error("Failed to load board:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoard();
  }, [workspaceId, refreshTrigger]);

  const columns = [
    { id: "Ready", label: "Ready", colorClass: "ready" },
    { id: "Assigned", label: "Assigned", colorClass: "assigned" },
    { id: "In Progress", label: "In Progress", colorClass: "working" },
    { id: "Blocked", label: "Blocked", colorClass: "blocked" },
    { id: "In Review", label: "In Review", colorClass: "review" },
    { id: "Done", label: "Done", colorClass: "working" },
  ];

  if (loading) {
    return <div style={{ padding: "20px", color: "var(--text-muted)" }}>Loading board...</div>;
  }

  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    const cardId = e.dataTransfer.getData("text/plain");
    if (!cardId) return;

    try {
      await invoke("move_card", { cardId, newStatus, reason: "Manual Drag and Drop" });
      loadBoard();
    } catch (err: any) {
      alert(`Failed to move card: ${err}`);
    }
  };

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    e.dataTransfer.setData("text/plain", cardId);
  };

  return (
    <div className="kanban-board">
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
            className="kanban-column"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, col.id)}
          >
            <div className="kanban-column-header">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className={`status-badge ${col.colorClass}`} style={{ position: "static", display: "inline-block", width: "8px", height: "8px", margin: 0 }} />
                <span>{col.label}</span>
              </div>
              <span className="kanban-column-count">{displayCards.length}</span>
            </div>
            
            <div className="kanban-cards">
              {displayCards.length === 0 ? (
                <div className="kanban-empty">No cards</div>
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
                      className="kanban-card"
                      draggable
                      onDragStart={(e) => handleDragStart(e, card.id)}
                      onClick={() => onCardClick(card)}
                      style={{ cursor: "grab" }}
                    >
                      <div className="kanban-card-top">
                        <span className="kanban-card-id">{card.id.split('-')[0]}</span>
                        <span className={`kanban-card-priority priority-${card.priority}`}>{card.priority}</span>
                      </div>
                      <div className="kanban-card-title">{card.title}</div>
                      
                      {totalCriteria > 0 && (
                        <div className="kanban-card-progress">
                          <div className="progress-bar-bg">
                            <div className="progress-bar-fill" style={{ width: `${(completedCriteria / totalCriteria) * 100}%` }} />
                          </div>
                          <span>{completedCriteria}/{totalCriteria}</span>
                        </div>
                      )}
                      
                      <div className="kanban-card-meta">
                        <span className="kanban-card-owner">{assigneeName}</span>
                        {card.validation_status === 'passed' && (
                          <span className="kanban-card-passed">✓ Passed</span>
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
