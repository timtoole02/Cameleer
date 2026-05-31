import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { WorkspaceArea } from './components/layout/WorkspaceArea';
import { RecoveryPanel } from './components/layout/RecoveryPanel';
import { useAppStore } from './state/appStore';
import { getBackendHealth } from './api/health';

import { ChatPage } from './pages/ChatPage';
import { KanbanPage } from './pages/KanbanPage';
import { BacklogPage } from './pages/BacklogPage';
import { AgentsPage } from './pages/AgentsPage';
import { ModelsPage } from './pages/ModelsPage';
import { MemoryPage, RuntimePage, AuditPage, SettingsPage } from './pages/OtherPages';
import './App.css';

function App() {
  const { activeTab, backendHealth, setBackendHealth } = useAppStore();
  const [initError, setInitError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  const checkHealth = async () => {
    setIsChecking(true);
    setInitError(null);
    try {
      const health = await getBackendHealth();
      setBackendHealth(health);
    } catch (err: any) {
      setInitError(err.toString());
      setBackendHealth({
        status: 'offline',
        database_ready: false,
        migrations_applied: false,
        active_project_id: null,
        active_project_name: null,
        default_model_profile_id: null,
        message: err.toString()
      });
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const renderPage = () => {
    switch (activeTab) {
      case 'Chat': return <ChatPage />;
      case 'Kanban': return <KanbanPage />;
      case 'Backlog': return <BacklogPage />;
      case 'Agents': return <AgentsPage />;
      case 'Memory': return <MemoryPage />;
      case 'Models': return <ModelsPage />;
      case 'Runtime': return <RuntimePage />;
      case 'Audit': return <AuditPage />;
      case 'Settings': return <SettingsPage />;
      default: return <ChatPage />;
    }
  };

  if (isChecking) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--color-bg)' }}>
      <div style={{ color: 'var(--color-text-on-dark)' }}>Checking Backend Health...</div>
    </div>;
  }

  // If degraded or offline, show recovery panel
  if (backendHealth?.status === 'offline' || backendHealth?.status === 'degraded') {
    return <RecoveryPanel health={backendHealth} errorMsg={initError} onRetry={checkHealth} />;
  }

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <TopNav />
        <WorkspaceArea>
          {renderPage()}
        </WorkspaceArea>
      </div>
    </div>
  );
}

export default App;