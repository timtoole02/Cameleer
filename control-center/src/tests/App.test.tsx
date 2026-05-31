import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '../App';

// Mock Tauri invoke to prevent backend errors during frontend tests
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

describe('App component', () => {
  it('renders Sidebar and TopNav', () => {
    render(<App />);
    expect(screen.getByText('Workspace')).toBeDefined();
    expect(screen.getAllByText('Chat').length).toBeGreaterThan(0);
  });
});
