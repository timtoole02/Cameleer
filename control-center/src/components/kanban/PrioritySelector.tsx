import React from 'react';

const priorityOptions = ['low', 'medium', 'high', 'critical'];

interface PrioritySelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export const PrioritySelector: React.FC<PrioritySelectorProps> = ({ value, onChange }) => (
  <div className="priority-selector" role="radiogroup" aria-label="Priority">
    {priorityOptions.map((priority) => (
      <button
        key={priority}
        type="button"
        className={`priority-choice priority-${priority} ${value === priority ? 'active' : ''}`}
        aria-label={`Set priority ${priority}`}
        aria-pressed={value === priority}
        onClick={() => onChange(priority)}
      >
        {priority}
      </button>
    ))}
  </div>
);
