
import { dashboardTab as DashboardTab } from './components/tabs/dashboardTab';
import { kanbanTab as KanbanTab } from './components/tabs/kanbanTab';
import { skillsTab as SkillsTab } from './components/tabs/skillsTab';
import { channelsTab as ChannelsTab } from './components/tabs/channelsTab';
import { filesTab as FilesTab } from './components/tabs/filesTab';
import { missionsTab as MissionsTab } from './components/tabs/missionsTab';
import { agentsTab as AgentsTab } from './components/tabs/agentsTab';
import { modelsTab as ModelsTab } from './components/tabs/modelsTab';

import { api } from "./services/api";
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import AgentChat from "./components/chat/AgentChat";
import BacklogManager from "./components/backlog/BacklogManager";
import KanbanBoard from "./components/board/KanbanBoard";
import CardDrawer from "./components/board/CardDrawer";
import { OrgSidebar } from "./components/org/OrgSidebar";
import { ProjectDashboard } from "./components/org/ProjectDashboard";
import { AgentOrgNode } from "./types";
import RunsView from "./components/runs/RunsView";
import "./styles/tokens.css";
import "./styles/components.css";
import "./App.css";
import { useAppStore } from "./hooks/useAppStore";
interface Agent {
  id: string;
  name: string;
  role: string;
  persona: string;
  model_provider: string;
  model_name: string;
  temperature: number;
  max_tokens: number;
  can_spawn_subtasks: boolean;
  can_talk_globally: boolean;
  is_continuous: boolean;
  status: string;
  last_heartbeat: string | null;
  parent_agent_id?: string | null;
  allowed_tools?: string | null;
}
interface Message {
  id?: number;
  session_id: string;
  role: string;
  sender_id: string | null;
  content: string;
  timestamp: string;
}
interface Task {
  id: string;
  workspace_id?: string | null;
  title: string;
  description: string | null;
  owner_id: string | null;
  assigned_agent_id?: string | null;
  status: string;
  priority: string;
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
  due_date?: string | null;
  acceptance_criteria?: string | null; // serialized JSON
  required_files?: string | null; // serialized JSON
  related_files?: string | null; // serialized JSON
  related_artifacts?: string | null; // serialized JSON
  dependencies?: string | null; // serialized JSON
  blockers?: string | null; // serialized JSON
  comments?: string | null; // serialized JSON
  activity_log?: string | null; // serialized JSON
  validation_status?: string | null;
  completion_evidence?: string | null;
}
interface ProviderConfig {
  id?: number;
  provider: string;
  model_name: string;
  api_key: string | null;
  endpoint_url: string | null;
  is_default: boolean;
}
interface Workspace {
  id: string;
  name: string;
  path: string;
  active: number;
}
interface Decision {
  id?: number;
  workspace_id?: string;
  decision: string;
  decided_by?: string;
  timestamp: string;
}
interface Handoff {
  id?: number;
  task_id?: string;
  source_agent_id: string;
  target_agent_id: string;
  reason: string;
  status: string;
  timestamp: string;
}
interface CoordinationDetails {
  workspaces: Workspace[];
  decisions: Decision[];
  handoffs: Handoff[];
}
interface WorkSuggestion {
  id: string;
  title: string;
  description: string;
  severity: "info" | "warning" | "critical" | "success";
  suggestion_type: "blocker" | "assignment" | "handoff" | "review" | "recovery";
  action_label?: string | null;
  action_command?: string | null;
  related_agent_id?: string | null;
  related_task_id?: string | null;
}
interface TemplateInfo {
  key: string;
  name: string;
  role: string;
  persona: string;
  primary_skills: string[];
  allowed_tools: string[];
  reasoning_level: string;
  workspace_access: string;
  file_access_scope: string[];
  command_permissions: string[];
  kanban_permissions: string;
  review_requirements: boolean;
  safety_profile: string;
}
interface SubtaskProposal {
  id: string;
  title: string;
  description: string;
  priority: string;
  preferred_role: string;
  required_files: string;
}
interface MissionProgress {
  preview_id: string;
  title: string;
  goal: string;
  total_cards: number;
  completed_cards: number;
  progress_percent: number;
  status: string;
}
interface ModelCatalogEntry {
  model_id: string;
  display_name: string;
  provider: string;
  source_repo: string | null;
  source_file: string | null;
  local_path: string | null;
  architecture: string | null;
  quantization: string | null;
  parameter_count: string | null;
  file_size_bytes: number;
  install_status: string;
  compatibility_status: string;
  runnable_status: boolean;
  active_status: boolean;
  license: string | null;
}
interface HuggingFaceModelEntry {
  repo_id: string;
  filename: string;
  size_bytes: number;
  download_url: string;
}
interface PreflightResponse {
  file_valid: boolean;
  gguf_version: number;
  architecture: string;
  tensor_count: number;
  metadata_count: number;
  context_length: number;
  quantization: string;
  compatibility_tier: string;
  tensor_paths_supported: boolean;
  tokenizer_supported: boolean;
  estimated_memory_required: string;
  recommended_action: string;
  warnings: string[];
  blockers: string[];
}
interface TensorDetails {
  tensor_name: string;
  tensor_type: string;
  shape: number[];
  supported: boolean;
  notes: string | null;
}
interface DownloadDetails {
  download_id: string;
  status: string;
  total_bytes: number;
  downloaded_bytes: number;
  resume_supported: boolean;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
}
interface ActivationDetails {
  scope_type: string;
  scope_id: string;
  activated_at: string;
}
interface InspectionDetails {
  gguf_version: number;
  architecture: string;
  tokenizer_model: string;
  context_length: number;
  embedding_length: number;
  block_count: number;
  feed_forward_length: number;
  attention_head_count: number;
  attention_head_count_kv: number;
  rope_dimension_count: number;
  rope_freq_base: number;
  rope_freq_scale: number;
  quantization_summary: string;
  tensor_count: number;
  supported_tensor_types: string[];
  unsupported_tensor_types: string[];
  required_runtime_features: string[];
  inspection_status: string;
  inspection_errors: string | null;
}
interface ModelDetailsResponse {
  entry: ModelCatalogEntry;
  inspection: InspectionDetails | null;
  tensors: TensorDetails[];
  download: DownloadDetails | null;
  activations: ActivationDetails[];
}
interface StorageUsageResponse {
  total_allocated_bytes: number;
  space_saved_partial_bytes: number;
  installed_count: number;
  models_storage_path: string;
}
interface SmokeTestResult {
  success: boolean;
  prompt: string;
  tokens_generated: number;
  tokens_per_second: number;
  load_latency_ms: number;
  memory_allocated_mb: number;
  log_output: string;
}
interface BackendStatus {
  state: string;
  pid: number | null;
  port: number | null;
  bind_address: string;
  version: string | null;
  uptime_seconds: number | null;
  active_model: string | null;
  model_loaded: boolean;
  last_health_check_at: string | null;
  last_error: string | null;
  restart_count: number;
  log_path: string | null;
}
interface BackendRuntimeConfig {
  backend_binary_path: string | null;
  bind_address: string;
  port: number;
  auto_start_on_app_launch: boolean;
  auto_restart_on_crash: boolean;
  stop_on_app_exit: boolean;
  startup_timeout_ms: number;
  health_check_interval_ms: number;
  restart_backoff_policy: string;
  max_restarts: number;
  log_path: string | null;
  model_path: string | null;
}
function App() {
  const state = useAppStore();
  const {
    activeTab,
    setActiveTab,
    kanbanView,
    setKanbanView,
    refreshKanban,
    setRefreshKanban,
    suggestions,
    setSuggestions,
    templates,
    setTemplates,
    selectedTemplateKey,
    setSelectedTemplateKey,
    wizardCustomName,
    setWizardCustomName,
    decomposingTaskId,
    setDecomposingTaskId,
    decomposedProposals,
    setDecomposedProposals,
    localModels,
    setLocalModels,
    activeModel,
    setActiveModel,
    downloadState,
    setDownloadState,
    editAgentId,
    setEditAgentId,
    editName,
    setEditName,
    editRole,
    setEditRole,
    editPersona,
    setEditPersona,
    editProvider,
    setEditProvider,
    editModelName,
    setEditModelName,
    editTemp,
    setEditTemp,
    editMaxTokens,
    setEditMaxTokens,
    editSpawnSubtasks,
    setEditSpawnSubtasks,
    editTalkGlobally,
    setEditTalkGlobally,
    editContinuous,
    setEditContinuous,
    editParentAgentId,
    setEditParentAgentId,
    editAllowedTools,
    setEditAllowedTools,
    agents,
    setAgents,
    selectedAgentId,
    setSelectedAgentId,
    activeOrgNode,
    setActiveOrgNode,
    messages,
    setMessages,
    tasks,
    setTasks,
    selectedKanbanTask,
    setSelectedKanbanTask,
    outcomeGoal,
    setOutcomeGoal,
    selectedMissionPack,
    setSelectedMissionPack,
    missionPreview,
    setMissionPreview,
    missionPacks,
    setMissionPacks,
    customPackName,
    setCustomPackName,
    autopilotEnabled,
    setAutopilotEnabled,
    autopilotScope,
    setAutopilotScope,
    approvalRequirements,
    setApprovalRequirements,
    networkPermissions,
    setNetworkPermissions,
    doneApprovalRules,
    setDoneApprovalRules,
    missionAuditEvents,
    setMissionAuditEvents,
    activeMissions,
    setActiveMissions,
    activeContract,
    setActiveContract,
    activeReceipt,
    setActiveReceipt,
    modelsCatalog,
    setModelsCatalog,
    selectedModelForInspect,
    setSelectedModelForInspect,
    modelDetails,
    setModelDetails,
    remoteModels,
    setRemoteModels,
    modelsSearchQuery,
    setModelsSearchQuery,
    modelsFilterQuant,
    setModelsFilterQuant,
    modelsSubTab,
    setModelsSubTab,
    importPath,
    setImportPath,
    importCopy,
    setImportCopy,
    preflightReport,
    setPreflightReport,
    preflightLoading,
    setPreflightLoading,
    smokeTestResult,
    setSmokeTestResult,
    smokeTesting,
    setSmokeTesting,
    storageUsage,
    setStorageUsage,
    activeModelDetailTab,
    setActiveModelDetailTab,
    developerMode,
    setDeveloperMode,
    metadataSearch,
    setMetadataSearch,
    tensorSearch,
    setTensorSearch,
    backendStatus,
    setBackendStatus,
    backendLogs,
    setBackendLogs,
    formAutoStart,
    setFormAutoStart,
    formAutoRestart,
    setFormAutoRestart,
    formStopOnExit,
    setFormStopOnExit,
    formPort,
    setFormPort,
    formLogPath,
    setFormLogPath,
    formBinaryPath,
    setFormBinaryPath,
    formBindAddress,
    setFormBindAddress,
    formMaxRestarts,
    setFormMaxRestarts,
    formBackoffPolicy,
    setFormBackoffPolicy,
    loadMissionData,
    handleGenerateProposal,
    handleApplyMission,
    handleDiscardMission,
    handleSaveCustomPack,
    handleUpdateAutopilotSettings,
    detailCommentText,
    setDetailCommentText,
    blockerText,
    setBlockerText,
    blockedByTaskId,
    setBlockedByTaskId,
    evidenceText,
    setEvidenceText,
    validationPassed,
    setValidationPassed,
    validationNotes,
    setValidationNotes,
    completionError,
    setCompletionError,
    selectedCompletingAgentId,
    setSelectedCompletingAgentId,
    selectedClaimingAgentId,
    setSelectedClaimingAgentId,
    isCompletingTask,
    setIsCompletingTask,
    isAddingBlocker,
    setIsAddingBlocker,
    taskRequiredFiles,
    setTaskRequiredFiles,
    taskAcceptanceCriteria,
    setTaskAcceptanceCriteria,
    taskDependencies,
    setTaskDependencies,
    modalDetailsTab,
    setModalDetailsTab,
    timelineEntries,
    setTimelineEntries,
    blackboardText,
    setBlackboardText,
    inputText,
    setInputText,
    inspectorTab,
    setInspectorTab,
    coordinationDetails,
    setCoordinationDetails,
    newDecisionText,
    setNewDecisionText,
    artifacts,
    setArtifacts,
    selectedArtifactPath,
    setSelectedArtifactPath,
    selectedArtifactContent,
    setSelectedArtifactContent,
    modelPriority,
    setModelPriority,
    cpuUsage,
    setCpuUsage,
    ramUsage,
    setRamUsage,
    tps,
    setTps,
    selectAgentForEdit,
    isSpawnModalOpen,
    setIsSpawnModalOpen,
    isTaskModalOpen,
    setIsTaskModalOpen,
    spawnName,
    setSpawnName,
    spawnRole,
    setSpawnRole,
    spawnPersona,
    setSpawnPersona,
    spawnProvider,
    setSpawnProvider,
    spawnModel,
    setSpawnModel,
    spawnTemp,
    setSpawnTemp,
    spawnMaxTokens,
    setSpawnMaxTokens,
    spawnContinuous,
    setSpawnContinuous,
    spawnParentAgentId,
    setSpawnParentAgentId,
    spawnAllowedTools,
    setSpawnAllowedTools,
    taskTitle,
    setTaskTitle,
    taskDesc,
    setTaskDesc,
    taskOwner,
    setTaskOwner,
    taskPriority,
    setTaskPriority,
    ollamaUrl,
    setOllamaUrl,
    camelidUrl,
    setCamelidUrl,
    openaiKey,
    setOpenaiKey,
    anthropicKey,
    setAnthropicKey,
    blackboardInput,
    setBlackboardInput,
    isThinking,
    setIsThinking,
    feedEndRef,
    loadSuggestions,
    loadTemplates,
    handleCreateSoftwareTeam,
    handleCreateCodingSprint,
    handleLaunchAgent,
    handleDecompose,
    handleApproveSubtasks,
    handleResolveCommandApproval,
    handleSuggestionAction,
    loadArtifacts,
    handleSelectArtifact,
    loadLocalModels,
    loadModelCatalog,
    loadStorageUsage,
    handleRemoteSearch,
    handlePreflightCheck,
    handleDownloadModel,
    handlePauseDownload,
    handleCancelDownload,
    handleImportLocal,
    handleOpenModelInspect,
    handleActivateModelScopedSelect,
    handleRunSmokeLoadingTest,
    handleDeleteModelSecure,
    loadBackendStatus,
    handleCheckBackendHealth,
    handleRestartBackend,
    handleStopBackend,
    handleGetBackendLogs,
    handleOpenBackendLogs,
    handleSaveBackendConfig,
    handleResetBackendRuntime,
    loadAgents,
    loadMessages,
    loadTasks,
    loadBlackboard,
    loadCoordinationDetails,
    handleResolveHandoff,
    loadProviderConfigs,
    handleSendMessage,
    handleSpawnAgent,
    handleSaveAgentConfig,
    handleRetireAgent,
    safeParseJson,
    recommendAgentForTask,
    handleCreateTask,
    handleTransitionStatus,
    handleClaimCard,
    handleCompleteCard,
    handleAddComment,
    handleAddBlocker,
    handleToggleChecklistItem,
    handleDeleteAgent,
    handleSaveSettings,
    blockingOverlayStyle,
    glassCardStyle,
    overlayTitleStyle,
    renderBlockingOverlay
  } = state;
  // Form editing states for Agents tab
  // Mission Builder, Contracts, Receipts, and Autopilot React State Hooks
  // Model Manager React State Hooks
  // Backend Runtime Supervisor React State Hooks
  // Hook: Load Agent Contracts & Work Receipts dynamically on Kanban Selection
  // Loader: Dynamic Mission Packs, Autopilot Settings & Audit Events
  // API Call: Propose Mission preview
  // API Call: Apply draft proposed crew and board
  // API Call: Discard draft proposal
  // API Call: Save current proposal settings as reusable Custom Mission Pack
  // API Call: Update Autopilot state, scope, safety requirements, and rules
  // Telemetry (Cameleer stats from local daemon)
  // File Explorer states
  // Model priority failover chain
  // System Stats Oscillation Telemetry
  // Migrate localStorage keys from camelid.* to cameleer.* (Silent migration)
  // Modals Control
  // Agent Creator Form
  // Task Creator Form
  // Provider Settings
  // 1. Initial Load of Database contents
  // Polling hook every 3 seconds for shared awareness details
  // 2. Fetch messages dynamically when Tab or Selected Agent changes
  // 3. Scroll to latest messages when they load
  // Load artifacts when the Files tab is focused
  // 4. Tauri Global Event Listeners for real-time reactive streaming updates
  // Submit DM or Global Message
  // Spawn Custom Agent
  // Save Agent Configuration
  // Retire Agent Configured
  // Safe JSON Parsing Helper
  // Smart Assignment Recommendations based on task type keywords
  // Create Kanban Task
  // Transition Card Status general helper
  // Claim Card
  // Complete and Validate Card on Host System
  // Add Comment to card history
  // Declare Card Blocked via database dependency blockers mapping
  // Toggle Acceptance Checklist Item
  // Delete Agent
  // Save Settings
  return <div className="app-layout">
      {renderBlockingOverlay()}
      {/* 1. Sidebar Column */}
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

      {/* 2. Main Chat/Board panel */}
      <main className="chat-panel">
        <header className="chat-header">
          <div className="chat-title-group">
            {activeTab === "dashboard" ? <div>
                <h2 className="chat-title">Mission Control</h2>
                <div className="chat-subtitle">Turnkey Local AI Workforce Platform Overview</div>
              </div> : activeTab === "global" ? <div>
                <h2 className="chat-title">#global-room</h2>
                <div className="chat-subtitle">Broadcasting coordination blackboard packet to all active agents</div>
              </div> : activeTab === "dm" ? <div>
                <h2 className="chat-title">
                  Direct Messages: @
                  {agents.find(a => a.id === selectedAgentId)?.name || selectedAgentId}
                </h2>
                <div className="chat-subtitle">
                  {agents.find(a => a.id === selectedAgentId)?.role || "Agent Profile"}
                </div>
              </div> : activeTab === "kanban" ? <div>
                <h2 className="chat-title">Task Objectives</h2>
                <div className="chat-subtitle">Local Filesystem Coordination Kanban Workspace</div>
              </div> : activeTab === "runs" ? <div>
                <h2 className="chat-title">Run Audit</h2>
                <div className="chat-subtitle">Execution logs and audit trails for automated task sequences</div>
              </div> : activeTab === "skills" ? <div>
                <h2 className="chat-title">Skill Playbooks</h2>
                <div className="chat-subtitle">Dynamic autonomous playbook configurations loaded from workspace</div>
              </div> : activeTab === "channels" ? <div>
                <h2 className="chat-title">Messaging Surfaces</h2>
                <div className="chat-subtitle">Connect, pair, and audit external communication interfaces</div>
              </div> : activeTab === "files" ? <div>
                <h2 className="chat-title">Workspace Artifacts</h2>
                <div className="chat-subtitle">Direct local filesystem view of all saved outputs</div>
              </div> : activeTab === "agents" ? <div>
                <h2 className="chat-title">Crew Control Center</h2>
                <div className="chat-subtitle">Inspect, customize, tune, and hot-swap active agent models</div>
              </div> : activeTab === "models" ? <div>
                <h2 className="chat-title">Local Inference Models</h2>
                <div className="chat-subtitle">Download and activate optimized GGUF language models running natively via Camelid</div>
              </div> : activeTab === "org_dashboard" && activeOrgNode ? <div>
                <h2 className="chat-title">{activeOrgNode.display_name}</h2>
                <div className="chat-subtitle">{activeOrgNode.node_type.toUpperCase()} SCOPE</div>
              </div> : <div>
                <h2 className="chat-title">System Metrics</h2>
                <div className="chat-subtitle">Real-time GGUF local model execution and hardware telemetry</div>
              </div>}
          </div>

          {/* panel-tabs moved to sidebar */}
        </header>

        {activeTab === "dashboard" ? <DashboardTab {...state} /> : activeTab === "global" || activeTab === "dm" || activeTab === "org_dashboard" ? <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden"
      }}>
            {activeTab === "org_dashboard" && activeOrgNode && <div style={{
          flex: "0 0 auto",
          maxHeight: "45%",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          overflowY: "auto"
        }}>
                <ProjectDashboard activeNode={activeOrgNode} agents={agents} onCardClick={card => {
            setSelectedKanbanTask(card as any);
            setCompletionError(null);
            setIsCompletingTask(false);
            setIsAddingBlocker(false);
            setIsTaskModalOpen(false); // Make sure modal state is right if used
          }} refreshTrigger={refreshKanban} />
              </div>}
            {/* Messages Feed and Chat Input */}
            <AgentChat activeTab={activeTab} agents={agents} selectedAgentId={selectedAgentId} activeOrgNode={activeOrgNode} messages={messages} isThinking={isThinking} inputText={inputText} setInputText={setInputText} handleSendMessage={handleSendMessage} feedEndRef={feedEndRef} />
          </div> : activeTab === "kanban" ? /* Kanban System */<KanbanTab {...state} /> : activeTab === "runs" ? <RunsView /> : activeTab === "skills" ? /* Skills Page */<SkillsTab {...state} /> : activeTab === "channels" ? /* Channels Page */<ChannelsTab {...state} /> : activeTab === "files" ? /* Files Page */<FilesTab {...state} /> : activeTab === "missions" ? /* Crew Autonomy & Mission Builder Portal */<MissionsTab {...state} /> : activeTab === "agents" ? /* Crew Control Page */<AgentsTab {...state} /> : activeTab === "models" ? /* Scoped Local Models Package Manager Dashboard */<ModelsTab {...state} /> : (/* System Page */
      <div className="system-container" style={{
        flex: 1,
        overflowY: "auto",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "24px"
      }}>
            <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: "16px"
        }}>
              
              {/* Telemetry Card 1 */}
              <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border-color)",
            borderRadius: "14px",
            padding: "20px"
          }}>
                <h4 style={{
              fontSize: "0.8rem",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              fontWeight: 700,
              letterSpacing: "0.5px",
              marginBottom: "12px"
            }}>🧠 Local Inference (Camelid Runtime Engine)</h4>
                <div style={{
              fontSize: "2rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "baseline",
              gap: "6px"
            }}>
                  {tps} <span style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                fontWeight: 500
              }}>tok/sec</span>
                </div>
                <div style={{
              marginTop: "12px"
            }}>
                  <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                marginBottom: "4px"
              }}>
                    <span>Metal GPU Offloading</span>
                    <span>100% Core GPU</span>
                  </div>
                  <div style={{
                height: "6px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "3px",
                overflow: "hidden"
              }}>
                    <div style={{
                  height: "100%",
                  background: "linear-gradient(90deg, #10b981, #00f2fe)",
                  width: "100%"
                }} />
                  </div>
                </div>
                <div style={{
              marginTop: "12px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              paddingTop: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "0.75rem"
            }}>
                  <div style={{
                display: "flex",
                justifyContent: "space-between"
              }}>
                    <span style={{
                  color: "var(--text-muted)"
                }}>Engine Daemon:</span>
                    <span style={{
                  color: "var(--color-working)",
                  fontWeight: 600
                }}>ACTIVE (Port 8181)</span>
                  </div>
                  <div style={{
                display: "flex",
                justifyContent: "space-between"
              }}>
                    <span style={{
                  color: "var(--text-muted)"
                }}>GGUF Format:</span>
                    <span>Llama 3.2 3B Instruct</span>
                  </div>
                </div>
              </div>

              {/* Telemetry Card 2 */}
              <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border-color)",
            borderRadius: "14px",
            padding: "20px"
          }}>
                <h4 style={{
              fontSize: "0.8rem",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              fontWeight: 700,
              letterSpacing: "0.5px",
              marginBottom: "12px"
            }}>💻 Host CPU Thread Pool</h4>
                <div style={{
              fontSize: "2rem",
              fontWeight: 700
            }}>{cpuUsage}%</div>
                <div style={{
              marginTop: "12px"
            }}>
                  <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                marginBottom: "4px"
              }}>
                    <span>Tokio Concurrency Load</span>
                    <span>Watchdog Active</span>
                  </div>
                  <div style={{
                height: "6px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "3px",
                overflow: "hidden"
              }}>
                    <div style={{
                  height: "100%",
                  background: "var(--accent-primary)",
                  width: `${cpuUsage}%`,
                  transition: "width 0.5s ease"
                }} />
                  </div>
                </div>
                <div style={{
              marginTop: "12px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              paddingTop: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "0.75rem"
            }}>
                  <div style={{
                display: "flex",
                justifyContent: "space-between"
              }}>
                    <span style={{
                  color: "var(--text-muted)"
                }}>Watchdog Loop:</span>
                    <span>5000ms Sleep</span>
                  </div>
                  <div style={{
                display: "flex",
                justifyContent: "space-between"
              }}>
                    <span style={{
                  color: "var(--text-muted)"
                }}>Active Threads:</span>
                    <span>4 Async Pools</span>
                  </div>
                </div>
              </div>

              {/* Telemetry Card 3 */}
              <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid var(--border-color)",
            borderRadius: "14px",
            padding: "20px"
          }}>
                <h4 style={{
              fontSize: "0.8rem",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              fontWeight: 700,
              letterSpacing: "0.5px",
              marginBottom: "12px"
            }}>💾 OS Memory Allocations</h4>
                <div style={{
              fontSize: "2rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "baseline",
              gap: "6px"
            }}>
                  {ramUsage} <span style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                fontWeight: 500
              }}>GB</span>
                </div>
                <div style={{
              marginTop: "12px"
            }}>
                  <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                marginBottom: "4px"
              }}>
                    <span>RAM Allocated (OS + Model)</span>
                    <span>{(ramUsage / 16.0 * 100).toFixed(1)}%</span>
                  </div>
                  <div style={{
                height: "6px",
                background: "rgba(255,255,255,0.05)",
                borderRadius: "3px",
                overflow: "hidden"
              }}>
                    <div style={{
                  height: "100%",
                  background: "var(--accent-secondary)",
                  width: `${ramUsage / 16.0 * 100}%`,
                  transition: "width 0.5s ease"
                }} />
                  </div>
                </div>
                <div style={{
              marginTop: "12px",
              borderTop: "1px solid rgba(255,255,255,0.04)",
              paddingTop: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "0.75rem"
            }}>
                  <div style={{
                display: "flex",
                justifyContent: "space-between"
              }}>
                    <span style={{
                  color: "var(--text-muted)"
                }}>Total System RAM:</span>
                    <span>16.00 GB</span>
                  </div>
                  <div style={{
                display: "flex",
                justifyContent: "space-between"
              }}>
                    <span style={{
                  color: "var(--text-muted)"
                }}>Swap Memory:</span>
                    <span>0.00 GB</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Model Failover/Priority Sequences */}
            <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--border-color)",
          borderRadius: "14px",
          padding: "20px"
        }}>
              <h3 style={{
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "var(--accent-primary)",
            marginBottom: "6px"
          }}>🤖 Dynamic Model Failover Sequence</h3>
              <p style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            marginBottom: "16px",
            lineHeight: 1.4
          }}>If a model provider fails (e.g. cloud rate limits or daemon swap latency), Cameleer will autonomously cascade tasks down the priority chain:</p>
              <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px"
          }}>
                {modelPriority.map((model, idx) => <div key={idx} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderRadius: "10px",
              background: idx === 0 ? "rgba(0,242,254,0.05)" : "rgba(255,255,255,0.01)",
              border: idx === 0 ? "1px solid rgba(0,242,254,0.25)" : "1px solid var(--border-color)"
            }}>
                    <div style={{
                display: "flex",
                alignItems: "center",
                gap: "12px"
              }}>
                      <span style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  color: idx === 0 ? "var(--accent-primary)" : "var(--text-muted)"
                }}>#{idx + 1}</span>
                      <div>
                        <div style={{
                    fontSize: "0.85rem",
                    fontWeight: 600
                  }}>{model}</div>
                        <div style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    marginTop: "1px"
                  }}>
                          {idx === 0 ? "ACTIVE PRIMARY - Camelid GGUF GPU" : idx === 1 ? "STANDBY LOCAL GGUF" : "CLOUD API FAILOVER"}
                        </div>
                      </div>
                    </div>
                    <div style={{
                display: "flex",
                gap: "6px"
              }}>
                      {idx > 0 && <button onClick={() => {
                  const newP = [...modelPriority];
                  const temp = newP[idx];
                  newP[idx] = newP[idx - 1];
                  newP[idx - 1] = temp;
                  setModelPriority(newP);
                }} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "none",
                  color: "#fff",
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.7rem"
                }}>
                          ▲
                        </button>}
                      {idx < modelPriority.length - 1 && <button onClick={() => {
                  const newP = [...modelPriority];
                  const temp = newP[idx];
                  newP[idx] = newP[idx + 1];
                  newP[idx + 1] = temp;
                  setModelPriority(newP);
                }} style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "none",
                  color: "#fff",
                  width: "24px",
                  height: "24px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  fontSize: "0.7rem"
                }}>
                          ▼
                        </button>}
                    </div>
                  </div>)}
            </div>
          </div>

            {/* Backend Runtime Supervisor Control & Telemetry Panel */}
            <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--border-color)",
          borderRadius: "14px",
          padding: "20px",
          marginTop: "16px"
        }}>
              <h3 style={{
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "var(--accent-primary)",
            marginBottom: "6px"
          }}>🔌 Backend Runtime Supervisor</h3>
              <p style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            marginBottom: "16px",
            lineHeight: 1.4
          }}>
                Monitor status and modify supervisor policies for the local GGUF inference engine daemon (Camelid Runtime). Single source of truth.
              </p>

              {/* Status details sub-card */}
              <div style={{
            background: "rgba(0,0,0,0.15)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            padding: "16px",
            marginBottom: "16px"
          }}>
                <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "16px",
              fontSize: "0.8rem"
            }}>
                  <div>
                    <span style={{
                  color: "var(--text-muted)",
                  display: "block",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  marginBottom: "2px"
                }}>SUPERVISED STATUS</span>
                    <span style={{
                  fontWeight: 700,
                  color: backendStatus?.state === "ready" ? "var(--color-working)" : ["starting", "restarting"].includes(backendStatus?.state || "") ? "var(--color-blocked)" : "#ef4444",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}>
                      <span style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: backendStatus?.state === "ready" ? "var(--color-working)" : ["starting", "restarting"].includes(backendStatus?.state || "") ? "var(--color-blocked)" : "#ef4444",
                    boxShadow: `0 0 8px ${backendStatus?.state === "ready" ? "var(--color-working)" : ["starting", "restarting"].includes(backendStatus?.state || "") ? "var(--color-blocked)" : "#ef4444"}`
                  }} />
                      {backendStatus?.state ? backendStatus.state.toUpperCase() : "UNKNOWN"}
                    </span>
                  </div>
                  <div>
                    <span style={{
                  color: "var(--text-muted)",
                  display: "block",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  marginBottom: "2px"
                }}>PROCESS ID (PID)</span>
                    <span style={{
                  fontWeight: 600
                }}>{backendStatus?.pid || "None"}</span>
                  </div>
                  <div>
                    <span style={{
                  color: "var(--text-muted)",
                  display: "block",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  marginBottom: "2px"
                }}>ACTIVE PORT / BIND</span>
                    <span style={{
                  fontWeight: 600
                }}>{backendStatus?.bind_address || "127.0.0.1"}:{backendStatus?.port || 8181}</span>
                  </div>
                  <div>
                    <span style={{
                  color: "var(--text-muted)",
                  display: "block",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  marginBottom: "2px"
                }}>ENGINE VERSION</span>
                    <span style={{
                  fontWeight: 600
                }}>{backendStatus?.version || "N/A"}</span>
                  </div>
                  <div>
                    <span style={{
                  color: "var(--text-muted)",
                  display: "block",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  marginBottom: "2px"
                }}>ACTIVE MODEL</span>
                    <span style={{
                  fontWeight: 600,
                  color: "var(--accent-primary)"
                }}>{backendStatus?.active_model || "None"}</span>
                  </div>
                  <div>
                    <span style={{
                  color: "var(--text-muted)",
                  display: "block",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  marginBottom: "2px"
                }}>MODEL LOADED</span>
                    <span style={{
                  fontWeight: 600,
                  color: backendStatus?.model_loaded ? "var(--color-working)" : "var(--text-muted)"
                }}>
                      {backendStatus?.model_loaded ? "YES" : "NO"}
                    </span>
                  </div>
                  <div>
                    <span style={{
                  color: "var(--text-muted)",
                  display: "block",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  marginBottom: "2px"
                }}>RESTART ATTEMPTS</span>
                    <span style={{
                  fontWeight: 600,
                  color: (backendStatus?.restart_count || 0) > 0 ? "var(--color-blocked)" : "var(--text-main)"
                }}>
                      {backendStatus?.restart_count || 0} / 5
                    </span>
                  </div>
                  <div>
                    <span style={{
                  color: "var(--text-muted)",
                  display: "block",
                  fontSize: "0.7rem",
                  textTransform: "uppercase",
                  marginBottom: "2px"
                }}>LAST HEALTH CHECK</span>
                    <span style={{
                  fontWeight: 600,
                  fontSize: "0.75rem"
                }}>
                      {backendStatus?.last_health_check_at ? new Date(parseInt(backendStatus.last_health_check_at) * 1000).toLocaleTimeString() : "Never"}
                    </span>
                  </div>
                </div>
                
                {backendStatus?.last_error && <div style={{
              marginTop: "12px",
              padding: "10px",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.2)",
              borderRadius: "6px",
              fontSize: "0.75rem",
              color: "#f87171"
            }}>
                    <span style={{
                fontWeight: 700
              }}>Last Error:</span> {backendStatus.last_error}
                  </div>}
                
                <div style={{
              marginTop: "12px",
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              borderTop: "1px solid rgba(255,255,255,0.05)",
              paddingTop: "8px"
            }}>
                  <span style={{
                fontWeight: 600
              }}>Log File Location:</span> <code style={{
                color: "var(--accent-secondary)",
                fontFamily: "var(--font-mono)"
              }}>{backendStatus?.log_path || "~/.cameleer/camelid.log"}</code>
                </div>
              </div>

              {/* Log stream view inside settings */}
              <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            textAlign: "left",
            marginBottom: "16px"
          }}>
                <span style={{
              fontSize: "0.75rem",
              textTransform: "uppercase",
              color: "var(--text-muted)",
              fontWeight: 700,
              letterSpacing: "0.5px"
            }}>Live Log Console Stream</span>
                <pre style={{
              background: "rgba(0,0,0,0.4)",
              border: "1px solid var(--border-color)",
              borderRadius: "10px",
              padding: "12px",
              fontSize: "0.75rem",
              color: "#34d399",
              fontFamily: "var(--font-mono)",
              maxHeight: "130px",
              overflowY: "auto",
              whiteSpace: "pre-wrap",
              margin: 0,
              lineHeight: 1.4
            }}>
                  {backendLogs || "No logs streams piped yet."}
                </pre>
              </div>

              {/* Action Buttons Row */}
              <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "20px",
            borderBottom: "1px solid rgba(255,255,255,0.05)",
            paddingBottom: "16px"
          }}>
                <button onClick={handleCheckBackendHealth} className="action-btn">
                  🔄 Check Status
                </button>
                <button onClick={handleRestartBackend} className="action-btn" style={{
              background: "rgba(16, 185, 129, 0.1)",
              borderColor: "rgba(16, 185, 129, 0.25)",
              color: "#10b981"
            }}>
                  🚀 Restart Backend
                </button>
                <button onClick={handleStopBackend} className="action-btn danger-btn">
                  🛑 Stop Backend
                </button>
                <button onClick={handleOpenBackendLogs} className="action-btn">
                  📂 Open Logs
                </button>
                <button onClick={async () => {
              try {
                await api.revealBackendBinary();
              } catch (e) {
                window.toast("Failed to reveal binary: " + e);
              }
            }} className="action-btn">
                  🔍 Reveal Backend Binary
                </button>
                <button onClick={async () => {
              try {
                const res: any = await api.verifyPackagedRuntime();
                alert(`RUNTIME VERIFICATION\n\nFound: ${res.found}\nPath: ${res.resolved_path}\nExecutable: ${res.executable}\nVersion: ${res.version_output || "Unknown"}\n\nSearched: \n${res.searched_paths.join("\n")}\n\nError: ${res.error_message || "None"}`);
              } catch (e) {
                alert("Error verifying runtime: " + e);
              }
            }} className="action-btn">
                  🧪 Run System Diagnostics
                </button>
                <button onClick={handleResetBackendRuntime} className="action-btn danger-btn" style={{
              marginLeft: "auto"
            }}>
                  ⚠️ Reset Runtime State
                </button>
              </div>

              {/* Configuration Fields Grid */}
              <h4 style={{
            fontSize: "0.85rem",
            fontWeight: 700,
            color: "var(--text-main)",
            marginBottom: "12px"
          }}>⚙️ Supervisor Policies</h4>
              <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px",
            marginBottom: "16px"
          }}>
                <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              justifyContent: "center"
            }}>
                  <label style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.82rem",
                cursor: "pointer",
                userSelect: "none"
              }}>
                    <input type="checkbox" checked={formAutoStart} onChange={e => setFormAutoStart(e.target.checked)} style={{
                  cursor: "pointer"
                }} />
                    Auto-start backend on app launch
                  </label>
                  <label style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.82rem",
                cursor: "pointer",
                userSelect: "none"
              }}>
                    <input type="checkbox" checked={formAutoRestart} onChange={e => setFormAutoRestart(e.target.checked)} style={{
                  cursor: "pointer"
                }} />
                    Auto-restart backend if it crashes
                  </label>
                  <label style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "0.82rem",
                cursor: "pointer",
                userSelect: "none"
              }}>
                    <input type="checkbox" checked={formStopOnExit} onChange={e => setFormStopOnExit(e.target.checked)} style={{
                  cursor: "pointer"
                }} />
                    Stop backend when Cameleer closes
                  </label>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Backend Port</label>
                  <input type="number" className="form-input" value={formPort} onChange={e => setFormPort(parseInt(e.target.value) || 8181)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Bind Address</label>
                  <input type="text" className="form-input" value={formBindAddress} onChange={e => setFormBindAddress(e.target.value)} placeholder="127.0.0.1" />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Crash Restarts (2 min window)</label>
                  <input type="number" className="form-input" value={formMaxRestarts} onChange={e => setFormMaxRestarts(parseInt(e.target.value) || 5)} />
                </div>

                <div className="form-group">
                  <label className="form-label">Restart Backoff Policy</label>
                  <select className="form-input" value={formBackoffPolicy} onChange={e => setFormBackoffPolicy(e.target.value)} style={{
                background: "rgba(0, 0, 0, 0.3)",
                color: "#fff"
              }}>
                    <option value="exponential">Exponential Backoff</option>
                    <option value="linear">Linear Backoff</option>
                  </select>
                </div>
              </div>

              {/* Developer Configuration / Advanced Section */}
              <div className="form-group" style={{
            gridColumn: "span 2",
            padding: "12px",
            background: "rgba(0,0,0,0.2)",
            borderRadius: "8px",
            border: "1px solid var(--border-color)",
            marginBottom: "16px"
          }}>
                <label className="form-label">Allowed Tools Sandbox</label>
                <p style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginBottom: "8px"
            }}>Select the tools this agent is permitted to execute autonomously.</p>
                <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px"
            }}>
                  {["task.create", "task.update", "task.move", "task.comment", "memory.search", "memory.write", "agent.handoff", "project.read", "project.update", "repo.search", "repo.read_file", "repo.propose_patch"].map(tool => <label key={tool} className="checkbox-label" style={{
                fontSize: "0.8rem"
              }}>
                      <input type="checkbox" checked={editAllowedTools.includes(tool)} onChange={e => {
                  if (e.target.checked) setEditAllowedTools([...editAllowedTools, tool]);else setEditAllowedTools(editAllowedTools.filter(t => t !== tool));
                }} /> {tool}
                    </label>)}
                </div>
              </div>
              <details style={{
            background: "rgba(255,255,255,0.01)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "16px"
          }}>
                <summary style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              cursor: "pointer",
              userSelect: "none"
            }}>
                  🛠️ Developer / Advanced Options (Overhead overrides)
                </summary>
                <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: "16px",
              marginTop: "12px"
            }}>
                  <div className="form-group" style={{
                margin: 0
              }}>
                    <label className="form-label">Backend Binary Path (Leave empty for default bundled)</label>
                    <input type="text" className="form-input" value={formBinaryPath} onChange={e => setFormBinaryPath(e.target.value)} placeholder="e.g. /usr/local/bin/camelid" />
                  </div>
                  <div className="form-group" style={{
                margin: 0
              }}>
                    <label className="form-label">Custom Log Path (Leave empty for default ~/.cameleer/camelid.log)</label>
                    <input type="text" className="form-input" value={formLogPath} onChange={e => setFormLogPath(e.target.value)} placeholder="e.g. /var/log/camelid.log" />
                  </div>
                </div>
              </details>

              <div style={{
            display: "flex",
            justifyContent: "flex-end"
          }}>
                <button className="sidebar-btn" style={{
              margin: 0,
              padding: "10px 24px"
            }} onClick={handleSaveBackendConfig}>
                  Save Supervisor Config
                </button>
              </div>
            </div>

            {/* OS Gateway & Camelid Configurations */}
            <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid var(--border-color)",
          borderRadius: "14px",
          padding: "20px",
          marginTop: "16px"
        }}>
              <h3 style={{
            fontSize: "0.95rem",
            fontWeight: 700,
            color: "var(--accent-primary)",
            marginBottom: "6px"
          }}>⚙️ OS Gateway & Camelid Runtime Configurations</h3>
              <p style={{
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            marginBottom: "16px",
            lineHeight: 1.4
          }}>Configure active connection gateways, local GGUF Metal endpoints, and cloud keys to power your local agent crew.</p>
              
              <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px"
          }}>
                <div className="form-group">
                  <label className="form-label">Global Goal Blackboard</label>
                  <input className="form-input" value={blackboardInput} onChange={e => setBlackboardInput(e.target.value)} placeholder="e.g. Save hello.rs to my Desktop" />
                </div>
                <div className="form-group">
                  <label className="form-label">Camelid GGUF Endpoint</label>
                  <input className="form-input" value={camelidUrl} onChange={e => setCamelidUrl(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Ollama API URL</label>
                  <input className="form-input" value={ollamaUrl} onChange={e => setOllamaUrl(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">OpenAI Key (Cloud)</label>
                  <input type="password" className="form-input" value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} placeholder="sk-..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Anthropic Key (Cloud)</label>
                  <input type="password" className="form-input" value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} placeholder="sk-ant-..." />
                </div>
              </div>
              
              <div style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "16px"
          }}>
                <button className="sidebar-btn" style={{
              margin: 0,
              padding: "10px 24px"
            }} onClick={handleSaveSettings}>
                  Save OS Settings
                </button>
              </div>
            </div>

          </div>)}
      </main>

      {/* 3. Right Inspector panel */}
      <aside className="inspector-panel" style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflowY: "auto"
    }}>
        {/* Tab Navigation */}
        <div style={{
        display: "flex",
        borderBottom: "1px solid var(--border-color)",
        marginBottom: "16px",
        flexShrink: 0
      }}>
          <button onClick={() => setInspectorTab("snapshot")} style={{
          flex: 1,
          padding: "14px 8px",
          background: "none",
          border: "none",
          color: inspectorTab === "snapshot" ? "var(--accent-primary)" : "var(--text-muted)",
          fontWeight: 700,
          fontSize: "0.82rem",
          borderBottom: inspectorTab === "snapshot" ? "2px solid var(--accent-primary)" : "2px solid transparent",
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}>
            🧠 Project Brain
          </button>
          <button onClick={() => setInspectorTab("profile")} style={{
          flex: 1,
          padding: "14px 8px",
          background: "none",
          border: "none",
          color: inspectorTab === "profile" ? "var(--accent-primary)" : "var(--text-muted)",
          fontWeight: 700,
          fontSize: "0.82rem",
          borderBottom: inspectorTab === "profile" ? "2px solid var(--accent-primary)" : "2px solid transparent",
          cursor: "pointer",
          transition: "all 0.2s ease"
        }}>
            👤 Agent Profile
          </button>
        </div>

        {inspectorTab === "profile" ? (/* Agent Profile Tab */
      <section className="inspector-section" style={{
        flex: 1
      }}>
            <div className="inspector-section-title">Agent Profile</div>
            {agents.find(a => a.id === selectedAgentId) ? (() => {
          const currentAgent = agents.find(a => a.id === selectedAgentId)!;
          return <div className="inspector-details">
                    <div>
                      <div className="inspector-label">Name</div>
                      <div className="inspector-value">{currentAgent.name}</div>
                    </div>
                    <div>
                      <div className="inspector-label">Primary Role</div>
                      <div className="inspector-value">{currentAgent.role}</div>
                    </div>
                    <div>
                      <div className="inspector-label">LLM Provider</div>
                      <div className="inspector-value">
                        {currentAgent.model_provider} ({currentAgent.model_name})
                      </div>
                    </div>
                    <div>
                      <div className="inspector-label">Status</div>
                      <div className="inspector-value" style={{
                textTransform: "capitalize"
              }}>
                        {currentAgent.status}
                      </div>
                    </div>
                    <button className="action-btn danger-btn" style={{
              marginTop: "10px"
            }} onClick={() => handleDeleteAgent(currentAgent.id)}>
                      Retire Agent
                    </button>
                  </div>;
        })() : <div style={{
          fontSize: "0.85rem",
          color: "var(--text-muted)"
        }}>
                No agent selected. Click on an agent in the sidebar to inspect.
              </div>}
          </section>) : (/* Project Brain Snapshot Tab */
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      }}>
            
            {/* Active Workspace Banner */}
            <section className="inspector-section" style={{
          marginBottom: 0
        }}>
              <div className="inspector-section-title" style={{
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}>
                <span>📁 Active Workspace</span>
                <span className="live-telemetry-status" style={{
              display: "inline-block",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "#10b981",
              animation: "pulse 1.5s infinite"
            }} />
              </div>
              {(() => {
            const activeWs = coordinationDetails.workspaces.find(w => w.active === 1) || {
              name: "Default Workspace",
              path: "~/Desktop"
            };
            return <div style={{
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-color)",
              borderRadius: "10px",
              padding: "12px"
            }}>
                    <div style={{
                fontSize: "0.88rem",
                fontWeight: 700,
                color: "var(--text-main)"
              }}>{activeWs.name}</div>
                    <div style={{
                fontSize: "0.74rem",
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                marginTop: "4px",
                wordBreak: "break-all"
              }}>{activeWs.path}</div>
                  </div>;
          })()}
            </section>

            {/* Crew statuses */}
            <section className="inspector-section" style={{
          marginBottom: 0
        }}>
              <div className="inspector-section-title">Crew Statuses</div>
              <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "180px",
            overflowY: "auto"
          }}>
                {agents.map(a => <div key={a.id} style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 12px",
              background: "rgba(255, 255, 255, 0.01)",
              border: "1px solid rgba(255, 255, 255, 0.04)",
              borderRadius: "8px"
            }}>
                    <div>
                      <div style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "var(--text-main)"
                }}>{a.name}</div>
                      <div style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)"
                }}>{a.role}</div>
                    </div>
                    <span style={{
                fontSize: "0.68rem",
                fontWeight: 700,
                textTransform: "capitalize",
                padding: "3px 8px",
                borderRadius: "5px",
                background: a.status === "working" ? "rgba(0, 242, 254, 0.08)" : a.status === "error" ? "rgba(239, 68, 68, 0.08)" : "rgba(255,255,255,0.03)",
                color: a.status === "working" ? "var(--accent-primary)" : a.status === "error" ? "#f87171" : "var(--text-muted)",
                border: a.status === "working" ? "1px solid rgba(0, 242, 254, 0.2)" : a.status === "error" ? "1px solid rgba(239, 68, 68, 0.2)" : "1px solid rgba(255,255,255,0.05)"
              }}>
                      {a.status}
                    </span>
                  </div>)}
              </div>
            </section>

            {/* Dynamic Handoffs gateway */}
            <section className="inspector-section" style={{
          marginBottom: 0
        }}>
              <div className="inspector-section-title">Handoffs Gateway</div>
              <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "200px",
            overflowY: "auto"
          }}>
                {coordinationDetails.handoffs.length === 0 ? <div style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textAlign: "center",
              padding: "12px",
              border: "1px dashed var(--border-color)",
              borderRadius: "8px"
            }}>
                    No coordination handoffs registered.
                  </div> : coordinationDetails.handoffs.map(ho => <div key={ho.id} style={{
              padding: "10px",
              background: "rgba(255, 255, 255, 0.02)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}>
                      <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.7rem",
                fontWeight: 700
              }}>
                        <span style={{
                  color: "var(--accent-primary)"
                }}>{ho.source_agent_id} ➔ {ho.target_agent_id}</span>
                        <span style={{
                  color: ho.status === "completed" ? "#10b981" : ho.status === "accepted" ? "var(--accent-secondary)" : "#f59e0b",
                  background: ho.status === "completed" ? "rgba(16, 185, 129, 0.08)" : ho.status === "accepted" ? "rgba(79, 172, 254, 0.08)" : "rgba(245, 158, 11, 0.08)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  textTransform: "uppercase",
                  fontSize: "0.6rem"
                }}>{ho.status}</span>
                      </div>
                      <div style={{
                fontSize: "0.76rem",
                color: "var(--text-main)",
                lineHeight: 1.3
              }}>{ho.reason}</div>
                      
                      {/* Action buttons based on status */}
                      {ho.status === "pending" && <div style={{
                display: "flex",
                gap: "6px",
                marginTop: "4px"
              }}>
                          <button onClick={() => handleResolveHandoff(ho.id!, "accepted")} style={{
                  flex: 1,
                  padding: "4px 8px",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.3)",
                  color: "#10b981",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}>
                            Accept
                          </button>
                          <button onClick={() => handleResolveHandoff(ho.id!, "rejected")} style={{
                  flex: 1,
                  padding: "4px 8px",
                  fontSize: "0.68rem",
                  fontWeight: 700,
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#f87171",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}>
                            Reject
                          </button>
                        </div>}

                      {ho.status === "accepted" && <button onClick={() => handleResolveHandoff(ho.id!, "completed")} style={{
                width: "100%",
                padding: "4px 8px",
                fontSize: "0.68rem",
                fontWeight: 700,
                background: "rgba(79, 172, 254, 0.15)",
                border: "1px solid rgba(79, 172, 254, 0.3)",
                color: "#fff",
                borderRadius: "4px",
                cursor: "pointer",
                marginTop: "4px"
              }}>
                          Complete Tasks
                        </button>}
                    </div>)}
              </div>
            </section>

            {/* Decisions list & Inline logger */}
            <section className="inspector-section" style={{
          marginBottom: 0
        }}>
              <div className="inspector-section-title">Engineering Decisions</div>
              
              {/* Manual Input Logger */}
              <div style={{
            display: "flex",
            gap: "6px",
            marginBottom: "10px"
          }}>
                <input className="form-input" style={{
              height: "32px",
              fontSize: "0.78rem",
              padding: "0 8px",
              margin: 0
            }} placeholder="Record dynamic decision..." value={newDecisionText} onChange={e => setNewDecisionText(e.target.value)} onKeyDown={async e => {
              if (e.key === "Enter") {
                if (!newDecisionText.trim()) return;
                try {
                  const activeWs = coordinationDetails.workspaces.find(w => w.active === 1) || {
                    id: "default"
                  };
                  await api.recordDecisionCmd({
                    workspaceId: activeWs.id,
                    decision: newDecisionText,
                    decidedBy: "User"
                  });
                  setNewDecisionText("");
                  loadCoordinationDetails();
                } catch (err) {
                  window.toast("Failed to record decision: " + err);
                }
              }
            }} />
                <button style={{
              padding: "0 10px",
              background: "rgba(0, 242, 254, 0.1)",
              border: "1px solid rgba(0, 242, 254, 0.3)",
              color: "#fff",
              borderRadius: "6px",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: "pointer"
            }} onClick={async () => {
              if (!newDecisionText.trim()) return;
              try {
                const activeWs = coordinationDetails.workspaces.find(w => w.active === 1) || {
                  id: "default"
                };
                await api.recordDecisionCmd({
                  workspaceId: activeWs.id,
                  decision: newDecisionText,
                  decidedBy: "User"
                });
                setNewDecisionText("");
                loadCoordinationDetails();
              } catch (err) {
                window.toast("Failed to record decision: " + err);
              }
            }}>
                  Record
                </button>
              </div>

              <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "160px",
            overflowY: "auto"
          }}>
                {coordinationDetails.decisions.length === 0 ? <div style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              textAlign: "center",
              padding: "12px",
              border: "1px dashed var(--border-color)",
              borderRadius: "8px"
            }}>
                    No decisions recorded yet.
                  </div> : coordinationDetails.decisions.map(dec => <div key={dec.id} style={{
              padding: "8px",
              background: "rgba(255, 255, 255, 0.01)",
              border: "1px solid rgba(255,255,255,0.03)",
              borderRadius: "6px"
            }}>
                      <div style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "0.64rem",
                color: "var(--text-muted)",
                marginBottom: "4px"
              }}>
                        <span>👤 Decided by: {dec.decided_by || "System"}</span>
                        <span>{dec.timestamp}</span>
                      </div>
                      <div style={{
                fontSize: "0.75rem",
                color: "var(--text-main)",
                lineHeight: 1.3
              }}>{dec.decision}</div>
                    </div>)}
              </div>
            </section>

            {/* Shared Awareness Terminal */}
            <section className="inspector-section">
              <div className="inspector-section-title">Shared Awareness Terminal</div>
              <div style={{
            maxHeight: "180px",
            overflowY: "auto",
            fontSize: "0.74rem",
            background: "rgba(0,0,0,0.35)",
            border: "1px solid rgba(255,255,255,0.05)",
            padding: "10px",
            borderRadius: "8px",
            whiteSpace: "pre-wrap",
            fontFamily: "var(--font-mono)",
            color: "#00f2fe",
            lineHeight: 1.4
          }}>
                {blackboardText}
              </div>
            </section>

          </div>)}
      </aside>

      {/* 4. Spawn Custom Agent Modal */}
      {isSpawnModalOpen && <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleSpawnAgent}>
            <div className="modal-title">🤖 Spawn Custom Agent Persona</div>
            
            <div className="form-group">
              <label className="form-label">Agent Name</label>
              <input className="form-input" required value={spawnName} onChange={e => setSpawnName(e.target.value)} placeholder="e.g. Sentry Analyst" />
            </div>

            <div className="form-group">
              <label className="form-label">Agent Role</label>
              <input className="form-input" required value={spawnRole} onChange={e => setSpawnRole(e.target.value)} placeholder="e.g. Quality Assurance Sentry" />
            </div>

            <div className="form-group">
              <label className="form-label">System Persona Description</label>
              <textarea className="form-input form-textarea" required value={spawnPersona} onChange={e => setSpawnPersona(e.target.value)} placeholder="Detailed behavioral persona rules..." />
            </div>

            <div className="form-group">
              <label className="form-label">Inference Provider</label>
              <select className="form-input" value={spawnProvider} onChange={e => {
            setSpawnProvider(e.target.value);
            if (e.target.value === "camelid") setSpawnModel("camelid-default");else if (e.target.value === "ollama") setSpawnModel("qwen2.5-coder");else if (e.target.value === "openai") setSpawnModel("gpt-4o");else if (e.target.value === "anthropic") setSpawnModel("claude-3-5-sonnet");
          }} style={{
            background: "#0a0d14",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#fff"
          }}>
                <option value="camelid">Local Camelid GGUF</option>
                <option value="ollama">Ollama Local API</option>
                <option value="openai">OpenAI Cloud API</option>
                <option value="anthropic">Anthropic Claude API</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Model Name</label>
              {(() => {
            const camelidOptions = ["camelid-default", "tinyllama-1.1b-chat-v1.0.Q8_0.gguf", "Llama-3.2-1B-Instruct-Q8_0.gguf", "Llama-3.2-3B-Instruct-Q8_0.gguf", "Meta-Llama-3-8B-Instruct-Q8_0.gguf", "Mistral-7B-Instruct-v0.3.Q8_0.gguf", ...localModels];
            const uniqueCamelid = Array.from(new Set(camelidOptions));
            const ollamaOptions = ["qwen2.5-coder", "llama3.2", "llama3", "mistral", "deepseek-r1"];
            const openaiOptions = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-mini", "o1-preview"];
            const anthropicOptions = ["claude-3-5-sonnet", "claude-3-5-haiku", "claude-3-opus"];
            let opts: string[] = [];
            let defaultVal = "";
            if (spawnProvider === "camelid") {
              opts = uniqueCamelid;
              defaultVal = "camelid-default";
            } else if (spawnProvider === "ollama") {
              opts = ollamaOptions;
              defaultVal = "qwen2.5-coder";
            } else if (spawnProvider === "openai") {
              opts = openaiOptions;
              defaultVal = "gpt-4o";
            } else if (spawnProvider === "anthropic") {
              opts = anthropicOptions;
              defaultVal = "claude-3-5-sonnet";
            }
            const isCustom = spawnModel !== "" && !opts.includes(spawnModel);
            const selectValue = isCustom ? "__custom__" : spawnModel || defaultVal;
            return <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
                    <select className="form-input" value={selectValue} onChange={e => {
                if (e.target.value === "__custom__") {
                  setSpawnModel("");
                } else {
                  setSpawnModel(e.target.value);
                }
              }} style={{
                background: "#0a0d14",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#fff",
                height: "42px"
              }}>
                      {opts.map(opt => <option key={opt} value={opt}>
                          {opt === "camelid-default" ? "camelid-default (System Active GGUF)" : opt}
                        </option>)}
                      {spawnProvider !== "camelid" && <option value="__custom__">✦ Custom Model Tag...</option>}
                    </select>
                    {(isCustom || selectValue === "__custom__") && <input className="form-input" required value={spawnModel} onChange={e => setSpawnModel(e.target.value)} placeholder="Type custom tag, e.g. llama3.2:1b" style={{
                marginTop: "4px"
              }} />}
                  </div>;
          })()}
            </div>

            <div className="form-group" style={{
          flexDirection: "row",
          alignItems: "center",
          gap: "8px",
          marginTop: "4px"
        }}>
              <input type="checkbox" id="continuous-run" checked={spawnContinuous} onChange={e => setSpawnContinuous(e.target.checked)} style={{
            width: "16px",
            height: "16px",
            cursor: "pointer"
          }} />
              <label htmlFor="continuous-run" className="form-label" style={{
            cursor: "pointer",
            userSelect: "none",
            margin: 0
          }}>
                Continuous Autonomous Loop Execution
              </label>
            </div>

            <div className="form-group">
              <label className="form-label" style={{
            display: 'flex',
            justifyContent: 'space-between'
          }}>
                Parent Agent (Nesting)
                <span style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)'
            }}>(Optional)</span>
              </label>
              <select className="form-input" value={spawnParentAgentId} onChange={e => setSpawnParentAgentId(e.target.value)}>
                <option value="">-- No Parent (Root Level) --</option>
                {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
              </select>
              <p style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginTop: "4px"
          }}>
                Agent will inherit rules and report to this parent agent.
              </p>
            </div>

            <div className="form-group" style={{
          padding: "12px",
          background: "rgba(0,0,0,0.2)",
          borderRadius: "8px",
          border: "1px solid var(--border-color)"
        }}>
              <label className="form-label">Allowed Tools Sandbox</label>
              <p style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginBottom: "8px"
          }}>Select the tools this agent is permitted to execute autonomously.</p>
              <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px"
          }}>
                {["task.create", "task.update", "task.move", "task.comment", "memory.search", "memory.write", "agent.handoff", "project.read", "project.update", "repo.search", "repo.read_file", "repo.propose_patch"].map(tool => <label key={tool} className="checkbox-label" style={{
              fontSize: "0.8rem"
            }}>
                    <input type="checkbox" checked={spawnAllowedTools.includes(tool)} onChange={e => {
                if (e.target.checked) setSpawnAllowedTools([...spawnAllowedTools, tool]);else setSpawnAllowedTools(spawnAllowedTools.filter(t => t !== tool));
              }} /> {tool}
                  </label>)}
              </div>
            </div>

            <div style={{
          display: "flex",
          gap: "16px"
        }}>
              <div className="form-group" style={{
            flex: 1
          }}>
                <label className="form-label">Temperature ({spawnTemp})</label>
                <input type="range" min="0.1" max="1.5" step="0.1" value={spawnTemp} onChange={e => setSpawnTemp(parseFloat(e.target.value))} />
              </div>

              <div className="form-group" style={{
            flex: 1
          }}>
                <label className="form-label">Max Tokens</label>
                <input type="number" className="form-input" value={spawnMaxTokens} onChange={e => setSpawnMaxTokens(parseInt(e.target.value))} />
              </div>
            </div>

            <div className="modal-buttons">
              <button type="button" className="action-btn" onClick={() => setIsSpawnModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="sidebar-btn" style={{
            margin: 0
          }}>
                Launch Agent
              </button>
            </div>
          </form>
        </div>}

      {/* 5. Create Task Modal */}
      {isTaskModalOpen && <div className="modal-overlay">
          <form className="modal-content" style={{
        width: "560px"
      }} onSubmit={handleCreateTask}>
            <div className="modal-title">➕ Create Kanban Objective</div>
            
            <div className="form-group">
              <label className="form-label">Task Title</label>
              <input className="form-input" required value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="e.g. Implement safety validation in parser" />
            </div>

            <div className="form-group">
              <label className="form-label">Task Description</label>
              <textarea className="form-input form-textarea" value={taskDesc} onChange={e => setTaskDesc(e.target.value)} placeholder="Add technical requirements, goals, or context..." style={{
            height: "70px"
          }} />
            </div>

            <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px"
        }}>
              <div className="form-group">
                <label className="form-label">Assignee Owner</label>
                <select className="form-input" value={taskOwner} onChange={e => setTaskOwner(e.target.value)} style={{
              background: "#0a0d14",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff",
              height: "40px"
            }}>
                  <option value="">unassigned</option>
                  {agents.map(a => <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Objective Priority</label>
                <select className="form-input" value={taskPriority} onChange={e => setTaskPriority(e.target.value)} style={{
              background: "#0a0d14",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#fff",
              height: "40px"
            }}>
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
              </div>
            </div>

            {/* Smart Agent Recommendation Banner */}
            {(() => {
          const rec = recommendAgentForTask(taskTitle, taskDesc);
          if (rec) {
            return <div style={{
              background: "rgba(0, 242, 254, 0.05)",
              border: "1px solid rgba(0, 242, 254, 0.2)",
              borderRadius: "8px",
              padding: "8px 12px",
              fontSize: "0.76rem",
              color: "var(--accent-primary)",
              marginBottom: "14px",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}>
                    <span>✨</span>
                    <span><strong>Recommendation:</strong> Assign to <strong>{rec.name}</strong> ({rec.role}) based on task keywords.</span>
                  </div>;
          }
          return null;
        })()}

            <div className="form-group">
              <label className="form-label" style={{
            display: "flex",
            justifyContent: "space-between"
          }}>
                <span>📋 Acceptance Criteria (One per line)</span>
                <span style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)"
            }}>Becomes checklist</span>
              </label>
              <textarea className="form-input form-textarea" value={taskAcceptanceCriteria} onChange={e => setTaskAcceptanceCriteria(e.target.value)} placeholder="e.g. Write standard unit test&#10;Verify compilation on local machine" style={{
            height: "60px",
            fontSize: "0.8rem"
          }} />
            </div>

            <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px"
        }}>
              <div className="form-group">
                <label className="form-label" style={{
              display: "flex",
              justifyContent: "space-between"
            }}>
                  <span>📂 Required Files</span>
                  <span style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)"
              }}>Host path checks</span>
                </label>
                <input className="form-input" value={taskRequiredFiles} onChange={e => setTaskRequiredFiles(e.target.value)} placeholder="e.g. ~/Desktop/hello.rs" style={{
              fontSize: "0.8rem"
            }} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{
              display: "flex",
              justifyContent: "space-between"
            }}>
                  <span>⛓️ Dependencies</span>
                  <span style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)"
              }}>Comma-sep task IDs</span>
                </label>
                <input className="form-input" value={taskDependencies} onChange={e => setTaskDependencies(e.target.value)} placeholder="e.g. task-9h8f" style={{
              fontSize: "0.8rem"
            }} />
              </div>
            </div>

            <div className="modal-buttons">
              <button type="button" className="action-btn" onClick={() => setIsTaskModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="sidebar-btn" style={{
            margin: 0
          }}>
                Enqueue Objective
              </button>
            </div>
          </form>
        </div>}

      <CardDrawer card={selectedKanbanTask} agents={agents} onClose={() => {
      setSelectedKanbanTask(null);
      setCompletionError(null);
      setIsCompletingTask(false);
    }} />
    </div>;
}
export default App;