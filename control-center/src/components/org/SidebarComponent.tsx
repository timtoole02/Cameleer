import { useAppStore } from '../../hooks/useAppStore';
import { OrgSidebar } from './OrgSidebar';

export function SidebarComponent(props: ReturnType<typeof useAppStore>) {
  const {
    setIsSpawnModalOpen,
    activeTab,
    setActiveTab,
    agents,
    setActiveOrgNode,
    setSelectedAgentId
  } = props;

  return (
    <aside className="sidebar" style={{
      padding: 0,
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div className="sidebar-header" style={{
        padding: '16px'
      }}>
        <div className="sidebar-logo">💻 CAMELEER</div>
      </div>

      <div style={{
        padding: '0 16px 16px 16px'
      }}>
        <button className="sidebar-btn" onClick={() => setIsSpawnModalOpen(true)}>
          🤖 Spawn Custom Agent
        </button>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '0 16px 16px',
        gap: '4px'
      }}>
        <div style={{
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          fontWeight: 600,
          letterSpacing: '1px',
          marginBottom: '8px'
        }}>Workspace</div>
        <button className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
        <button className={`sidebar-nav-item ${activeTab === 'global' ? 'active' : ''}`} onClick={() => setActiveTab('global')}>🌐 Global Feed</button>
        <button className={`sidebar-nav-item ${activeTab === 'kanban' ? 'active' : ''}`} onClick={() => setActiveTab('kanban')}>📋 Task Backlog</button>
        <button className={`sidebar-nav-item ${activeTab === 'runs' ? 'active' : ''}`} onClick={() => setActiveTab('runs')}>⏱️ Run Audit</button>
        <button className={`sidebar-nav-item ${activeTab === 'missions' ? 'active' : ''}`} onClick={() => setActiveTab('missions')}>🎯 Missions</button>
        <button className={`sidebar-nav-item ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>🧠 Memory & Files</button>
        
        <div style={{
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
          fontWeight: 600,
          letterSpacing: '1px',
          marginTop: '16px',
          marginBottom: '8px'
        }}>Orchestration</div>
        <button className={`sidebar-nav-item ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>🤖 Agents</button>
        <button className={`sidebar-nav-item ${activeTab === 'models' ? 'active' : ''}`} onClick={() => setActiveTab('models')}>⚙️ Local Models</button>
        <button className={`sidebar-nav-item ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')}>📚 Skills</button>
        <button className={`sidebar-nav-item ${activeTab === 'channels' ? 'active' : ''}`} onClick={() => setActiveTab('channels')}>📡 Channels</button>
        <button className={`sidebar-nav-item ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>🔌 System</button>
      </div>

      <div style={{
        flex: 1,
        overflow: 'hidden',
        borderTop: '1px solid rgba(255,255,255,0.1)'
      }}>
        <OrgSidebar workspaceId="default" agents={agents} onNodeSelect={node => {
          setActiveOrgNode(node);
          if (node.node_type === 'agent' && node.agent_id) {
            setSelectedAgentId(node.agent_id);
            setActiveTab("dm");
          } else {
            setActiveTab("org_dashboard");
          }
        }} />
      </div>
    </aside>
  );
}
