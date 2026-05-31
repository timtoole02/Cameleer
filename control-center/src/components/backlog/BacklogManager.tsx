import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BacklogItem } from "../../types";
import { toastManager } from "../ui/Toast";

interface Props {
  workspaceId: string;
  onItemConverted: () => void;
}

export default function BacklogManager({ workspaceId, onItemConverted }: Props) {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("feature");
  const [priority, setPriority] = useState("medium");

  const loadBacklog = async () => {
    try {
      const data = await invoke<BacklogItem[]>("get_backlog_snapshot", { workspaceId });
      setItems(data);
    } catch (e: any) {
      toastManager.show(`Failed to load backlog: ${e}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBacklog();
  }, [workspaceId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      await invoke("create_backlog_item", {
        workspaceId,
        title,
        description: "",
        typeName: type,
        priority,
      });
      setTitle("");
      loadBacklog();
      toastManager.show("Backlog item created", 'success');
    } catch (e: any) {
      toastManager.show(`Error creating item: ${e}`, 'error');
    }
  };

  const handleConvertToCard = async (id: string) => {
    try {
      await invoke("convert_backlog_item_to_card", { id, state: {} });
      toastManager.show("Promoted to Kanban Board", 'success');
      loadBacklog();
      onItemConverted();
    } catch (e: any) {
      // The rust backend currently returns an Err intentionally with the card fetch instruction, but we updated it to return Ok(KanbanCard)
      if (typeof e === 'string' && e.includes("Failed to convert")) {
          toastManager.show(e, 'error');
      } else {
          // If it succeeded, it returns Ok(KanbanCard) which won't throw
      }
    }
  };

  return (
    <div style={{ padding: "var(--space-lg)", height: "100%", overflowY: "auto" }}>
      <div style={{ marginBottom: "var(--space-xl)" }}>
        <h2 style={{ margin: "0 0 var(--space-md) 0", fontSize: "24px", fontWeight: 600 }}>Backlog</h2>
        
        <form onSubmit={handleCreate} style={{ 
          display: "flex", 
          gap: "var(--space-sm)", 
          backgroundColor: "var(--bg-sidebar)", 
          padding: "var(--space-md)", 
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-default)"
        }}>
          <input
            type="text"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
            style={{ flex: 1 }}
          />
          <select value={type} onChange={(e) => setType(e.target.value)} className="input" style={{ width: "120px" }}>
            <option value="feature">Feature</option>
            <option value="bug">Bug</option>
            <option value="chore">Chore</option>
            <option value="spike">Spike</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input" style={{ width: "120px" }}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button type="submit" className="button primary">Add to Backlog</button>
        </form>
      </div>

      <div>
        {loading ? (
          <div style={{ color: "var(--text-secondary)", textAlign: "center", padding: "var(--space-xl)" }}>Loading backlog...</div>
        ) : items.length === 0 ? (
          <div style={{ 
            textAlign: "center", 
            padding: "60px 20px", 
            color: "var(--text-tertiary)",
            backgroundColor: "var(--bg-sidebar)",
            borderRadius: "var(--radius-lg)",
            border: "1px dashed var(--border-strong)"
          }}>
            No items in the backlog. Add one above.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
            {items.map(item => (
              <div 
                key={item.id} 
                className="card"
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between",
                  opacity: item.status === 'ready_for_board' ? 0.5 : 1
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
                  <span className={`badge ${item.type_name === 'bug' ? 'danger' : 'accent'}`}>
                    {item.type_name}
                  </span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span style={{ fontWeight: 500, fontSize: "15px" }}>{item.title}</span>
                    <span style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>
                      Created {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-lg)" }}>
                  <span style={{ 
                    fontSize: "13px", 
                    color: item.priority === 'high' ? 'var(--danger-red)' : 'var(--text-secondary)'
                  }}>
                    {item.priority}
                  </span>
                  
                  {item.status !== 'ready_for_board' ? (
                    <button 
                      onClick={() => handleConvertToCard(item.id)}
                      className="button"
                    >
                      Promote to Board →
                    </button>
                  ) : (
                    <span className="badge success">On Board</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
