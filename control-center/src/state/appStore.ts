import { create } from 'zustand';
import { BackendHealth } from '../api/health';

interface AppState {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  
  backendHealth: BackendHealth | null;
  setBackendHealth: (health: BackendHealth) => void;
  
  activeProjectId: string | null;
  activeProjectName: string | null;
  selectedAgentId: string | null;
  setSelectedAgentId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeTab: 'Chat',
  setActiveTab: (tab) => set({ activeTab: tab }),
  
  backendHealth: null,
  setBackendHealth: (health) => set({ 
    backendHealth: health,
    activeProjectId: health.active_workspace_id,
    activeProjectName: health.active_workspace_name
  }),
  
  activeProjectId: null,
  activeProjectName: null,
  selectedAgentId: null,
  setSelectedAgentId: (id) => set({ selectedAgentId: id }),
}));

