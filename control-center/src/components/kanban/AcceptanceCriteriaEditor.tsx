import React from 'react';

interface AcceptanceCriteriaEditorProps {
  value: string;
  onChange: (value: string) => void;
}

export function parseAcceptanceCriteria(value?: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean);
    }
  } catch {
    // Fall through to line parsing.
  }
  return value
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

export function serializeAcceptanceCriteria(lines: string): string {
  const items = parseAcceptanceCriteria(lines);
  return JSON.stringify(items);
}

export const AcceptanceCriteriaEditor: React.FC<AcceptanceCriteriaEditorProps> = ({ value, onChange }) => (
  <label className="kanban-field">
    <span>Acceptance criteria</span>
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      rows={5}
      placeholder="- App status is separate from Camelid status&#10;- Chat is disabled when Camelid is offline&#10;- UI shows clear disabled reason"
    />
  </label>
);
