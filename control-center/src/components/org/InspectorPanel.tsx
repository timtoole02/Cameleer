import { useAppStore } from '../../hooks/useAppStore';
import { api } from '../../services/api';

export function InspectorPanel(props: ReturnType<typeof useAppStore>) {
  const {
    inspectorTab,
    setInspectorTab,
    agents,
    selectedAgentId,
    handleDeleteAgent,
    coordinationDetails,
    handleResolveHandoff,
    newDecisionText,
    setNewDecisionText,
    loadCoordinationDetails,
    blackboardText
  } = props;

  return (
    <aside className="inspector-panel" style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflowY: "auto"
    }}>
      {/* Tab Navigation */}
      <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border-color)",
        marginBottom: "16px",
        flexShrink: 0
      }}>
        <button onClick={() => setInspectorTab("snapshot")} style={{
          flex: 1,
          padding: "14px 8px",
          background: "none",
          border: "none",
          color: inspectorTab === "snapshot" ? "var(--accent-primary)" : "var(--text-muted)",
          fontWeight: 700,
          fontSize: "0.82rem",
          borderBottom: inspectorTab === "snapshot" ? "2px solid var(--accent-primary)" : "2px solid transparent",
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}>
          🧠 Project Brain
        </button>
        <button onClick={() => setInspectorTab("profile")} style={{
          flex: 1,
          padding: "14px 8px",
          background: "none",
          border: "none",
          color: inspectorTab === "profile" ? "var(--accent-primary)" : "var(--text-muted)",
          fontWeight: 700,
          fontSize: "0.82rem",
          borderBottom: inspectorTab === "profile" ? "2px solid var(--accent-primary)" : "2px solid transparent",
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}>
          👤 Agent Profile
        </button>
      </div>

      {inspectorTab === "profile" ? (/* Agent Profile Tab */
        <section className="inspector-section" style={{
          flex: 1
        }}>
          <div className="inspector-section-title">Agent Profile</div>
          {agents.find(a => a.id === selectedAgentId) ? (() => {
            const currentAgent = agents.find(a => a.id === selectedAgentId)!;
            return <div className="inspector-details">
              <div>
                <div className="inspector-label">Name</div>
                <div className="inspector-value">{currentAgent.name}</div>
              </div>
              <div>
                <div className="inspector-label">Primary Role</div>
                <div className="inspector-value">{currentAgent.role}</div>
              </div>
              <div>
                <div className="inspector-label">LLM Provider</div>
                <div className="inspector-value">
                  {currentAgent.model_provider} ({currentAgent.model_name})
                </div>
              </div>
              <div>
                <div className="inspector-label">Status</div>
                <div className="inspector-value" style={{
                  textTransform: "capitalize"
                }}>
                  {currentAgent.status}
                </div>
              </div>
              <button className="action-btn danger-btn" style={{
                marginTop: "10px"
              }} onClick={() => handleDeleteAgent(currentAgent.id)}>
                Retire Agent
              </button>
            </div>;
          })() : <div style={{
            fontSize: "0.85rem",
            color: "var(--text-muted)"
          }}>
            No agent selected. Click on an agent in the sidebar to inspect.
          </div>}
        </section>
      ) : (/* Project Brain Snapshot Tab */
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        }}>
          
          {/* Active Workspace Banner */}
          <section className="inspector-section" style={{
            marginBottom: 0
          }}>
            <div className="inspector-section-title" style={{
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
              <span>📁 Active Workspace</span>
              <span className="live-telemetry-status" style={{
                display: "inline-block",
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: "#10b981",
                animation: "pulse 1.5s infinite"
              }} />
            </div>
            {(() => {
              const activeWs = coordinationDetails.workspaces.find(w => w.active === 1) || {
                name: "Default Workspace",
                path: "~/Desktop"
              };
              return <div style={{
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-color)",
                borderRadius: "10px",
                padding: "12px"
              }}>
                <div style={{
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  color: "var(--text-main)"
                }}>{activeWs.name}</div>
                <div style={{
                  fontSize: "0.74rem",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                  marginTop: "4px",
                  wordBreak: "break-all"
                }}>{activeWs.path}</div>
              </div>;
            })()}
          </section>

          {/* Crew statuses */}
          <section className="inspector-section" style={{
            marginBottom: 0
          }}>
            <div className="inspector-section-title">Crew Statuses</div>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxHeight: "180px",
              overflowY: "auto"
            }}>
              {agents.map(a => <div key={a.id} style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 12px",
                background: "rgba(255, 255, 255, 0.01)",
                border: "1px solid rgba(255, 255, 255, 0.04)",
                borderRadius: "8px"
              }}>
                <div>
                  <div style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "var(--text-main)"
                  }}>{a.name}</div>
                  <div style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)"
                  }}>{a.role}</div>
                </div>
                <span style={{
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  textTransform: "capitalize",
                  padding: "3px 8px",
                  borderRadius: "5px",
                  background: a.status === "working" ? "rgba(0, 242, 254, 0.08)" : a.status === "error" ? "rgba(239, 68, 68, 0.08)" : "rgba(255,255,255,0.03)",
                  color: a.status === "working" ? "var(--accent-primary)" : a.status === "error" ? "#f87171" : "var(--text-muted)",
                  border: a.status === "working" ? "1px solid rgba(0, 242, 254, 0.2)" : a.status === "error" ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(255,255,255,0.05)"
                }}>
                  {a.status}
                </span>
              </div>)}
            </div>
          </section>

          {/* Dynamic Handoffs gateway */}
          <section className="inspector-section" style={{
            marginBottom: 0
          }}>
            <div className="inspector-section-title">Handoffs Gateway</div>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxHeight: "200px",
              overflowY: "auto"
            }}>
              {coordinationDetails.handoffs.length === 0 ? <div style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                textAlign: "center",
                padding: "12px",
                border: "1px dashed var(--border-color)",
                borderRadius: "8px"
              }}>
                No coordination handoffs registered.
              </div> : coordinationDetails.handoffs.map(ho => <div key={ho.id} style={{
                padding: "10px",
                background: "rgba(255, 255, 255, 0.02)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "6px"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.7rem",
                  fontWeight: 700
                }}>
                  <span style={{
                    color: "var(--accent-primary)"
                  }}>{ho.source_agent_id} ➔ {ho.target_agent_id}</span>
                  <span style={{
                    color: ho.status === "completed" ? "#10b981" : ho.status === "accepted" ? "var(--accent-secondary)" : "#f59e0b",
                    background: ho.status === "completed" ? "rgba(16, 185, 129, 0.08)" : ho.status === "accepted" ? "rgba(79, 172, 254, 0.08)" : "rgba(245, 158, 11, 0.08)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    textTransform: "uppercase",
                    fontSize: "0.6rem"
                  }}>{ho.status}</span>
                </div>
                <div style={{
                  fontSize: "0.76rem",
                  color: "var(--text-main)",
                  lineHeight: 1.3
                }}>{ho.reason}</div>
                
                {/* Action buttons based on status */}
                {ho.status === "pending" && <div style={{
                  display: "flex",
                  gap: "6px",
                  marginTop: "4px"
                }}>
                  <button onClick={() => handleResolveHandoff(ho.id!, "accepted")} style={{
                    flex: 1,
                    padding: "4px 8px",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    background: "rgba(16, 185, 129, 0.15)",
                    border: "1px solid rgba(16, 185, 129, 0.3)",
                    color: "#10b981",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}>
                    Accept
                  </button>
                  <button onClick={() => handleResolveHandoff(ho.id!, "rejected")} style={{
                    flex: 1,
                    padding: "4px 8px",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#f87171",
                    borderRadius: "4px",
                    cursor: "pointer"
                  }}>
                    Reject
                  </button>
                </div>}

                {ho.status === "accepted" && <button onClick={() => handleResolveHandoff(ho.id!, "completed")} style={{
                  width: "100%",
                  padding: "4px 8px",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  background: "rgba(79, 172, 254, 0.15)",
                  border: "1px solid rgba(79, 172, 254, 0.3)",
                  color: "#fff",
                  borderRadius: "4px",
                  cursor: "pointer",
                  marginTop: "4px"
                }}>
                  Complete Tasks
                </button>}
              </div>)}
            </div>
          </section>

          {/* Decisions list & Inline logger */}
          <section className="inspector-section" style={{
            marginBottom: 0
          }}>
            <div className="inspector-section-title">Engineering Decisions</div>
            
            {/* Manual Input Logger */}
            <div style={{
              display: "flex",
              gap: "6px",
              marginBottom: "10px"
            }}>
              <input className="form-input" style={{
                height: "32px",
                fontSize: "0.78rem",
                padding: "0 8px",
                margin: 0
              }} placeholder="Record dynamic decision..." value={newDecisionText} onChange={e => setNewDecisionText(e.target.value)} onKeyDown={async e => {
                if (e.key === "Enter") {
                  if (!newDecisionText.trim()) return;
                  try {
                    const activeWs = coordinationDetails.workspaces.find(w => w.active === 1) || {
                      id: "default"
                    };
                    await api.recordDecisionCmd({
                      workspaceId: activeWs.id,
                      decision: newDecisionText,
                      decidedBy: "User"
                    });
                    setNewDecisionText("");
                    loadCoordinationDetails();
                  } catch (err) {
                    (window as any).toast("Failed to record decision: " + err);
                  }
                }
              }} />
              <button style={{
                padding: "0 10px",
                background: "rgba(0, 242, 254, 0.1)",
                border: "1px solid rgba(0, 242, 254, 0.3)",
                color: "#fff",
                borderRadius: "6px",
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer"
              }} onClick={async () => {
                if (!newDecisionText.trim()) return;
                try {
                  const activeWs = coordinationDetails.workspaces.find(w => w.active === 1) || {
                    id: "default"
                  };
                  await api.recordDecisionCmd({
                    workspaceId: activeWs.id,
                    decision: newDecisionText,
                    decidedBy: "User"
                  });
                  setNewDecisionText("");
                  loadCoordinationDetails();
                } catch (err) {
                  (window as any).toast("Failed to record decision: " + err);
                }
              }}>
                Record
              </button>
            </div>

            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              maxHeight: "160px",
              overflowY: "auto"
            }}>
              {coordinationDetails.decisions.length === 0 ? <div style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                textAlign: "center",
                padding: "12px",
                border: "1px dashed var(--border-color)",
                borderRadius: "8px"
              }}>
                No decisions recorded yet.
              </div> : coordinationDetails.decisions.map(dec => <div key={dec.id} style={{
                padding: "8px",
                background: "rgba(255, 255, 255, 0.01)",
                border: "1px solid rgba(255,255,255,0.03)",
                borderRadius: "6px"
              }}>
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.64rem",
                  color: "var(--text-muted)",
                  marginBottom: "4px"
                }}>
                  <span>👤 Decided by: {dec.decided_by || "System"}</span>
                  <span>{dec.timestamp}</span>
                </div>
                <div style={{
                  fontSize: "0.75rem",
                  color: "var(--text-main)",
                  lineHeight: 1.3
                }}>{dec.decision}</div>
              </div>)}
            </div>
          </section>

          {/* Shared Awareness Terminal */}
          <section className="inspector-section">
            <div className="inspector-section-title">Shared Awareness Terminal</div>
            <div style={{
              maxHeight: "180px",
              overflowY: "auto",
              fontSize: "0.74rem",
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(255,255,255,0.05)",
              padding: "10px",
              borderRadius: "8px",
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-mono)",
              color: "#00f2fe",
              lineHeight: 1.4
            }}>
              {blackboardText}
            </div>
          </section>

        </div>
      )}
    </aside>
  );
}
