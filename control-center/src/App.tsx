
import { dashboardTab as DashboardTab } from './components/tabs/dashboardTab';
import { kanbanTab as KanbanTab } from './components/tabs/kanbanTab';
import { skillsTab as SkillsTab } from './components/tabs/skillsTab';
import { channelsTab as ChannelsTab } from './components/tabs/channelsTab';
import { filesTab as FilesTab } from './components/tabs/filesTab';
import { missionsTab as MissionsTab } from './components/tabs/missionsTab';
import { agentsTab as AgentsTab } from './components/tabs/agentsTab';
import { modelsTab as ModelsTab } from './components/tabs/modelsTab';
import { systemTab as SystemTab } from './components/tabs/systemTab';

import { api } from "./services/api";
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import AgentChat from "./components/chat/AgentChat";
import BacklogManager from "./components/backlog/BacklogManager";
import KanbanBoard from "./components/board/KanbanBoard";
import CardDrawer from "./components/board/CardDrawer";
import { OrgSidebar } from "./components/org/OrgSidebar";
import { SidebarComponent } from "./components/org/SidebarComponent";
import { ProjectDashboard } from "./components/org/ProjectDashboard";
import { SpawnAgentModal } from "./components/modals/SpawnAgentModal";
import { CreateTaskModal } from "./components/modals/CreateTaskModal";
import { InspectorPanel } from "./components/org/InspectorPanel";
import { 
  AgentOrgNode, 
  Agent, 
  Message, 
  Task, 
  ProviderConfig, 
  Workspace, 
  Decision, 
  Handoff, 
  CoordinationDetails, 
  WorkSuggestion, 
  TemplateInfo, 
  SubtaskProposal, 
  MissionProgress, 
  ModelCatalogEntry, 
  HuggingFaceModelEntry, 
  PreflightResponse, 
  TensorDetails, 
  DownloadDetails, 
  ActivationDetails, 
  InspectionDetails, 
  ModelDetailsResponse, 
  StorageUsageResponse, 
  SmokeTestResult, 
  BackendStatus, 
  BackendRuntimeConfig 
} from "./types";
import RunsView from "./components/runs/RunsView";
import "./styles/tokens.css";
import "./styles/components.css";
import "./App.css";
import { useAppStore } from "./hooks/useAppStore";

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

  return <div className="app-layout">
      {renderBlockingOverlay()}
      {/* 1. Sidebar Column */}
      <SidebarComponent {...state} />

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
                  {agents.find((a: Agent) => a.id === selectedAgentId)?.name || selectedAgentId}
                </h2>
                <div className="chat-subtitle">
                  {agents.find((a: Agent) => a.id === selectedAgentId)?.role || "Agent Profile"}
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
          </div> : activeTab === "kanban" ? /* Kanban System */<KanbanTab {...state} /> : activeTab === "runs" ? <RunsView /> : activeTab === "skills" ? /* Skills Page */<SkillsTab {...state} /> : activeTab === "channels" ? /* Channels Page */<ChannelsTab {...state} /> : activeTab === "files" ? /* Files Page */<FilesTab {...state} /> : activeTab === "missions" ? /* Crew Autonomy & Mission Builder Portal */<MissionsTab {...state} /> : activeTab === "agents" ? /* Crew Control Page */<AgentsTab {...state} /> : activeTab === "models" ? <ModelsTab {...state} /> : <SystemTab {...state} />}
      </main>

      {/* 3. Right Inspector panel */}
      <InspectorPanel {...state} />

       <SpawnAgentModal {...state} />
       <CreateTaskModal {...state} />

      <CardDrawer card={selectedKanbanTask} agents={agents} onClose={() => {
      setSelectedKanbanTask(null);
      setCompletionError(null);
      setIsCompletingTask(false);
    }} />
    </div>;
}
export default App;