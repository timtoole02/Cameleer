import React from 'react';

interface CreateBacklogItemModalProps {
  onCreate: () => void;
}

export const CreateBacklogItemModal: React.FC<CreateBacklogItemModalProps> = ({ onCreate }) => (
  <button type="button" onClick={onCreate}>New item</button>
);
