import React from 'react';
import { Agent } from '../../types/agent';
import { BoardColumn } from '../../api/kanban';
import { Task } from '../../types/task';
import { KanbanColumn } from './KanbanColumn';

interface KanbanBoardProps {
  columns: BoardColumn[];
  tasks: Task[];
  agents: Agent[];
  selectedTaskId?: string | null;
  onSelectTask: (task: Task) => void;
  onCreateTask: (status: string) => void;
  onMoveTask: (taskId: string, status: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  columns,
  tasks,
  agents,
  selectedTaskId,
  onSelectTask,
  onCreateTask,
  onMoveTask,
}) => {
  const agentsById = React.useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);

  return (
    <div className="kanban-board" aria-label="Agent work board">
      {columns.map((column) => (
        <KanbanColumn
          key={column.id}
          column={column}
          tasks={tasks.filter((task) => (task.status || 'backlog') === column.status_mapping)}
          agentsById={agentsById}
          selectedTaskId={selectedTaskId}
          onSelectTask={onSelectTask}
          onCreateTask={onCreateTask}
          onMoveTask={onMoveTask}
          onDragStart={(taskId, event: React.DragEvent<HTMLDivElement>) => {
            event.dataTransfer.setData('text/task-id', taskId);
            event.dataTransfer.effectAllowed = 'move';
          }}
        />
      ))}
    </div>
  );
};
