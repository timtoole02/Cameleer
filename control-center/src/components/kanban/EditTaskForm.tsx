import React, { useEffect, useState } from 'react';
import { Agent } from '../../types/agent';
import { CreateTaskInput, Task } from '../../types/task';
import { AcceptanceCriteriaEditor, parseAcceptanceCriteria, serializeAcceptanceCriteria } from './AcceptanceCriteriaEditor';
import { AgentAssignmentSelect } from './AgentAssignmentSelect';

interface EditTaskFormProps {
  task: Task;
  agents: Agent[];
  onSave: (fields: Partial<CreateTaskInput> & { blocked_reason?: string | null }) => Promise<void>;
}

export const EditTaskForm: React.FC<EditTaskFormProps> = ({ task, agents, onSave }) => {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [instructions, setInstructions] = useState(task.instructions || '');
  const [criteria, setCriteria] = useState(parseAcceptanceCriteria(task.acceptance_criteria).map((item) => `- ${item}`).join('\n'));
  const [priority, setPriority] = useState(task.priority || 'medium');
  const [typeName, setTypeName] = useState(task.type_name || 'task');
  const [assignedAgentId, setAssignedAgentId] = useState(task.assigned_agent_id || null);
  const [labels, setLabels] = useState(task.labels || '');
  const [blockedReason, setBlockedReason] = useState(task.blocked_reason || '');
  const [reviewRequired, setReviewRequired] = useState(Boolean(task.review_required ?? true));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(task.title);
    setDescription(task.description || '');
    setInstructions(task.instructions || '');
    setCriteria(parseAcceptanceCriteria(task.acceptance_criteria).map((item) => `- ${item}`).join('\n'));
    setPriority(task.priority || 'medium');
    setTypeName(task.type_name || 'task');
    setAssignedAgentId(task.assigned_agent_id || null);
    setLabels(task.labels || '');
    setBlockedReason(task.blocked_reason || '');
    setReviewRequired(Boolean(task.review_required ?? true));
  }, [task]);

  return (
    <form
      className="kanban-edit-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSave({
            title: title.trim(),
            description: description.trim() || null,
            instructions: instructions.trim(),
            acceptance_criteria: serializeAcceptanceCriteria(criteria),
            priority,
            type_name: typeName,
            assigned_agent_id: assignedAgentId,
            labels: labels.trim() || null,
            blocked_reason: blockedReason.trim() || null,
            review_required: reviewRequired,
          });
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="kanban-field">
        <span>Title</span>
        <input value={title} onChange={(event) => setTitle(event.target.value)} />
      </label>
      <label className="kanban-field">
        <span>Description</span>
        <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} />
      </label>
      <label className="kanban-field">
        <span>Detailed instructions</span>
        <textarea value={instructions} onChange={(event) => setInstructions(event.target.value)} rows={5} />
      </label>
      <AcceptanceCriteriaEditor value={criteria} onChange={setCriteria} />
      <div className="kanban-form-grid">
        <label className="kanban-field">
          <span>Priority</span>
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
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
        <input value={labels} onChange={(event) => setLabels(event.target.value)} />
      </label>
      <label className="kanban-field">
        <span>Blocked reason</span>
        <input value={blockedReason} onChange={(event) => setBlockedReason(event.target.value)} />
      </label>
      <label className="kanban-check-row">
        <input type="checkbox" checked={reviewRequired} onChange={(event) => setReviewRequired(event.target.checked)} />
        <span>Review required</span>
      </label>
      <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save details'}</button>
    </form>
  );
};
