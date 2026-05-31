import { useAppStore } from '../../hooks/useAppStore';

export function CreateTaskModal(props: ReturnType<typeof useAppStore>) {
  const {
    isTaskModalOpen,
    setIsTaskModalOpen,
    handleCreateTask,
    taskTitle,
    setTaskTitle,
    taskDesc,
    setTaskDesc,
    taskOwner,
    setTaskOwner,
    taskPriority,
    setTaskPriority,
    recommendAgentForTask,
    taskAcceptanceCriteria,
    setTaskAcceptanceCriteria,
    taskRequiredFiles,
    setTaskRequiredFiles,
    taskDependencies,
    setTaskDependencies,
    agents
  } = props;

  if (!isTaskModalOpen) return null;

  return (
    <div className="modal-overlay">
      <form className="modal-content" style={{
        width: "560px"
      }} onSubmit={handleCreateTask}>
        <div className="modal-title">➕ Create Kanban Objective</div>
        
        <div className="form-group">
          <label className="form-label">Task Title</label>
          <input className="form-input" required value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="e.g. Implement safety validation in parser" />
        </div>

        <div className="form-group">
          <label className="form-label">Task Description</label>
          <textarea className="form-input form-textarea" value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="Add technical requirements, goals, or context..." style={{
            height: "70px"
          }} />
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px"
        }}>
          <div className="form-group">
            <label className="form-label">Assignee Owner</label>
            <select className="form-input" value={taskOwner} onChange={e => setTaskOwner(e.target.value)} style={{
              background: "#0a0d14",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff",
              height: "40px"
            }}>
              <option value="">unassigned</option>
              {agents.map(a => <option key={a.id} value={a.id}>
                {a.name} ({a.role})
              </option>)}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Objective Priority</label>
            <select className="form-input" value={taskPriority} onChange={e => setTaskPriority(e.target.value)} style={{
              background: "#0a0d14",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff",
              height: "40px"
            }}>
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
            </select>
          </div>
        </div>

        {/* Smart Agent Recommendation Banner */}
        {(() => {
          const rec = recommendAgentForTask(taskTitle, taskDesc);
          if (rec) {
            return <div style={{
              background: "rgba(0, 242, 254, 0.05)",
              border: "1px solid rgba(0, 242, 254, 0.2)",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "0.76rem",
              color: "var(--accent-primary)",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <span>✨</span>
              <span><strong>Recommendation:</strong> Assign to <strong>{rec.name}</strong> ({rec.role}) based on task keywords.</span>
            </div>;
          }
          return null;
        })()}

        <div className="form-group">
          <label className="form-label" style={{
            display: "flex",
            justifyContent: "space-between"
          }}>
            <span>📋 Acceptance Criteria (One per line)</span>
            <span style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)"
            }}>Becomes checklist</span>
          </label>
          <textarea className="form-input form-textarea" value={taskAcceptanceCriteria} onChange={e => setTaskAcceptanceCriteria(e.target.value)} placeholder="e.g. Write standard unit test&#10;Verify compilation on local machine" style={{
            height: "60px",
            fontSize: "0.8rem"
          }} />
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px"
        }}>
          <div className="form-group">
            <label className="form-label" style={{
              display: "flex",
              justifyContent: "space-between"
            }}>
              <span>📂 Required Files</span>
              <span style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)"
              }}>Host path checks</span>
            </label>
            <input className="form-input" value={taskRequiredFiles} onChange={e => setTaskRequiredFiles(e.target.value)} placeholder="e.g. ~/Desktop/hello.rs" style={{
              fontSize: "0.8rem"
            }} />
          </div>

          <div className="form-group">
            <label className="form-label" style={{
              display: "flex",
              justifyContent: "space-between"
            }}>
              <span>⛓️ Dependencies</span>
              <span style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)"
              }}>Comma-sep task IDs</span>
            </label>
            <input className="form-input" value={taskDependencies} onChange={e => setTaskDependencies(e.target.value)} placeholder="e.g. task-9h8f" style={{
              fontSize: "0.8rem"
            }} />
          </div>
        </div>

        <div className="modal-buttons">
          <button type="button" className="action-btn" onClick={() => setIsTaskModalOpen(false)}>
            Cancel
          </button>
          <button type="submit" className="sidebar-btn" style={{
            margin: 0
          }}>
            Enqueue Objective
          </button>
        </div>
      </form>
    </div>
  );
}
