import React from 'react';
import { Agent } from '../../types/agent';
import { BoardColumn } from '../../api/kanban';
import { Task } from '../../types/task';
import { TaskCard } from './TaskCard';

interface KanbanColumnProps {
  column: BoardColumn;
  tasks: Task[];
  agentsById: Map<string, Agent>;
  selectedTaskId?: string | null;
  onSelectTask: (task: Task) => void;
  onCreateTask: (status: string) => void;
  onMoveTask: (taskId: string, status: string) => void;
  onDragStart: (taskId: string, event: React.DragEvent<HTMLDivElement>) => void;
}

export const KanbanColumn: React.FC<KanbanColumnProps> = ({
  column,
  tasks,
  agentsById,
  selectedTaskId,
  onSelectTask,
  onCreateTask,
  onMoveTask,
  onDragStart,
}) => {
  // dragenter/dragleave fire for every child the pointer crosses, so track a
  // depth counter instead of a boolean to keep the highlight stable.
  const depth = React.useRef(0);
  const [dragOver, setDragOver] = React.useState(false);

  return (
    <section
      className={`kanban-column status-${column.status_mapping} ${dragOver ? 'drag-over' : ''}`}
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current += 1;
        setDragOver(true);
      }}
      onDragLeave={() => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragOver(false);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        event.preventDefault();
        depth.current = 0;
        setDragOver(false);
        const taskId = event.dataTransfer.getData('text/task-id');
        if (taskId) onMoveTask(taskId, column.status_mapping);
      }}
    >
      <div className="kanban-column-header">
        <div>
          <h3>{column.name}</h3>
          <span>{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>
        </div>
        {column.wip_limit ? <span className="kanban-wip">WIP {column.wip_limit}</span> : null}
      </div>

      <div className="kanban-column-list">
        {tasks.length === 0 ? (
          <div className="kanban-column-empty">
            <strong>No tasks {column.name.toLowerCase()}</strong>
            <p>{column.status_mapping === 'review' ? 'Completed agent work will appear here before closeout.' : 'Create a task or move one into this column.'}</p>
            <button type="button" className="ghost-button" onClick={() => onCreateTask(column.status_mapping)}>Create task</button>
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              agent={task.assigned_agent_id ? agentsById.get(task.assigned_agent_id) : undefined}
              selected={selectedTaskId === task.id}
              onSelect={onSelectTask}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </section>
  );
};
