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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<BacklogItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states for creating a new item
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("feature");
  const [newPriority, setNewPriority] = useState("medium");

  // Form states for editing selected item
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editType, setEditType] = useState("feature");
  const [editPriority, setEditPriority] = useState("medium");
  const [editRiskLevel, setEditRiskLevel] = useState("low");
  const [editEffort, setEditEffort] = useState("M");
  const [editAgentRole, setEditAgentRole] = useState("");
  const [editAcceptanceCriteria, setEditAcceptanceCriteria] = useState("");
  const [editDefinitionOfDone, setEditDefinitionOfDone] = useState("");
  const [editRequiredFiles, setEditRequiredFiles] = useState("");
  const [editDependencies, setEditDependencies] = useState("");
  const [editRefinementNotes, setEditRefinementNotes] = useState("");
  const [editLabels, setEditLabels] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [promoting, setPromoting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);

  const loadBacklog = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await invoke<BacklogItem[]>("get_backlog_snapshot", { workspaceId });
      setItems(data);
      // Keep selection updated or reset if deleted
      if (selectedItem) {
        const updated = data.find(i => i.id === selectedItem.id);
        if (updated) {
          setSelectedItem(updated);
        } else {
          setSelectedItem(null);
        }
      }
    } catch (e: any) {
      console.error(e);
      setErrorMsg(e?.toString() || "Failed to load backlog items.");
      toastManager.show(`Failed to load backlog: ${e}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBacklog();
  }, [workspaceId]);

  // Sync editing fields with selected item
  useEffect(() => {
    if (selectedItem) {
      setEditTitle(selectedItem.title || "");
      setEditDesc(selectedItem.description || "");
      setEditType(selectedItem.type_name || "feature");
      setEditPriority(selectedItem.priority || "medium");
      setEditRiskLevel(selectedItem.risk_level || "low");
      setEditEffort(selectedItem.effort_estimate || "M");
      setEditAgentRole(selectedItem.proposed_agent_role || "");
      setEditAcceptanceCriteria(selectedItem.acceptance_criteria || "");
      setEditDefinitionOfDone(selectedItem.definition_of_done || "");
      setEditRequiredFiles(selectedItem.required_files || "");
      setEditDependencies(selectedItem.dependencies || "");
      setEditRefinementNotes(selectedItem.refinement_notes || "");
      setEditLabels(selectedItem.labels || "");
      setSaveError(null);
      setPromoteError(null);
    }
  }, [selectedItem]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toastManager.show("Title is required", "error");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const createdItem = await invoke<BacklogItem>("create_backlog_item", {
        workspaceId,
        title: newTitle,
        description: newDesc,
        typeName: newType,
        priority: newPriority,
      });

      setNewTitle("");
      setNewDesc("");
      setNewType("feature");
      setNewPriority("medium");
      setIsCreating(false);
      
      await loadBacklog();
      setSelectedItem(createdItem); // Auto-select the newly created item for immediate refinement!
      toastManager.show("Backlog item created successfully", 'success');
    } catch (e: any) {
      console.error(e);
      setSaveError(e?.toString() || "Error creating backlog item");
      toastManager.show(`Error creating item: ${e}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedItem) return;

    setSaving(true);
    setSaveError(null);

    // Calculate live readiness score
    const tempItem: Partial<BacklogItem> = {
      title: editTitle,
      description: editDesc,
      priority: editPriority,
      risk_level: editRiskLevel,
      acceptance_criteria: editAcceptanceCriteria,
      definition_of_done: editDefinitionOfDone,
    };
    const score = calculateReadiness(tempItem);

    try {
      await invoke("update_backlog_item", {
        id: selectedItem.id,
        title: editTitle,
        description: editDesc,
        typeName: editType,
        priority: editPriority,
        status: selectedItem.status,
        acceptanceCriteria: editAcceptanceCriteria,
        definitionOfDone: editDefinitionOfDone,
        requiredFiles: editRequiredFiles,
        proposedAgentRole: editAgentRole,
        dependencies: editDependencies,
        riskLevel: editRiskLevel,
        effortEstimate: editEffort,
        readinessScore: score,
        refinementNotes: editRefinementNotes,
        labels: editLabels,
      });

      await loadBacklog();
      toastManager.show("Changes saved successfully", 'success');
    } catch (e: any) {
      console.error(e);
      setSaveError(e?.toString() || "Error updating backlog item");
      toastManager.show(`Error updating item: ${e}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConvertToCard = async () => {
    if (!selectedItem) return;

    // Perform strict front-end validation check matching minimum promotion rules
    const missing = getMissingFields({
      title: editTitle,
      description: editDesc,
      priority: editPriority,
      risk_level: editRiskLevel,
      acceptance_criteria: editAcceptanceCriteria,
      definition_of_done: editDefinitionOfDone,
    });

    if (missing.length > 0) {
      const errorMsg = `Cannot promote unrefined work. Missing fields: ${missing.join(", ")}`;
      setPromoteError(errorMsg);
      toastManager.show(errorMsg, 'error');
      return;
    }

    // Auto-save any pending changes first to ensure all metadata is perfectly preserved!
    await handleSaveEdit();

    setPromoting(true);
    setPromoteError(null);
    try {
      await invoke("convert_backlog_item_to_card", { id: selectedItem.id });
      toastManager.show("Promoted to Kanban Board successfully", 'success');
      setSelectedItem(null);
      await loadBacklog();
      onItemConverted();
    } catch (e: any) {
      console.error(e);
      setPromoteError(e?.toString() || "Failed to promote backlog item to card");
      toastManager.show(`Failed to promote item: ${e}`, 'error');
    } finally {
      setPromoting(false);
    }
  };

  // Helper functions for Refinement Checklist and Readiness score
  const calculateReadiness = (item: Partial<BacklogItem>) => {
    let score = 0;
    if (item.title && item.title.trim()) score += 15;
    if (item.description && item.description.trim()) score += 20;
    if (item.priority && item.priority.trim()) score += 15;
    if (item.risk_level && item.risk_level.trim()) score += 15;
    if (item.acceptance_criteria && item.acceptance_criteria.trim()) score += 20;
    if (item.definition_of_done && item.definition_of_done.trim()) score += 15;
    return score;
  };

  const getMissingFields = (item: Partial<BacklogItem>) => {
    const missing: string[] = [];
    if (!item.title || !item.title.trim()) missing.push("Title");
    if (!item.description || !item.description.trim()) missing.push("Description");
    if (!item.priority || !item.priority.trim()) missing.push("Priority");
    if (!item.risk_level || !item.risk_level.trim()) missing.push("Risk Level");
    if (!item.acceptance_criteria || !item.acceptance_criteria.trim()) missing.push("Acceptance Criteria");
    if (!item.definition_of_done || !item.definition_of_done.trim()) missing.push("Definition of Done");
    return missing;
  };

  // Live values from the edit form to render the refinement checklist dynamically
  const currentLiveFields = {
    title: editTitle,
    description: editDesc,
    priority: editPriority,
    risk_level: editRiskLevel,
    acceptance_criteria: editAcceptanceCriteria,
    definition_of_done: editDefinitionOfDone,
  };

  const liveReadinessScore = calculateReadiness(currentLiveFields);
  const liveMissingFields = getMissingFields(currentLiveFields);

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", backgroundColor: "transparent" }}>
      {/* LEFT COLUMN: Backlog List */}
      <div style={{
        flex: "1 1 50%",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid var(--border-color)",
        height: "100%",
        overflow: "hidden"
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0, color: "var(--text-main)" }}>
              Backlog Intake
            </h2>
            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              {items.length} items captured • {items.filter(i => i.status === 'ready_for_board').length} promoted
            </span>
          </div>
          <button
            onClick={() => {
              setIsCreating(true);
              setSelectedItem(null);
            }}
            className="sidebar-btn"
            style={{ margin: 0, padding: "8px 14px", borderRadius: "8px" }}
          >
            + Capture Item
          </button>
        </div>

        {/* List Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px" }}>
              <div style={{ fontSize: "0.95rem", color: "var(--text-muted)", marginBottom: "8px" }}>Loading Backlog System...</div>
              <div style={{ width: "30px", height: "30px", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "var(--accent-primary)", borderRadius: "50%", animation: "pulse-glow 1s infinite" }} />
            </div>
          ) : errorMsg ? (
            <div style={{
              padding: "20px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "12px",
              textAlign: "center"
            }}>
              <span style={{ color: "var(--color-error)", fontSize: "0.95rem", display: "block", marginBottom: "12px" }}>{errorMsg}</span>
              <button onClick={loadBacklog} className="action-btn" style={{ margin: "0 auto" }}>Retry Loading</button>
            </div>
          ) : items.length === 0 ? (
            <div style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "60px 20px",
              textAlign: "center",
              border: "1px dashed var(--border-color)",
              borderRadius: "14px",
              backgroundColor: "rgba(255,255,255,0.01)"
            }}>
              <span style={{ fontSize: "2rem", marginBottom: "12px" }}>📥</span>
              <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "6px" }}>Empty Backlog</h3>
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "260px", marginBottom: "16px" }}>
                No backlog items have been captured yet. Capture a new item to start the refinement loop.
              </p>
              <button onClick={() => setIsCreating(true)} className="action-btn">
                Add Your First Item
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {items.map(item => {
                const isSelected = selectedItem?.id === item.id;
                const isPromoted = item.status === 'ready_for_board';
                const currentScore = calculateReadiness(item);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedItem(item);
                      setIsCreating(false);
                    }}
                    className={`kanban-card ${isSelected ? "active" : ""}`}
                    style={{
                      borderLeft: isSelected ? "3px solid var(--accent-primary)" : "3px solid transparent",
                      opacity: isPromoted ? 0.6 : 1,
                      backgroundColor: isSelected ? "rgba(79, 172, 254, 0.08)" : "rgba(255,255,255,0.02)",
                      borderColor: isSelected ? "rgba(0, 242, 254, 0.3)" : "var(--border-color)"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px" }}>
                      <span className={`kanban-card-owner`} style={{
                        fontSize: "0.68rem",
                        padding: "2px 6px",
                        backgroundColor: item.type_name === 'bug' ? 'rgba(239, 68, 68, 0.1)' : item.type_name === 'spike' ? 'rgba(192, 132, 252, 0.1)' : 'rgba(0, 242, 254, 0.06)',
                        borderColor: item.type_name === 'bug' ? 'rgba(239, 68, 68, 0.25)' : item.type_name === 'spike' ? 'rgba(192, 132, 252, 0.25)' : 'rgba(0, 242, 254, 0.15)',
                        color: item.type_name === 'bug' ? '#f87171' : item.type_name === 'spike' ? '#c084fc' : 'var(--accent-primary)'
                      }}>
                        {item.type_name.toUpperCase()}
                      </span>
                      <span className={`kanban-card-priority ${item.priority}`} style={{ fontSize: "0.68rem", fontWeight: 700 }}>
                        {item.priority}
                      </span>
                    </div>

                    <h4 style={{ fontSize: "0.92rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "4px", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {item.title}
                    </h4>

                    {item.description && (
                      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "10px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis", height: "30px", lineHeight: "15px" }}>
                        {item.description}
                      </p>
                    )}

                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.72rem",
                      borderTop: "1px solid rgba(255, 255, 255, 0.04)",
                      paddingTop: "8px",
                      marginTop: "6px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ color: "var(--text-muted)" }}>Readiness:</span>
                        <span style={{
                          fontWeight: 700,
                          color: currentScore === 100 ? "var(--color-working)" : currentScore >= 60 ? "var(--color-blocked)" : "var(--color-error)"
                        }}>
                          {currentScore}%
                        </span>
                      </div>
                      {isPromoted ? (
                        <span style={{ color: "var(--color-working)", fontWeight: 600 }}>🟢 Promoted</span>
                      ) : currentScore === 100 ? (
                        <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>✨ Ready</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>Draft</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Detail Drawer & Refinement Workspace */}
      <div style={{
        flex: "1 1 50%",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden"
      }}>
        {isCreating ? (
          /* CREATE INTENSITY FORM */
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)" }}>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-main)", margin: 0 }}>
                Capture New Backlog Item
              </h3>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Add core attributes to draft a backlog item.</span>
            </div>

            <form onSubmit={handleCreate} style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
              {saveError && (
                <div style={{ padding: "12px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", color: "var(--color-error)", fontSize: "0.85rem" }}>
                  {saveError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Summarize the requirement..."
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Provide background context, problems, or objectives..."
                  className="form-input form-textarea"
                  style={{ minHeight: "120px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)} className="form-input">
                    <option value="feature">Feature</option>
                    <option value="bug">Bug</option>
                    <option value="chore">Chore</option>
                    <option value="spike">Spike</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="form-input">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="action-btn"
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="sidebar-btn"
                  style={{ flex: 1, margin: 0 }}
                >
                  {saving ? "Creating..." : "Save to Backlog"}
                </button>
              </div>
            </form>
          </div>
        ) : selectedItem ? (
          /* WORKSPACE DETAILED REFINEMENT DRAWER */
          <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            {/* Drawer Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "rgba(0, 0, 0, 0.15)"
            }}>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", margin: "0 0 4px 0" }}>
                  Refinement Workspace
                </h3>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Refined fields are synchronized back to SQLite immediately.
                </span>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="action-btn"
                style={{ padding: "6px 10px", fontSize: "0.8rem" }}
              >
                Close Drawer ✕
              </button>
            </div>

            {/* Main Content Pane */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
              {/* Dynamic Readiness Score Box */}
              <div style={{
                backgroundColor: "rgba(13, 16, 24, 0.5)",
                border: "1px solid var(--border-color)",
                borderRadius: "14px",
                padding: "16px 20px",
                marginBottom: "24px",
                display: "flex",
                alignItems: "center",
                gap: "20px"
              }}>
                <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {/* Readiness Circular representation */}
                  <div style={{
                    width: "64px",
                    height: "64px",
                    borderRadius: "50%",
                    border: `4px solid ${liveReadinessScore === 100 ? "var(--color-working)" : "rgba(255, 255, 255, 0.05)"}`,
                    borderTopColor: liveReadinessScore < 100 ? "var(--accent-primary)" : "",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: liveReadinessScore === 100 ? "var(--color-working)" : "var(--accent-primary)"
                  }}>
                    {liveReadinessScore}%
                  </div>
                </div>

                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--text-main)", margin: "0 0 4px 0" }}>
                    Intake Readiness Score
                  </h4>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", margin: 0 }}>
                    {liveReadinessScore === 100
                      ? "This item satisfies all strict lane contracts and can be promoted to the Kanban board!"
                      : `A minimum score of 100% is required for promotion. Missing fields: ${liveMissingFields.join(", ")}`}
                  </p>
                </div>
              </div>

              {/* Promotion Rule checklist */}
              <div style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "24px"
              }}>
                <h4 style={{ fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.5px", margin: "0 0 12px 0" }}>
                  Promotion Gate Checklist
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {[
                    { label: "Title", filled: !!editTitle.trim() },
                    { label: "Description", filled: !!editDesc.trim() },
                    { label: "Priority Selection", filled: !!editPriority.trim() },
                    { label: "Risk Evaluation", filled: !!editRiskLevel.trim() },
                    { label: "Acceptance Criteria", filled: !!editAcceptanceCriteria.trim() },
                    { label: "Definition of Done", filled: !!editDefinitionOfDone.trim() },
                  ].map((chk, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem" }}>
                      <span style={{ color: chk.filled ? "var(--color-working)" : "var(--color-error)" }}>
                        {chk.filled ? "✓" : "✗"}
                      </span>
                      <span style={{ color: chk.filled ? "var(--text-main)" : "var(--text-muted)" }}>
                        {chk.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Refinement Inputs */}
              <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {saveError && (
                  <div style={{ padding: "12px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", color: "var(--color-error)", fontSize: "0.85rem" }}>
                    {saveError}
                  </div>
                )}
                {promoteError && (
                  <div style={{ padding: "12px", backgroundColor: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "8px", color: "var(--color-error)", fontSize: "0.85rem" }}>
                    {promoteError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="form-input"
                  />
                  {!editTitle.trim() && (
                    <span style={{ fontSize: "0.75rem", color: "var(--color-error)" }}>Title is required for promotion.</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Description *</label>
                  <textarea
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Provide a comprehensive technical description..."
                    className="form-input form-textarea"
                    style={{ minHeight: "100px" }}
                  />
                  {!editDesc.trim() && (
                    <span style={{ fontSize: "0.75rem", color: "var(--color-error)" }}>A descriptive prompt is required for the agent to understand work.</span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div className="form-group">
                    <label className="form-label">Type</label>
                    <select value={editType} onChange={(e) => setEditType(e.target.value)} className="form-input">
                      <option value="feature">Feature</option>
                      <option value="bug">Bug</option>
                      <option value="chore">Chore</option>
                      <option value="spike">Spike</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Priority *</label>
                    <select value={editPriority} onChange={(e) => setEditPriority(e.target.value)} className="form-input">
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                  <div className="form-group">
                    <label className="form-label">Risk Level *</label>
                    <select value={editRiskLevel} onChange={(e) => setEditRiskLevel(e.target.value)} className="form-input">
                      <option value="high">High Risk</option>
                      <option value="medium">Medium Risk</option>
                      <option value="low">Low Risk</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Effort Estimate</label>
                    <select value={editEffort} onChange={(e) => setEditEffort(e.target.value)} className="form-input">
                      <option value="S">S - Small</option>
                      <option value="M">M - Medium</option>
                      <option value="L">L - Large</option>
                      <option value="XL">XL - Extra Large</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Proposed Agent Role</label>
                  <input
                    type="text"
                    value={editAgentRole}
                    onChange={(e) => setEditAgentRole(e.target.value)}
                    placeholder="e.g. Software Engineer, QA Architect"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Acceptance Criteria *</label>
                  <textarea
                    value={editAcceptanceCriteria}
                    onChange={(e) => setEditAcceptanceCriteria(e.target.value)}
                    placeholder="Given [context] when [action] then [result]..."
                    className="form-input form-textarea"
                    style={{ minHeight: "80px" }}
                  />
                  {!editAcceptanceCriteria.trim() && (
                    <span style={{ fontSize: "0.75rem", color: "var(--color-error)" }}>Define what constitutes functionally correct completion.</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Definition of Done *</label>
                  <textarea
                    value={editDefinitionOfDone}
                    onChange={(e) => setEditDefinitionOfDone(e.target.value)}
                    placeholder="e.g. Unit tests pass, codebase compiles, documentation updated..."
                    className="form-input form-textarea"
                    style={{ minHeight: "80px" }}
                  />
                  {!editDefinitionOfDone.trim() && (
                    <span style={{ fontSize: "0.75rem", color: "var(--color-error)" }}>Specify clear quality and verification gates.</span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Required Files</label>
                  <input
                    type="text"
                    value={editRequiredFiles}
                    onChange={(e) => setEditRequiredFiles(e.target.value)}
                    placeholder="e.g. src/auth.rs, control-center/src/App.tsx"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Dependencies</label>
                  <input
                    type="text"
                    value={editDependencies}
                    onChange={(e) => setEditDependencies(e.target.value)}
                    placeholder="e.g. Database schema migration must complete first"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Refinement Notes</label>
                  <textarea
                    value={editRefinementNotes}
                    onChange={(e) => setEditRefinementNotes(e.target.value)}
                    placeholder="Refinement context, details discussed during triage..."
                    className="form-input form-textarea"
                    style={{ minHeight: "70px" }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Labels (comma separated)</label>
                  <input
                    type="text"
                    value={editLabels}
                    onChange={(e) => setEditLabels(e.target.value)}
                    placeholder="e.g. backend, security, api"
                    className="form-input"
                  />
                </div>

                {/* Save and Promote actions */}
                <div style={{ display: "flex", gap: "12px", marginTop: "20px", borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleSaveEdit()}
                    className="action-btn"
                    style={{ flex: 1 }}
                  >
                    {saving ? "Saving..." : "Save Draft"}
                  </button>

                  {selectedItem.status !== 'ready_for_board' ? (
                    <button
                      type="button"
                      disabled={promoting || liveReadinessScore < 100}
                      onClick={handleConvertToCard}
                      className="sidebar-btn"
                      style={{
                        flex: 1.2,
                        margin: 0,
                        backgroundColor: liveReadinessScore === 100 ? "var(--color-working)" : "rgba(255,255,255,0.03)",
                        border: liveReadinessScore === 100 ? "1px solid var(--color-working)" : "1px solid var(--border-color)",
                        color: liveReadinessScore === 100 ? "var(--text-dark)" : "var(--text-muted)",
                        cursor: liveReadinessScore === 100 ? "pointer" : "not-allowed",
                        opacity: liveReadinessScore === 100 ? 1 : 0.5
                      }}
                    >
                      {promoting ? "Promoting..." : "Promote to Board →"}
                    </button>
                  ) : (
                    <div style={{
                      flex: 1.2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: "rgba(16, 185, 129, 0.1)",
                      border: "1px solid rgba(16, 185, 129, 0.3)",
                      color: "var(--color-working)",
                      borderRadius: "12px",
                      fontSize: "0.88rem",
                      fontWeight: 600
                    }}>
                      ✓ Already Promoted
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* Sleek macOS Apple-class Empty Workspace View */
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            padding: "40px",
            textAlign: "center",
            color: "var(--text-muted)"
          }}>
            <div style={{
              width: "80px",
              height: "80px",
              borderRadius: "20px",
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2.5rem",
              boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
              marginBottom: "24px"
            }}>
              🛠️
            </div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>
              Backlog Refinement System
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", maxWidth: "340px", lineHeight: "1.5" }}>
              Select a captured backlog item from the left pane to launch the interactive refinement loop, evaluate its readiness score, and promote it to the active Kanban board.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
