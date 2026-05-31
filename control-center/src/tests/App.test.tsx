import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import App from '../App';
import { useAppStore } from '../state/appStore';

const invokeMock = vi.hoisted(() => vi.fn());

// Mock Tauri invoke to prevent backend errors during frontend tests
vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

const healthyBackend = {
  app_status: 'online',
  database_status: 'ready',
  camelid_status: 'connected',
  schema_version: 2,
  required_schema_version: 2,
  database_path: '/tmp/cameleer.db',
  active_workspace_id: 'workspace-1',
  active_workspace_name: 'P0 Workspace',
  active_agent_id: null,
  active_agent_name: null,
  camelid_endpoint: 'http://127.0.0.1:8181',
  camelid_model: 'Llama 3.2 1B Instruct',
  errors: [],
  warnings: [],
};

const coderAgent = {
  id: 'agent-coder',
  name: 'Coder',
  role: 'engineer',
  persona: 'Writes code',
  model_provider: 'camelid',
  model_name: 'Llama 3.2 1B Instruct',
  temperature: 0,
  max_tokens: 512,
  can_spawn_subtasks: false,
  can_talk_globally: true,
  is_continuous: false,
  status: 'active',
  last_heartbeat: null,
};

function mockHealthyInvoke() {
  invokeMock.mockImplementation((command: string) => {
    if (command === 'get_backend_health') return Promise.resolve(healthyBackend);
    if (command === 'get_messages') return Promise.resolve([]);
    if (command === 'get_agents') return Promise.resolve([coderAgent]);
    return Promise.resolve([]);
  });
}

afterEach(() => {
  vi.useRealTimers();
  invokeMock.mockReset();
  useAppStore.setState({
    activeTab: 'Chat',
    backendHealth: null,
    activeProjectId: null,
    activeProjectName: null,
    selectedAgentId: null,
  });
});

describe('App component', () => {
  it('renders Sidebar and TopNav', async () => {
    mockHealthyInvoke();
    render(<App />);
    expect(await screen.findByText(/Workspace:/)).toBeDefined();
    expect(screen.getAllByText('Chat').length).toBeGreaterThan(0);
  });

  it('keeps the chat composer mounted during background health polling', async () => {
    vi.useFakeTimers();
    mockHealthyInvoke();

    render(<App />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const composer = screen.getByPlaceholderText('Message #global');
    fireEvent.change(composer, { target: { value: 'do not lose this draft' } });

    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByText('Checking Backend Health...')).toBeNull();
    expect(screen.getByDisplayValue('do not lose this draft')).toBeDefined();

    expect(invokeMock.mock.calls.filter(([command]) => command === 'get_backend_health').length).toBeGreaterThanOrEqual(2);
    expect(invokeMock.mock.calls.filter(([command]) => command === 'get_messages')).toHaveLength(1);
  });

  it('renders global and direct agent chat channels', async () => {
    mockHealthyInvoke();

    render(<App />);

    expect(await screen.findByText('Global')).toBeDefined();
    expect(screen.getByText('Talk to everyone')).toBeDefined();
    expect(screen.getByText('Coder')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Coder/ }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(await screen.findByPlaceholderText('Message Coder')).toBeDefined();
    expect(invokeMock.mock.calls.some(([command, args]) => (
      command === 'get_messages' && args?.sessionId === 'agent-chat:agent-coder'
    ))).toBe(true);
  });
});
