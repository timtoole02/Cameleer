import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

export default function RunsView() {
  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runSteps, setRunSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = async () => {
    try {
      const data = await invoke<any[]>("get_agent_runs", { agentId: null, taskId: null });
      setRuns(data);
    } catch (e) {
      console.error("Failed to load runs", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSteps = async (runId: string) => {
    try {
      const data = await invoke<any[]>("get_run_steps", { runId });
      setRunSteps(data);
    } catch (e) {
      console.error("Failed to load steps", e);
    }
  };

  useEffect(() => {
    fetchRuns();
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      fetchSteps(selectedRunId);
    } else {
      setRunSteps([]);
    }
  }, [selectedRunId]);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>
      <div style={{ width: "300px", borderRight: "1px solid var(--border-color)", display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.2)" }}>
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border-color)" }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Agent Runs</h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.8rem", color: "var(--text-muted)" }}>Audit timeline of autonomous execution.</p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {loading ? (
            <div style={{ padding: "16px", color: "var(--text-muted)" }}>Loading runs...</div>
          ) : runs.length === 0 ? (
            <div style={{ padding: "16px", color: "var(--text-muted)" }}>No agent runs found.</div>
          ) : (
            runs.map(run => (
              <div 
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
                style={{
                  padding: "12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  marginBottom: "8px",
                  background: selectedRunId === run.id ? "rgba(255,255,255,0.05)" : "transparent",
                  cursor: "pointer"
                }}
              >
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--accent-primary)", marginBottom: "4px" }}>Run: {run.id.substring(0, 13)}...</div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>Agent: {run.agent_id ? run.agent_id.substring(0,8) : "N/A"}</span>
                  <span>{run.state}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
        {!selectedRunId ? (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
            Select a run from the sidebar to view audit steps.
          </div>
        ) : (
          <div style={{ maxWidth: "800px", margin: "0 auto" }}>
            <h2 style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", marginBottom: "16px" }}>Run Steps Audit</h2>
            {runSteps.length === 0 ? (
              <div style={{ color: "var(--text-muted)" }}>No detailed steps recorded for this run.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {runSteps.map((step, idx) => (
                  <div key={step.id} style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
                    <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0 }}>
                      {idx + 1}
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", padding: "12px", borderRadius: "8px", flex: 1 }}>
                      <div style={{ fontSize: "0.75rem", color: "var(--accent-primary)", fontWeight: 600, marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        {step.step_type}
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "var(--text-color)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                        {step.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
