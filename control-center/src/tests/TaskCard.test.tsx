import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TaskCard } from '../components/kanban/TaskCard';
import { Task } from '../types/task';

const task = {
  id: 'task-dnd-1',
  title: 'Drag me',
  status: 'backlog',
  priority: 'high',
} as unknown as Task;

describe('TaskCard drag-and-drop regression', () => {
  it('is a draggable non-<button> element (WebKit never fires dragstart on form controls)', () => {
    render(<TaskCard task={task} onSelect={() => {}} onDragStart={() => {}} />);
    const card = screen.getByRole('button', { name: /Drag me/ });
    // In Tauri's WKWebView a draggable <button> silently breaks the board:
    // dragstart never fires from form controls. Keep the card a div.
    expect(card.tagName).not.toBe('BUTTON');
    expect(card.getAttribute('draggable')).toBe('true');
  });

  it('fires onDragStart with the task id and stays keyboard-selectable', () => {
    const onSelect = vi.fn();
    const onDragStart = vi.fn();
    render(<TaskCard task={task} onSelect={onSelect} onDragStart={onDragStart} />);
    const card = screen.getByRole('button', { name: /Drag me/ });

    fireEvent.dragStart(card, { dataTransfer: { setData: () => {}, effectAllowed: '' } });
    expect(onDragStart).toHaveBeenCalledWith('task-dnd-1', expect.anything());

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith(task);
  });
});
