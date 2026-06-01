import React from 'react';
import { TaskActivity } from '../../types/task';

interface TaskActivityTimelineProps {
  activity: TaskActivity[];
}

export const TaskActivityTimeline: React.FC<TaskActivityTimelineProps> = ({ activity }) => (
  <section className="drawer-section">
    <h3>Activity</h3>
    {activity.length === 0 ? (
      <p className="drawer-muted">No activity recorded yet.</p>
    ) : (
      <div className="activity-timeline">
        {activity.map((item) => (
          <div key={item.id} className="activity-item">
            <span className="activity-dot" />
            <div>
              <strong>{item.summary}</strong>
              <span>{item.event_type} - {new Date(item.created_at).toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);
