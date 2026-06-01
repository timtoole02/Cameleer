import React from 'react';
import { BacklogItem } from '../../types/backlog';
import { BacklogItemRow } from './BacklogItemRow';

interface BacklogGroup {
  id: string;
  label: string;
  items: BacklogItem[];
}

interface BacklogListProps {
  groups: BacklogGroup[];
  selectedId?: string | null;
  onSelectItem: (item: BacklogItem) => void;
}

export const BacklogList: React.FC<BacklogListProps> = ({ groups, selectedId, onSelectItem }) => (
  <section className="backlog-list" aria-label="Backlog items">
    {groups.map((group) => (
      <div key={group.id} className="backlog-group">
        <div className="backlog-group-header">
          <h2>{group.label}</h2>
          <span>{group.items.length}</span>
        </div>
        <div className="backlog-card-stack">
          {group.items.length === 0 ? (
            <div className="backlog-empty">No items</div>
          ) : group.items.map((item) => (
            <BacklogItemRow
              key={item.id}
              item={item}
              selected={selectedId === item.id}
              onSelect={onSelectItem}
            />
          ))}
        </div>
      </div>
    ))}
  </section>
);
