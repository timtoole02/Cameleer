import { create } from 'zustand';

export interface AppState {
  activeProjectId: string | null;
  selectedAgentId: string | null;
  selectedThreadId: string | null;
  selectedTaskId: string | null;
  activeTab: string;
  backendHealth: 'healthy' | 'degraded' | 'offline' | 'unknown';
  globalError: string | null;
  lastRefreshAt: number;
  
  // Actions
  setActiveProjectId: (id: string | null) => void;
  setSelectedAgentId: (id: string | null) => void;
  setSelectedThreadId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
  setBackendHealth: (health: 'healthy' | 'degraded' | 'offline' | 'unknown') => void;
  setGlobalError: (error: string | null) => void;
  triggerRefresh: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeProjectId: null,
  selectedAgentId: null,
  selectedThreadId: null,
  selectedTaskId: null,
  activeTab: 'Chat',
  backendHealth: 'unknown',
  globalError: null,
  lastRefreshAt: Date.now(),
  
  setActiveProjectId: (id) => set({ activeProjectId: id }),
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
  setSelectedThreadId: (id) => set({ selectedThreadId: id }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  setBackendHealth: (health) => set({ backendHealth: health }),
  setGlobalError: (error) => set({ globalError: error }),
  triggerRefresh: () => set({ lastRefreshAt: Date.now() }),
}));
