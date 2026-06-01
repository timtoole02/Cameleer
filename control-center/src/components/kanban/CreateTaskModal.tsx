import React, { useState } from 'react';
import { Agent } from '../../types/agent';
import { CreateTaskInput } from '../../types/task';
import { AcceptanceCriteriaEditor, serializeAcceptanceCriteria } from './AcceptanceCriteriaEditor';
import { AgentAssignmentSelect } from './AgentAssignmentSelect';
import { PrioritySelector } from './PrioritySelector';

interface CreateTaskModalProps {
  agents: Agent[];
  initialStatus: string;
  onClose: () => void;
  onCreate: (input: CreateTaskInput) => Promise<void>;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ agents, initialStatus, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [criteria, setCriteria] = useState('');
  const [priority, setPriority] = useState('medium');
  const [typeName, setTypeName] = useState('task');
  const [assignedAgentId, setAssignedAgentId] = useState<string | null>(null);
  const [labels, setLabels] = useState('');
  const [reviewRequired, setReviewRequired] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canSubmit = title.trim().length > 0 && instructions.trim().length > 0;

  return (
    <div className="kanban-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="kanban-modal"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault();
          if (!canSubmit) {
            setError('Title and detailed instructions are required.');
            return;
          }
          setSaving(true);
          setError(null);
          try {
            await onCreate({
              title: title.trim(),
              description: description.trim() || null,
              instructions: instructions.trim(),
              acceptance_criteria: serializeAcceptanceCriteria(criteria),
              priority,
              type_name: typeName,
              assigned_agent_id: assignedAgentId,
              labels: labels.trim() || null,
              review_required: reviewRequired,
              status: initialStatus,
            });
          } catch (err: any) {
            setError(String(err));
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="kanban-modal-header">
          <div>
            <span className="eyebrow">New task</span>
            <h2>Create agent work item</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">x</button>
        </div>

        {error && <div className="kanban-error">{error}</div>}

        <label className="kanban-field">
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Fix health badge honesty" />
        </label>

        <label className="kanban-field">
          <span>Description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
        </label>

        <label className="kanban-field">
          <span>Detailed instructions</span>
          <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={6} />
        </label>

        <AcceptanceCriteriaEditor value={criteria} onChange={setCriteria} />

        <div className="kanban-form-grid">
          <label className="kanban-field">
            <span>Priority</span>
            <PrioritySelector value={priority} onChange={setPriority} />
          </label>
          <label className="kanban-field">
            <span>Type</span>
            <select value={typeName} onChange={(event) => setTypeName(event.target.value)}>
              <option value="task">Task</option>
              <option value="bug">Bug</option>
              <option value="feature">Feature</option>
              <option value="research">Research</option>
              <option value="documentation">Documentation</option>
              <option value="test">Test</option>
            </select>
          </label>
        </div>

        <AgentAssignmentSelect agents={agents} value={assignedAgentId} onChange={setAssignedAgentId} />

        <label className="kanban-field">
          <span>Labels</span>
          <input value={labels} onChange={(event) => setLabels(event.target.value)} placeholder="backend, health, p0" />
        </label>

        <label className="kanban-check-row">
          <input type="checkbox" checked={reviewRequired} onChange={(event) => setReviewRequired(event.target.checked)} />
          <span>Review required before Done</span>
        </label>

        <div className="kanban-modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={!canSubmit || saving}>{saving ? 'Creating...' : 'Create task'}</button>
        </div>
      </form>
    </div>
  );
};
