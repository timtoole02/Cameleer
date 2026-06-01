import React from 'react';

interface ConvertToTaskPanelProps {
  convertedLabel?: string | null;
  canConvert: boolean;
  disabledReason?: string | null;
  busy?: boolean;
  onConvert: () => void;
  onOpenTask: () => void;
}

export const ConvertToTaskPanel: React.FC<ConvertToTaskPanelProps> = ({
  convertedLabel,
  canConvert,
  disabledReason,
  busy,
  onConvert,
  onOpenTask,
}) => (
  <div className="convert-to-task-panel">
    {convertedLabel ? (
      <>
        <strong>Already converted to {convertedLabel}</strong>
        <button type="button" onClick={onOpenTask}>Open Kanban Task</button>
      </>
    ) : (
      <>
        <button type="button" disabled={busy || !canConvert} onClick={onConvert}>
          Convert to Kanban Task
        </button>
        {!canConvert && disabledReason ? <p className="drawer-muted">Convert disabled: {disabledReason}.</p> : null}
      </>
    )}
  </div>
);
