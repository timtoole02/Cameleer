import React from 'react';

interface BacklogReadinessPanelProps {
  score: number;
  label: string;
  missing: string[];
}

export const BacklogReadinessPanel: React.FC<BacklogReadinessPanelProps> = ({ score, label, missing }) => (
  <div className="readiness-panel">
    <div>
      <strong>{label}</strong>
      <span>{score}% ready</span>
    </div>
    <progress max={100} value={score} />
    {missing.length > 0 ? (
      <p>Missing: {missing.join(', ')}</p>
    ) : (
      <p>Ready fields are present. Promote when the task belongs on the execution board.</p>
    )}
  </div>
);
