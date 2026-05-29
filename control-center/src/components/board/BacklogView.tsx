import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { BacklogItem } from "../../types";

interface Props {
  workspaceId: string;
  onItemConverted: () => void; // Trigger a refresh when an item moves to board
}

export default function BacklogView({ workspaceId, onItemConverted }: Props) {
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("feature");
  const [priority, setPriority] = useState("medium");

  const loadBacklog = async () => {
    try {
      const data = await invoke<BacklogItem[]>("get_backlog_snapshot", { workspaceId });
      setItems(data);
    } catch (e) {
      console.error("Failed to load backlog:", e);
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
    } catch (e) {
      console.error(e);
    }
  };

  const handleConvertToCard = async (id: string) => {
    try {
      await invoke("convert_backlog_item_to_card", { id });
      loadBacklog();
      onItemConverted();
    } catch (e) {
      console.error("Failed to convert item to card:", e);
    }
  };

  return (
    <div className="backlog-view">
      <div className="backlog-header">
        <h2 style={{ margin: 0 }}>Backlog</h2>
        <form onSubmit={handleCreate} className="quick-add-form" style={{ display: "flex", gap: "10px" }}>
          <input
            type="text"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-field"
            style={{ width: "300px" }}
          />
          <select value={type} onChange={(e) => setType(e.target.value)} className="select-field">
            <option value="feature">Feature</option>
            <option value="bug">Bug</option>
            <option value="chore">Chore</option>
            <option value="spike">Spike</option>
          </select>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="select-field">
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button type="submit" className="primary-btn">Add to Backlog</button>
        </form>
      </div>

      <div className="backlog-list">
        {loading ? (
          <div style={{ color: "var(--text-muted)" }}>Loading...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">No items in the backlog.</div>
        ) : (
          <table className="backlog-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Title</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id} className={item.status === 'ready_for_board' ? 'faded' : ''}>
                  <td>
                    <span className={`badge-type type-${item.type_name}`}>{item.type_name}</span>
                  </td>
                  <td>{item.title}</td>
                  <td>
                    <span className={`badge-priority priority-${item.priority}`}>{item.priority}</span>
                  </td>
                  <td>{item.status}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                    {new Date(item.created_at).toLocaleDateString()}
                  </td>
                  <td>
                    {item.status !== 'ready_for_board' && (
                      <button 
                        onClick={() => handleConvertToCard(item.id)}
                        className="action-btn"
                        style={{ fontSize: "0.8rem" }}
                      >
                        Push to Board →
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
