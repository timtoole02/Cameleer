import React from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { WorkspaceArea } from './components/layout/WorkspaceArea';
import { useAppStore } from './state/appStore';
import { ChatPage } from './pages/ChatPage';
import { KanbanPage } from './pages/KanbanPage';
import { BacklogPage } from './pages/BacklogPage';
import { AgentsPage } from './pages/AgentsPage';
import { ModelsPage } from './pages/ModelsPage';
import { MemoryPage, RuntimePage, AuditPage, SettingsPage } from './pages/OtherPages';
import './App.css';

function App() {
  const { activeTab } = useAppStore();

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

  return (
    <div className="app-container" style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
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