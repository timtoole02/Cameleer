import React from 'react';
import { Agent } from '../../types/agent';
import { WorkReceipt } from '../../types/workReceipt';

interface WorkReceiptPanelProps {
  receipt: WorkReceipt | null;
  agentsById: Map<string, Agent>;
  onGenerate: () => Promise<void>;
  onApprove: () => Promise<void>;
  onSendBack: (feedback: string) => Promise<void>;
  busy?: boolean;
}

function renderJsonList(value?: string | null): string {
  if (!value) return 'None recorded';
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.length ? parsed.join(', ') : 'None recorded';
  } catch {
    return value;
  }
  return value;
}

export const WorkReceiptPanel: React.FC<WorkReceiptPanelProps> = ({
  receipt,
  agentsById,
  onGenerate,
  onApprove,
  onSendBack,
  busy,
}) => {
  const [feedback, setFeedback] = React.useState('');

  return (
    <section className="drawer-section receipt-panel">
      <div className="drawer-section-title-row">
        <h3>Work receipt</h3>
        <button type="button" className="secondary-button" onClick={onGenerate} disabled={busy}>
          {receipt ? 'Regenerate' : 'Generate'}
        </button>
      </div>
      {!receipt ? (
        <p className="drawer-muted">A task cannot be moved to Done until a receipt exists and is approved.</p>
      ) : (
        <div className="receipt-card">
          <div className="receipt-meta">
            <span>{agentsById.get(receipt.agent_id || '')?.name || 'Unassigned agent'}</span>
            <span>{receipt.validation_status}</span>
          </div>
          <h4>Summary</h4>
          <p>{receipt.summary}</p>
          <h4>Instructions followed</h4>
          <p>{receipt.instructions_followed || 'No instructions recorded.'}</p>
          <h4>Acceptance criteria result</h4>
          <p>{renderJsonList(receipt.acceptance_criteria_results)}</p>
          <h4>Files changed</h4>
          <p>Created: {renderJsonList(receipt.files_created)}</p>
          <p>Modified: {renderJsonList(receipt.files_modified)}</p>
          <h4>Commands and tests</h4>
          <p>Commands: {renderJsonList(receipt.commands_run)}</p>
          <p>Tests: {renderJsonList(receipt.tests_run)}</p>
          <h4>Known limitations</h4>
          <p>{renderJsonList(receipt.known_limitations)}</p>
          <div className="receipt-actions">
            <button type="button" onClick={onApprove} disabled={busy}>Approve and Complete</button>
          </div>
          <label className="kanban-field">
            <span>Send back feedback</span>
            <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={3} />
          </label>
          <button
            type="button"
            className="secondary-button"
            onClick={() => onSendBack(feedback)}
            disabled={busy || feedback.trim().length === 0}
          >
            Send Back to Agent
          </button>
        </div>
      )}
    </section>
  );
};
