import React from 'react';
import { Agent } from '../../types/agent';
import { TaskProgressUpdate } from '../../types/task';
import { TaskRun } from '../../types/taskRun';

interface AgentRunPanelProps {
  runs: TaskRun[];
  progress: TaskProgressUpdate[];
  agentsById: Map<string, Agent>;
}

export const AgentRunPanel: React.FC<AgentRunPanelProps> = ({ runs, progress, agentsById }) => (
  <section className="drawer-section">
    <h3>Agent progress</h3>
    {runs.length === 0 && progress.length === 0 ? (
      <p className="drawer-muted">No agent run has been started for this task.</p>
    ) : (
      <div className="agent-run-list">
        {runs.map((run) => (
          <div key={run.id} className={`agent-run-card ${run.state}`}>
            <div className="agent-run-header">
              <strong>{agentsById.get(run.agent_id)?.name || run.agent_id}</strong>
              <span>{run.state}</span>
            </div>
            {run.final_answer && <p>{run.final_answer}</p>}
            {run.error && <p className="drawer-error-text">{run.error}</p>}
          </div>
        ))}
        {progress.map((item) => (
          <div key={item.id} className={`progress-card ${item.status}`}>
            <strong>{agentsById.get(item.agent_id || '')?.name || 'Agent update'}</strong>
            <p>{item.content}</p>
            {item.error_message && <p className="drawer-error-text">{item.error_message}</p>}
          </div>
        ))}
      </div>
    )}
  </section>
);
