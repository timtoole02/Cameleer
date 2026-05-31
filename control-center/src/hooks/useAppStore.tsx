
import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { api } from "../services/api";
import { AgentOrgNode, BacklogItem, KanbanCard, Project, Team, Agent, Message, Task, ProviderConfig, Workspace, Decision, Handoff, CoordinationDetails, WorkSuggestion, TemplateInfo, SubtaskProposal, MissionProgress, ModelCatalogEntry, HuggingFaceModelEntry, PreflightResponse, TensorDetails, DownloadDetails, ActivationDetails, InspectionDetails, ModelDetailsResponse, StorageUsageResponse, SmokeTestResult, BackendStatus, BackendRuntimeConfig } from "../types";

export function useAppStore() {
const [activeTab, setActiveTab] = useState<"dashboard" | "global" | "dm" | "kanban" | "runs" | "skills" | "channels" | "files" | "system" | "agents" | "models" | "missions" | "org_dashboard">("dashboard");
  const [kanbanView, setKanbanView] = useState<"board" | "backlog">("board");
  const [refreshKanban, setRefreshKanban] = useState(0);
  const [suggestions, setSuggestions] = useState<WorkSuggestion[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string>("software_engineer");
  const [wizardCustomName, setWizardCustomName] = useState<string>("Specialist Agent");
  const [decomposingTaskId, setDecomposingTaskId] = useState<string>("");
  const [decomposedProposals, setDecomposedProposals] = useState<SubtaskProposal[]>([]);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [activeModel, setActiveModel] = useState<string | null>(null);
  const [downloadState, setDownloadState] = useState<{
    downloading: boolean;
    model: string;
    progress: number;
    error: string | null;
  }>({
    downloading: false,
    model: "",
    progress: 0,
    error: null,
  });
  // Form editing states for Agents tab
  const [editAgentId, setEditAgentId] = useState<string>("");
  const [editName, setEditName] = useState<string>("");
  const [editRole, setEditRole] = useState<string>("");
  const [editPersona, setEditPersona] = useState<string>("");
  const [editProvider, setEditProvider] = useState<string>("camelid");
  const [editModelName, setEditModelName] = useState<string>("");
  const [editTemp, setEditTemp] = useState<number>(0.7);
  const [editMaxTokens, setEditMaxTokens] = useState<number>(2048);
  const [editSpawnSubtasks, setEditSpawnSubtasks] = useState<boolean>(true);
  const [editTalkGlobally, setEditTalkGlobally] = useState<boolean>(true);
  const [editContinuous, setEditContinuous] = useState<boolean>(false);
  const [editParentAgentId, setEditParentAgentId] = useState<string>("");
  const [editAllowedTools, setEditAllowedTools] = useState<string[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("agent-coder");
  const [activeOrgNode, setActiveOrgNode] = useState<AgentOrgNode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedKanbanTask, setSelectedKanbanTask] = useState<any | null>(null);
  
  // Mission Builder, Contracts, Receipts, and Autopilot React State Hooks
  const [outcomeGoal, setOutcomeGoal] = useState("");
  const [selectedMissionPack, setSelectedMissionPack] = useState("build_small_app");
  const [missionPreview, setMissionPreview] = useState<any | null>(null);
  const [missionPacks, setMissionPacks] = useState<any[]>([]);
  const [customPackName, setCustomPackName] = useState("");
  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [autopilotScope, setAutopilotScope] = useState("off");
  const [approvalRequirements, setApprovalRequirements] = useState("moderate");
  const [networkPermissions, setNetworkPermissions] = useState("none");
  const [doneApprovalRules, setDoneApprovalRules] = useState("reviewer_or_user");
  const [missionAuditEvents, setMissionAuditEvents] = useState<any[]>([]);
  const [activeMissions, setActiveMissions] = useState<MissionProgress[]>([]);
  const [activeContract, setActiveContract] = useState<any | null>(null);
  const [activeReceipt, setActiveReceipt] = useState<any | null>(null);

  // Model Manager React State Hooks
  const [modelsCatalog, setModelsCatalog] = useState<ModelCatalogEntry[]>([]);
  const [selectedModelForInspect, setSelectedModelForInspect] = useState<ModelCatalogEntry | null>(null);
  const [modelDetails, setModelDetails] = useState<ModelDetailsResponse | null>(null);
  const [remoteModels, setRemoteModels] = useState<HuggingFaceModelEntry[]>([]);
  const [modelsSearchQuery, setModelsSearchQuery] = useState("");
  const [modelsFilterQuant, setModelsFilterQuant] = useState("all");
  const [modelsSubTab, setModelsSubTab] = useState<"recommended" | "installed" | "search" | "downloads" | "advanced">("recommended");
  const [importPath, setImportPath] = useState("");
  const [importCopy, setImportCopy] = useState(true);
  const [preflightReport, setPreflightReport] = useState<PreflightResponse | null>(null);
  const [preflightLoading, setPreflightLoading] = useState(false);
  const [smokeTestResult, setSmokeTestResult] = useState<SmokeTestResult | null>(null);
  const [smokeTesting, setSmokeTesting] = useState(false);
  const [storageUsage, setStorageUsage] = useState<StorageUsageResponse | null>(null);
  const [activeModelDetailTab, setActiveModelDetailTab] = useState<"overview" | "metadata" | "tensors" | "compatibility" | "smoke">("overview");
  const [developerMode, setDeveloperMode] = useState(false);
  const [metadataSearch, setMetadataSearch] = useState("");
  const [tensorSearch, setTensorSearch] = useState("");

  // Backend Runtime Supervisor React State Hooks
  const [backendStatus, setBackendStatus] = useState<BackendStatus | null>(null);
  const [backendLogs, setBackendLogs] = useState<string>("No logs captured yet.");
  const [formAutoStart, setFormAutoStart] = useState<boolean>(true);
  const [formAutoRestart, setFormAutoRestart] = useState<boolean>(true);
  const [formStopOnExit, setFormStopOnExit] = useState<boolean>(true);
  const [formPort, setFormPort] = useState<number>(8181);
  const [formLogPath, setFormLogPath] = useState<string>("");
  const [formBinaryPath, setFormBinaryPath] = useState<string>("");
  const [formBindAddress, setFormBindAddress] = useState<string>("127.0.0.1");
  const [formMaxRestarts, setFormMaxRestarts] = useState<number>(5);
  const [formBackoffPolicy, setFormBackoffPolicy] = useState<string>("exponential");

  // Hook: Load Agent Contracts & Work Receipts dynamically on Kanban Selection
  useEffect(() => {
    if (selectedKanbanTask) {
      // Re-fetch details or timeline if needed
      api.getAgentRunTimeline({ taskId: selectedKanbanTask.id }).then((entries: any) => {
        setTimelineEntries(entries);
      }).catch(console.error);
    }
    
    if (selectedKanbanTask) {
      const agentId = selectedKanbanTask.assigned_agent_id || selectedKanbanTask.owner_id;
      if (agentId) {
        api.getAgentContract({ agentId })
          .then((res: any) => setActiveContract(res))
          .catch((err) => console.error("Error loading agent contract:", err));
      } else {
        setActiveContract(null);
      }

      if (selectedKanbanTask.status === "done") {
        api.getWorkReceipt({ cardId: selectedKanbanTask.id })
          .then((res: any) => setActiveReceipt(res))
          .catch((err) => console.error("Error loading work receipt:", err));
      } else {
        setActiveReceipt(null);
      }
    } else {
      setActiveContract(null);
      setActiveReceipt(null);
    }
  }, [selectedKanbanTask]);

  // Loader: Dynamic Mission Packs, Autopilot Settings & Audit Events
  const loadMissionData = async () => {
    try {
      const packs = await invoke<any[]>("list_mission_packs");
      setMissionPacks(packs);

      const auto = await invoke<any>("get_autopilot_settings", { workspaceId: "default" });
      setAutopilotEnabled(auto.autopilot_enabled);
      setAutopilotScope(auto.autopilot_scope);
      setApprovalRequirements(auto.approval_requirements);
      setNetworkPermissions(auto.network_permissions);
      setDoneApprovalRules(auto.done_approval_rules);

      const audits = await invoke<any[]>("get_mission_audit_events", { workspaceId: "default" });
      setMissionAuditEvents(audits);

      const active_progs = await invoke<MissionProgress[]>("get_active_missions_progress", { workspaceId: "default" });
      setActiveMissions(active_progs);
    } catch (e) {
      console.error("Error loading mission configurations:", e);
    }
  };

  useEffect(() => {
    loadMissionData();
  }, []);

  // API Call: Propose Mission preview
  const handleGenerateProposal = async () => {
    if (!outcomeGoal.trim()) {
      window.toast("Please specify your outcome goal first!");
      return;
    }
    try {
      const preview = await invoke<any>("generate_mission_preview", {
        workspaceId: "default",
        userGoal: outcomeGoal,
        missionType: selectedMissionPack
      });
      setMissionPreview(preview);
      loadMissionData();
      loadSuggestions();
    } catch (e) {
      window.toast("Failed to generate mission preview: " + e);
    }
  };

  // API Call: Apply draft proposed crew and board
  const handleApplyMission = async () => {
    if (!missionPreview) return;
    try {
      await api.applyMissionPreview({ previewId: missionPreview.preview_id });
      window.toast("🚀 Mission applied successfully! Real agents, cards, and contracts have been provisioned on the board.");
      setMissionPreview(null);
      setOutcomeGoal("");
      
      // Reload Kanban, Crew list and suggestions
      const freshTasks = await invoke<Task[]>("get_tasks");
      setTasks(freshTasks);
      const freshAgents = await invoke<Agent[]>("get_agents");
      setAgents(freshAgents);
      loadMissionData();
      loadSuggestions();
    } catch (e) {
      window.toast("Failed to apply mission: " + e);
    }
  };

  // API Call: Discard draft proposal
  const handleDiscardMission = async () => {
    if (!missionPreview) return;
    try {
      await api.discardMissionPreview({ previewId: missionPreview.preview_id });
      setMissionPreview(null);
      window.toast("Proposal discarded.");
    } catch (e) {
      window.toast("Failed to discard proposal: " + e);
    }
  };

  // API Call: Save current proposal settings as reusable Custom Mission Pack
  const handleSaveCustomPack = async () => {
    if (!missionPreview || !customPackName.trim()) {
      window.toast("Please specify a custom pack name!");
      return;
    }
    try {
      await api.saveMissionPackFromPreview({
        previewId: missionPreview.preview_id,
        name: customPackName
      });
      window.toast(`💾 Custom Mission Pack '${customPackName}' saved successfully!`);
      setCustomPackName("");
      loadMissionData();
    } catch (e) {
      window.toast("Failed to save custom pack: " + e);
    }
  };

  // API Call: Update Autopilot state, scope, safety requirements, and rules
  const handleUpdateAutopilotSettings = async (enabled: boolean, scope: string, reqs: string, net: string, rules: string) => {
    try {
      const payload = {
        workspace_id: "default",
        autopilot_enabled: enabled,
        autopilot_scope: scope,
        approval_requirements: reqs,
        command_permissions_override: [],
        file_permissions_override: [],
        network_permissions: net,
        done_approval_rules: rules
      };
      await api.updateAutopilotSettings({ settings: payload });
      setAutopilotEnabled(enabled);
      setAutopilotScope(scope);
      setApprovalRequirements(reqs);
      setNetworkPermissions(net);
      setDoneApprovalRules(rules);
      loadMissionData();
    } catch (e) {
      window.toast("Failed to update autopilot configurations: " + e);
    }
  };

  const [detailCommentText, setDetailCommentText] = useState("");
  const [blockerText, setBlockerText] = useState("");
  const [blockedByTaskId, setBlockedByTaskId] = useState("");
  const [evidenceText, setEvidenceText] = useState("");
  const [validationPassed, setValidationPassed] = useState(true);
  const [validationNotes, setValidationNotes] = useState("");
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [selectedCompletingAgentId, setSelectedCompletingAgentId] = useState("");
  const [selectedClaimingAgentId, setSelectedClaimingAgentId] = useState("");
  const [isCompletingTask, setIsCompletingTask] = useState(false);
  const [isAddingBlocker, setIsAddingBlocker] = useState(false);
  const [taskRequiredFiles, setTaskRequiredFiles] = useState("");
  const [taskAcceptanceCriteria, setTaskAcceptanceCriteria] = useState("");
  const [taskDependencies, setTaskDependencies] = useState("");
  const [modalDetailsTab, setModalDetailsTab] = useState<"log" | "comments">("log");
  const [timelineEntries, setTimelineEntries] = useState<any[]>([]);

  // Telemetry (Cameleer stats from local daemon)
  const [blackboardText, setBlackboardText] = useState<string>("");
  const [inputText, setInputText] = useState<string>("");
  const [inspectorTab, setInspectorTab] = useState<"profile" | "snapshot">("snapshot");
  const [coordinationDetails, setCoordinationDetails] = useState<CoordinationDetails>({
    workspaces: [],
    decisions: [],
    handoffs: [],
  });
  const [newDecisionText, setNewDecisionText] = useState("");
  
  // File Explorer states
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [selectedArtifactPath, setSelectedArtifactPath] = useState<string | null>(null);
  const [selectedArtifactContent, setSelectedArtifactContent] = useState<string>("");

  // Model priority failover chain
  const [modelPriority, setModelPriority] = useState<string[]>([
    "Llama 3.2 3B Instruct (GGUF - Local)",
    "Mistral 7B Instruct (GGUF - Local)",
    "GPT-4o Cloud (API)",
    "Claude 3.5 Sonnet (API)"
  ]);

  // System Stats Oscillation Telemetry
  const [cpuUsage, setCpuUsage] = useState(14);
  const [ramUsage, setRamUsage] = useState(1.8);
  const [tps, setTps] = useState(24.5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCpuUsage((prev) => {
        const delta = Math.floor(Math.random() * 5) - 2;
        const next = prev + delta;
        return Math.max(5, Math.min(45, next));
      });
      setRamUsage((prev) => {
        const delta = (Math.random() * 0.08) - 0.04;
        const next = prev + delta;
        return parseFloat(Math.max(1.5, Math.min(2.5, next)).toFixed(2));
      });
      setTps((prev) => {
        const delta = (Math.random() * 0.8) - 0.4;
        const next = prev + delta;
        return parseFloat(Math.max(22.0, Math.min(27.0, next)).toFixed(1));
      });
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  // Migrate localStorage keys from camelid.* to cameleer.* (Silent migration)
  useEffect(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("camelid.")) {
        const newKey = "cameleer." + key.slice("camelid.".length);
        const value = localStorage.getItem(key);
        if (value) {
          localStorage.setItem(newKey, value);
          localStorage.removeItem(key);
        }
      }
    }
  }, []);

  const selectAgentForEdit = (agent: Agent) => {
    setEditAgentId(agent.id);
    setEditName(agent.name);
    setEditRole(agent.role);
    setEditPersona(agent.persona);
    setEditProvider(agent.model_provider);
    setEditModelName(agent.model_name);
    setEditTemp(agent.temperature);
    setEditMaxTokens(agent.max_tokens);
    setEditSpawnSubtasks(agent.can_spawn_subtasks);
    setEditTalkGlobally(agent.can_talk_globally);
    setEditContinuous(agent.is_continuous);
    setEditParentAgentId(agent.parent_agent_id || "");
    setEditAllowedTools(agent.allowed_tools ? agent.allowed_tools.split(",").map(t => t.trim()) : ["task.create", "task.update", "memory.write"]);
  };

  useEffect(() => {
    if (activeTab === "agents" && agents.length > 0 && !editAgentId) {
      // Select the first agent by default
      selectAgentForEdit(agents[0]);
    }
  }, [activeTab, agents, editAgentId]);

  // Modals Control
  const [isSpawnModalOpen, setIsSpawnModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  
  // Agent Creator Form
  const [spawnName, setSpawnName] = useState("");
  const [spawnRole, setSpawnRole] = useState("");
  const [spawnPersona, setSpawnPersona] = useState("");
  const [spawnProvider, setSpawnProvider] = useState("camelid");
  const [spawnModel, setSpawnModel] = useState("camelid-default");
  const [spawnTemp, setSpawnTemp] = useState(0.7);
  const [spawnMaxTokens, setSpawnMaxTokens] = useState(2048);
  const [spawnContinuous, setSpawnContinuous] = useState(false);
  const [spawnParentAgentId, setSpawnParentAgentId] = useState("");
  const [spawnAllowedTools, setSpawnAllowedTools] = useState<string[]>(["task.create", "task.update", "memory.write"]);

  // Task Creator Form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [taskOwner, setTaskOwner] = useState("");
  const [taskPriority, setTaskPriority] = useState("medium");

  // Provider Settings
  const [ollamaUrl, setOllamaUrl] = useState("http://127.0.0.1:11434/v1/chat/completions");
  const [camelidUrl, setCamelidUrl] = useState("http://127.0.0.1:8181/v1/chat/completions");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");
  const [blackboardInput, setBlackboardInput] = useState("");

  const [isThinking, setIsThinking] = useState(false);
  const feedEndRef = useRef<HTMLDivElement>(null);

  const loadSuggestions = async () => {
    try {
      const list = await invoke<WorkSuggestion[]>("get_work_engine_suggestions");
      setSuggestions(list);
    } catch (e) {
      console.error("Failed to load suggestions", e);
    }
  };

  const loadTemplates = async () => {
    try {
      const list = await invoke<TemplateInfo[]>("list_templates");
      setTemplates(list);
    } catch (e) {
      console.error("Failed to load templates", e);
    }
  };

  const handleCreateSoftwareTeam = async () => {
    try {
      await api.createSoftwareTeam({ modelProvider: "camelid", modelName: "camelid-default" });
      await loadAgents();
      window.toast("Turnkey Software Team successfully created!");
    } catch (e) {
      window.toast("Failed to create software team: " + e);
    }
  };

  const handleCreateCodingSprint = async () => {
    try {
      await api.createCodingSprint({ workspaceId: "default" });
      await loadTasks();
      window.toast("Tetris coding sprint enqueued into backlog!");
    } catch (e) {
      window.toast("Failed to create coding sprint: " + e);
    }
  };

  const handleLaunchAgent = async () => {
    try {
      await api.createAgentFromTemplate({
        templateKey: selectedTemplateKey,
        customizedName: wizardCustomName,
        modelProvider: "camelid",
        modelName: "camelid-default"
      });
      await loadAgents();
      window.toast(`Agent "${wizardCustomName}" successfully launched into workforce!`);
    } catch (e) {
      window.toast("Failed to launch agent: " + e);
    }
  };

  const handleDecompose = async (taskId: string) => {
    try {
      setDecomposingTaskId(taskId);
      const proposals = await invoke<SubtaskProposal[]>("decompose_task", { parentTaskId: taskId });
      setDecomposedProposals(proposals);
    } catch (e) {
      window.toast("Failed to decompose task: " + e);
    }
  };

  const handleApproveSubtasks = async () => {
    try {
      await api.approveSubtasks({
        parentTaskId: decomposingTaskId,
        proposals: decomposedProposals
      });
      setDecomposedProposals([]);
      setDecomposingTaskId("");
      await loadTasks();
      window.toast("Subtask sprint approved and enqueued successfully!");
    } catch (e) {
      window.toast("Failed to approve subtasks: " + e);
    }
  };

  const handleResolveCommandApproval = async (taskId: string, approved: boolean) => {
    try {
      await api.resolveCommandApproval({ taskId, approved });
      await loadSuggestions();
      await loadTasks();
      await loadAgents();
      window.toast(approved ? "Command execution approved!" : "Command execution rejected.");
    } catch (e) {
      window.toast("Failed to resolve command approval: " + e);
    }
  };

  const handleSuggestionAction = async (command: string) => {
    try {
      const parts = command.split(":");
      const action = parts[0];
      
      if (action === "restart_agent") {
        const agentId = parts[1];
        await api.updateAgent({
          agent: {
            id: agentId,
            status: "idle",
            last_heartbeat: null
          }
        });
        await loadAgents();
        window.toast("Agent status reset to idle.");
      } else if (action === "approve_task") {
        const taskId = parts[1];
        await api.updateTaskStatus({ id: taskId, status: "done", evidencePath: "User manual validation override." });
        await loadTasks();
        window.toast("Task approved and completed!");
      } else if (action === "accept_handoff") {
        const handoffId = parseInt(parts[1], 10);
        await api.resolveHandoffCmd({ handoffId, resolution: "approved" });
        await loadTasks();
        window.toast("Agent handoff resolved successfully!");
      } else if (action === "assign_task") {
        const taskId = parts[1];
        const agentId = parts[2];
        await api.claimCard({ agentId, cardId: taskId });
        await loadTasks();
        await loadAgents();
        window.toast("Task claimed and assigned successfully!");
      }
      await loadSuggestions();
    } catch (e) {
      window.toast("Failed to execute suggestion action: " + e);
    }
  };

  // 1. Initial Load of Database contents
  useEffect(() => {
    loadAgents();
    loadTasks();
    loadBlackboard();
    loadProviderConfigs();
    loadCoordinationDetails();
    loadSuggestions();
    loadTemplates();
  }, []);

  // Polling hook every 3 seconds for shared awareness details
  useEffect(() => {
    const timer = setInterval(() => {
      loadCoordinationDetails();
      loadAgents();
      loadTasks();
      loadBlackboard();
      loadSuggestions();
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // 2. Fetch messages dynamically when Tab or Selected Agent changes
  useEffect(() => {
    loadMessages();
  }, [activeTab, selectedAgentId]);

  // 3. Scroll to latest messages when they load
  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isThinking]);

  // Load artifacts when the Files tab is focused
  useEffect(() => {
    if (activeTab === "files") {
      loadArtifacts();
    }
  }, [activeTab]);

  const loadArtifacts = async () => {
    try {
      const list = await invoke<any[]>("get_artifacts");
      setArtifacts(list);
      if (list.length > 0 && !selectedArtifactPath) {
        handleSelectArtifact(list[0].path);
      }
    } catch (e) {
      console.error("Failed to load artifacts", e);
    }
  };

  const handleSelectArtifact = async (path: string) => {
    setSelectedArtifactPath(path);
    try {
      const content = await invoke<string>("read_artifact_file", { path });
      setSelectedArtifactContent(content);
    } catch (e) {
      setSelectedArtifactContent(`// ERROR: Could not read file content.\n// Target: ${path}\n// Reason: ${e}`);
    }
  };

  const loadLocalModels = async () => {
    try {
      const resp = await invoke<{
        downloaded: string[];
        active_model: string | null;
        download_state: {
          downloading: boolean;
          model: string;
          progress: number;
          error: string | null;
        };
      }>("get_local_models");
      
      setLocalModels(resp.downloaded || []);
      setActiveModel(resp.active_model);
      setDownloadState(resp.download_state || {
        downloading: false,
        model: "",
        progress: 0,
        error: null
      });
    } catch (e) {
      console.error("Error loading local models:", e);
    }
  };

  const loadModelCatalog = async () => {
    try {
      const list = await invoke<ModelCatalogEntry[]>("list_model_catalog");
      setModelsCatalog(list);
    } catch (e) {
      console.error("Failed to load model catalog:", e);
    }
  };

  const loadStorageUsage = async () => {
    try {
      const usage = await invoke<StorageUsageResponse>("get_model_storage_usage");
      setStorageUsage(usage);
    } catch (e) {
      console.error("Failed to load storage usage:", e);
    }
  };

  const handleRemoteSearch = async () => {
    try {
      const res = await invoke<HuggingFaceModelEntry[]>("search_remote_models", {
        query: modelsSearchQuery,
        quantizationFilter: modelsFilterQuant
      });
      setRemoteModels(res);
    } catch (e) {
      window.toast("Hugging Face Hub Search failed: " + e);
    }
  };

  const handlePreflightCheck = async (entry: HuggingFaceModelEntry) => {
    setPreflightLoading(true);
    setPreflightReport(null);
    try {
      const report = await invoke<PreflightResponse>("generate_model_preflight", {
        provider: "huggingface",
        url: entry.download_url,
        repo: entry.repo_id,
        file: entry.filename
      });
      setPreflightReport(report);
    } catch (e) {
      window.toast("Preflight Check failed: " + e);
    } finally {
      setPreflightLoading(false);
    }
  };

  const handleDownloadModel = async (modelId: string) => {
    try {
      await api.queueModelDownload({ modelId });
      loadModelCatalog();
      loadStorageUsage();
      loadLocalModels();
      setModelsSubTab("downloads");
    } catch (e) {
      window.toast("Failed to queue model download: " + e);
    }
  };

  const handlePauseDownload = async (downloadId: string) => {
    try {
      await api.pauseModelDownload({ downloadId });
      loadModelCatalog();
      loadLocalModels();
    } catch (e) {
      window.toast("Failed to pause download: " + e);
    }
  };

  const handleCancelDownload = async (downloadId: string) => {
    try {
      await api.cancelModelDownload({ downloadId });
      loadModelCatalog();
      loadStorageUsage();
      loadLocalModels();
    } catch (e) {
      window.toast("Failed to cancel download: " + e);
    }
  };

  const handleImportLocal = async () => {
    if (!importPath.trim()) {
      window.toast("Please specify a valid local GGUF file path first.");
      return;
    }
    try {
      await api.importLocalModel({
        path: importPath,
        copyIntoStore: importCopy
      });
      window.toast("Model successfully verified and imported into local catalog!");
      setImportPath("");
      loadModelCatalog();
      loadStorageUsage();
      setModelsSubTab("installed");
    } catch (e) {
      window.toast("Import failed: " + e);
    }
  };

  const handleOpenModelInspect = async (model: ModelCatalogEntry) => {
    setSelectedModelForInspect(model);
    setActiveModelDetailTab("overview");
    setSmokeTestResult(null);
    try {
      const details = await invoke<ModelDetailsResponse>("get_model_details", {
        modelId: model.model_id
      });
      setModelDetails(details);
    } catch (e) {
      console.error("Failed to load GGUF model details:", e);
    }
  };

  const handleActivateModelScopedSelect = async (modelId: string, scopeType: string, scopeId: string) => {
    try {
      await api.activateModelScoped({
        modelId,
        scopeType,
        scopeId
      });
      window.toast(`Model successfully activated for ${scopeType} (${scopeId})!`);
      loadModelCatalog();
      loadLocalModels();
      if (selectedModelForInspect && selectedModelForInspect.model_id === modelId) {
        handleOpenModelInspect(selectedModelForInspect);
      }
    } catch (e) {
      window.toast("Activation failed: " + e);
    }
  };

  const handleRunSmokeLoadingTest = async (modelId: string) => {
    setSmokeTesting(true);
    setSmokeTestResult(null);
    try {
      const res = await invoke<SmokeTestResult>("run_model_smoke_test", {
        modelId
      });
      setSmokeTestResult(res);
    } catch (e) {
      window.toast("Smoke Test benchmark failed: " + e);
    } finally {
      setSmokeTesting(false);
    }
  };

  const handleDeleteModelSecure = async (modelId: string) => {
    if (!confirm("Are you absolutely sure you want to delete this model? This will permanently erase the local GGUF binary from your hard drive.")) {
      return;
    }
    try {
      await api.deleteModel({ modelId });
      window.toast("Model payload successfully deleted.");
      setSelectedModelForInspect(null);
      loadModelCatalog();
      loadStorageUsage();
    } catch (e) {
      window.toast("Failed to delete model: " + e);
    }
  };

  const loadBackendStatus = async () => {
    try {
      const status = await invoke<BackendStatus>("get_backend_status");
      setBackendStatus(status);
      if (status) {
        setFormPort(status.port || 8181);
        setFormLogPath(status.log_path || "");
        setFormBindAddress(status.bind_address || "127.0.0.1");
      }
      
      const config = await invoke<BackendRuntimeConfig>("get_backend_config");
      if (config) {
        setFormAutoStart(config.auto_start_on_app_launch);
        setFormAutoRestart(config.auto_restart_on_crash);
        setFormStopOnExit(config.stop_on_app_exit);
        setFormPort(config.port);
        setFormLogPath(config.log_path || "");
        setFormBinaryPath(config.backend_binary_path || "");
        setFormBindAddress(config.bind_address || "127.0.0.1");
        setFormMaxRestarts(config.max_restarts);
        setFormBackoffPolicy(config.restart_backoff_policy);
      }
    } catch (e) {
      console.error("Failed to load backend status and config:", e);
    }
  };

  const handleCheckBackendHealth = async () => {
    try {
      const status = await invoke<BackendStatus>("check_backend_health");
      setBackendStatus(status);
      window.toast(`Backend health check completed! Current state: ${status.state}`);
    } catch (e) {
      window.toast("Health check command failed: " + e);
    }
  };

  const handleRestartBackend = async () => {
    try {
      const status = await invoke<BackendStatus>("restart_backend", { reason: "user_requested" });
      setBackendStatus(status);
      window.toast(`Backend successfully restarted! Current state: ${status.state}`);
      handleGetBackendLogs();
    } catch (e) {
      window.toast("Restart command failed: " + e);
    }
  };

  const handleStopBackend = async () => {
    try {
      const status = await invoke<BackendStatus>("stop_backend");
      setBackendStatus(status);
      window.toast("Backend inference daemon successfully stopped.");
    } catch (e) {
      window.toast("Stop command failed: " + e);
    }
  };

  const handleGetBackendLogs = async () => {
    try {
      const logs = await invoke<string>("get_backend_logs", { limit: 150 });
      setBackendLogs(logs);
    } catch (e) {
      console.error("Failed to get backend logs:", e);
    }
  };

  const handleOpenBackendLogs = async () => {
    try {
      await api.openBackendLogs();
    } catch (e) {
      window.toast("Failed to open logs: " + e);
    }
  };

  const handleSaveBackendConfig = async () => {
    try {
      const newConfig = {
        backend_binary_path: formBinaryPath ? formBinaryPath : null,
        bind_address: formBindAddress,
        port: formPort,
        auto_start_on_app_launch: formAutoStart,
        auto_restart_on_crash: formAutoRestart,
        stop_on_app_exit: formStopOnExit,
        startup_timeout_ms: 30000,
        health_check_interval_ms: 5000,
        restart_backoff_policy: formBackoffPolicy,
        max_restarts: formMaxRestarts,
        log_path: formLogPath ? formLogPath : null,
        model_path: null,
      };
      await api.saveBackendConfigCmd({ newConfig });
      
      let restartRecommended = false;
      if (backendStatus) {
        if (backendStatus.port !== formPort || backendStatus.bind_address !== formBindAddress || 
            (formBinaryPath !== "" && backendStatus.state !== "ready")) {
          restartRecommended = true;
        }
      }
      
      if (restartRecommended) {
        if (confirm("Supervisor configuration successfully saved! Port or path overrides changed. Would you like to restart the backend supervisor immediately to validate and apply the new configuration?")) {
          await handleRestartBackend();
        }
      } else {
        window.toast("Supervisor configuration successfully saved!");
      }
      loadBackendStatus();
    } catch (e) {
      window.toast("Failed to save config: " + e);
    }
  };

  const handleResetBackendRuntime = async () => {
    if (!confirm("Are you sure you want to completely reset the backend runtime supervisor? This will stop the daemon and revert all port and auto-start configurations to standard defaults.")) {
      return;
    }
    try {
      const status = await invoke<BackendStatus>("reset_backend_runtime_state");
      setBackendStatus(status);
      window.toast("Backend runtime supervisor reset successfully!");
      setFormBinaryPath("");
      setFormBindAddress("127.0.0.1");
      setFormPort(8181);
      setFormLogPath("");
      setFormMaxRestarts(5);
      setFormBackoffPolicy("exponential");
    } catch (e) {
      window.toast("Failed to reset supervisor state: " + e);
    }
  };

  useEffect(() => {
    let active = true;
    let unlistenStatus: (() => void) | null = null;
    let unlistenReady: (() => void) | null = null;
    let unlistenFailed: (() => void) | null = null;

    const setupBackendListeners = async () => {
      const uStatus = await listen<BackendStatus>("backend_status_changed", (event) => {
        if (active) {
          console.log("[SUPERVISOR EVENT] Status changed:", event.payload);
          setBackendStatus(event.payload);
        }
      });
      unlistenStatus = uStatus;

      const uReady = await listen<BackendStatus>("backend_ready", (event) => {
        if (active) {
          console.log("[SUPERVISOR EVENT] Ready:", event.payload);
          setBackendStatus(event.payload);
        }
      });
      unlistenReady = uReady;

      const uFailed = await listen<BackendStatus>("backend_failed", (event) => {
        if (active) {
          console.log("[SUPERVISOR EVENT] Failed:", event.payload);
          setBackendStatus(event.payload);
        }
      });
      unlistenFailed = uFailed;
    };

    setupBackendListeners();
    loadBackendStatus();
    handleGetBackendLogs();

    const logTimer = setInterval(() => {
      if (activeTab === "system" || !backendStatus || backendStatus.state !== "ready") {
        handleGetBackendLogs();
      }
    }, 5000);

    return () => {
      active = false;
      if (unlistenStatus) unlistenStatus();
      if (unlistenReady) unlistenReady();
      if (unlistenFailed) unlistenFailed();
      clearInterval(logTimer);
    };
  }, [activeTab, backendStatus?.state]);

  useEffect(() => {
    loadLocalModels();
    loadModelCatalog();
    loadStorageUsage();
  }, []);

  useEffect(() => {
    if (activeTab === "models") {
      loadModelCatalog();
      loadStorageUsage();
    }
  }, [activeTab]);

  useEffect(() => {
    const intervalTime = downloadState.downloading ? 1000 : 5000;
    const timer = setInterval(() => {
      loadLocalModels();
      if (activeTab === "models") {
        loadModelCatalog();
        loadStorageUsage();
      }
    }, intervalTime);
    return () => clearInterval(timer);
  }, [downloadState.downloading, activeTab]);

  // 4. Tauri Global Event Listeners for real-time reactive streaming updates
  useEffect(() => {
    let active = true;
    let unlistenFn: (() => void) | null = null;

    const setupListener = async () => {
      const unlisten = await listen("cameleer-event", (event: any) => {
        if (!active) {
          unlisten();
          return;
        }

        const payload = event.payload;
        console.log("[EVENT BUS] Received Event:", payload);

        if (payload.event_type === "message") {
          const newMsg = payload.payload as Message;
          // Only append if it matches our active session
          const currentSession = activeTab === "global" ? "global" : `direct_${selectedAgentId}`;
          if (newMsg.session_id === currentSession) {
            setMessages((prev) => {
              // De-duplicate just in case
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        } else if (payload.event_type === "agent_run_status") {
          const agentId = payload.agent_id;
          const status = payload.payload.status;
          setAgents((prev) =>
            prev.map((a) => (a.id === agentId ? { ...a, status } : a))
          );
          if (status === "working") {
            setIsThinking(true);
          } else {
            setIsThinking(false);
          }
        } else if (payload.event_type === "task_updated") {
          loadTasks();
        }
      });

      if (!active) {
        unlisten();
      } else {
        unlistenFn = unlisten;
      }
    };

    setupListener();

    return () => {
      active = false;
      if (unlistenFn) {
        (unlistenFn as () => void)();
      }
    };
  }, [activeTab, selectedAgentId]);

  const loadAgents = async () => {
    try {
      const list = await invoke<Agent[]>("get_agents");
      setAgents(list);
    } catch (e) {
      console.error("Failed to load agents", e);
    }
  };

  const loadMessages = async () => {
    try {
      let sessionId = "global";
      if (activeTab === "dm") {
        sessionId = `direct_${selectedAgentId}`;
      } else if (activeTab === "org_dashboard" && activeOrgNode) {
        if (activeOrgNode.node_type === "team") {
          sessionId = `org_team_${activeOrgNode.team_id || activeOrgNode.id}`;
        } else if (activeOrgNode.node_type === "project") {
          sessionId = `org_proj_${activeOrgNode.project_id || activeOrgNode.id}`;
        }
      }

      const list = await invoke<Message[]>("get_messages", { sessionId });
      setMessages(list);
    } catch (e) {
      console.error("Failed to load messages", e);
    }
  };

  const loadTasks = async () => {
    try {
      const list = await invoke<Task[]>("get_tasks");
      setTasks(list);
    } catch (e) {
      console.error("Failed to load tasks", e);
    }
  };

  const loadBlackboard = async () => {
    try {
      const packet = await invoke<string>("get_blackboard_awareness");
      setBlackboardText(packet);
    } catch (e) {
      console.error("Failed to load blackboard", e);
    }
  };

  const loadCoordinationDetails = async () => {
    try {
      const details = await invoke<CoordinationDetails>("get_coordination_details");
      setCoordinationDetails(details);
    } catch (e) {
      console.error("Failed to load coordination details", e);
    }
  };

  const handleResolveHandoff = async (id: number, status: string) => {
    try {
      await api.resolveHandoffCmd({ id, status });
      loadCoordinationDetails();
    } catch (e) {
      window.toast("Failed to resolve handoff: " + e);
    }
  };

  const loadProviderConfigs = async () => {
    try {
      const configs = await invoke<ProviderConfig[]>("list_provider_configs");
      // Pre-fill keys/endpoints from defaults if present
      configs.forEach((c) => {
        if (c.provider === "ollama") setOllamaUrl(c.endpoint_url || "");
        if (c.provider === "camelid") setCamelidUrl(c.endpoint_url || "");
        if (c.provider === "openai") setOpenaiKey(c.api_key || "");
        if (c.provider === "anthropic") setAnthropicKey(c.api_key || "");
      });
    } catch (e) {
      console.error("Failed to load provider configs", e);
    }
  };

  // Submit DM or Global Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    let sessionId = "global";
    if (activeTab === "dm") {
      sessionId = `direct_${selectedAgentId}`;
    } else if (activeTab === "org_dashboard" && activeOrgNode) {
      if (activeOrgNode.node_type === "team") {
        sessionId = `org_team_${activeOrgNode.team_id || activeOrgNode.id}`;
      } else if (activeOrgNode.node_type === "project") {
        sessionId = `org_proj_${activeOrgNode.project_id || activeOrgNode.id}`;
      }
    }
    
    const userPrompt = inputText;
    setInputText("");

    try {
      // 1. Save user message locally
      await api.saveMessage({
        sessionId,
        role: "user",
        senderId: "user",
        content: userPrompt,
      });
      
      // Reload messages list
      loadMessages();

      // 2. Identify agent recipient and trigger LLM reasoning loop asynchronously
      setIsThinking(true);
      
      if (activeTab === "org_dashboard" && activeOrgNode) {
        // Broadcast to team/project lead
        await api.triggerOrgReply({
          orgNodeType: activeOrgNode.node_type,
          orgNodeId: activeOrgNode.id,
          sessionId,
        });
      } else {
        const targetedAgentId = activeTab === "global" ? "agent-coder" : selectedAgentId;
        await api.triggerAgentReply({
          agentId: targetedAgentId,
          sessionId,
        });
      }

      setIsThinking(false);
      loadMessages();
      loadAgents(); // Update status/heartbeats
      loadBlackboard();
    } catch (e) {
      console.error("Inference failed", e);
      setIsThinking(false);
    }
  };

  // Spawn Custom Agent
  const handleSpawnAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spawnName || !spawnRole) return;

    const newAgent: Agent = {
      id: spawnName.toLowerCase().replace(/\s+/g, "-"),
      name: spawnName,
      role: spawnRole,
      persona: spawnPersona,
      model_provider: spawnProvider,
      model_name: spawnModel,
      temperature: spawnTemp,
      max_tokens: spawnMaxTokens,
      can_spawn_subtasks: true,
      can_talk_globally: true,
      is_continuous: spawnContinuous,
      status: "idle",
      last_heartbeat: null,
      parent_agent_id: spawnParentAgentId || null,
      allowed_tools: spawnAllowedTools.join(","),
    };

    try {
      await api.createAgent({ agent: newAgent });
      setIsSpawnModalOpen(false);
      setSpawnName("");
      setSpawnRole("");
      setSpawnPersona("");
      setSpawnParentAgentId("");
      setSpawnAllowedTools(["task.create", "task.update", "memory.write"]);
      loadAgents();
    } catch (e) {
      console.error("Failed to spawn agent", e);
    }
  };

  // Save Agent Configuration
  const handleSaveAgentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAgentId || !editName || !editRole) {
      window.toast("Name and Role are required fields.");
      return;
    }

    const current = agents.find((a) => a.id === editAgentId);
    const updatedAgent: Agent = {
      id: editAgentId,
      name: editName,
      role: editRole,
      persona: editPersona,
      model_provider: editProvider,
      model_name: editModelName,
      temperature: editTemp,
      max_tokens: editMaxTokens,
      can_spawn_subtasks: editSpawnSubtasks,
      can_talk_globally: editTalkGlobally,
      is_continuous: editContinuous,
      status: current ? current.status : "idle",
      last_heartbeat: current ? current.last_heartbeat : null,
      parent_agent_id: editParentAgentId || null,
      allowed_tools: editAllowedTools.join(","),
    };

    try {
      await api.updateAgent({ agent: updatedAgent });
      await loadAgents();
      window.toast(`Agent directive for ${editName} updated successfully!`);
    } catch (err) {
      console.error("Failed to update agent", err);
      window.toast(`Failed to update agent: ${err}`);
    }
  };

  // Retire Agent Configured
  const handleRetireAgent = async (agentId: string) => {
    if (!confirm(`Are you sure you want to retire Agent ${agents.find((a) => a.id === agentId)?.name || agentId}?`)) {
      return;
    }

    try {
      await api.deleteAgent({ id: agentId });
      await loadAgents();
      // If we deleted the currently edited agent, reset selection
      if (editAgentId === agentId) {
        setEditAgentId("");
        setEditName("");
        setEditRole("");
        setEditPersona("");
        setEditProvider("camelid");
        setEditModelName("");
        setEditTemp(0.7);
        setEditMaxTokens(2048);
        setEditSpawnSubtasks(true);
        setEditTalkGlobally(true);
        setEditContinuous(false);
      }
      window.toast("Agent retired successfully!");
    } catch (err) {
      console.error("Failed to delete agent", err);
      window.toast(`Failed to delete agent: ${err}`);
    }
  };

  // Safe JSON Parsing Helper
  function safeParseJson<T>(jsonStr: string | null | undefined, defaultValue: T): T {
    if (!jsonStr || !jsonStr.trim()) return defaultValue;
    try {
      return JSON.parse(jsonStr) as T;
    } catch (e) {
      console.warn("Failed to parse JSON string:", jsonStr, e);
      return defaultValue;
    }
  }

  // Smart Assignment Recommendations based on task type keywords
  const recommendAgentForTask = (title: string, desc: string | null): Agent | null => {
    const text = `${title} ${desc || ""}`.toLowerCase();
    if (text.includes("code") || text.includes("implement") || text.includes("rust") || text.includes("python") || text.includes("bug") || text.includes("fix") || text.includes("refactor") || text.includes("build") || text.includes("script") || text.includes("coder") || text.includes("develop")) {
      return agents.find(a => a.id === "agent-coder") || agents.find(a => a.role.toLowerCase().includes("engineer")) || null;
    }
    if (text.includes("write") || text.includes("readme") || text.includes("document") || text.includes("docs") || text.includes("explain") || text.includes("text") || text.includes("post") || text.includes("blog") || text.includes("linkedin") || text.includes("writer")) {
      return agents.find(a => a.id === "agent-writer") || agents.find(a => a.role.toLowerCase().includes("writer")) || null;
    }
    if (text.includes("test") || text.includes("verify") || text.includes("validate") || text.includes("check") || text.includes("audit") || text.includes("sentry") || text.includes("assert") || text.includes("run") || text.includes("qa")) {
      return agents.find(a => a.id === "agent-sentry") || agents.find(a => a.role.toLowerCase().includes("sentry")) || null;
    }
    if (text.includes("analyze") || text.includes("research") || text.includes("compare") || text.includes("benchmark") || text.includes("summary") || text.includes("report") || text.includes("graph") || text.includes("metric") || text.includes("analyst")) {
      return agents.find(a => a.id === "agent-analyst") || agents.find(a => a.role.toLowerCase().includes("analyst")) || null;
    }
    return null;
  };

  // Create Kanban Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle) return;

    const reqFiles = taskRequiredFiles.split(",").map(f => f.trim()).filter(f => f.length > 0);
    const criteria = taskAcceptanceCriteria.split("\n").map(c => c.trim()).filter(c => c.length > 0);
    const deps = taskDependencies.split(",").map(d => d.trim()).filter(d => d.length > 0);

    try {
      await api.createCard({ 
        workspaceId: "default",
        projectId: activeOrgNode?.project_id || null,
        teamId: activeOrgNode?.team_id || null,
        title: taskTitle,
        description: taskDesc || null,
        typeName: "task",
        priority: taskPriority,
        status: "ready",
        assignedAgentId: taskOwner || null,
        acceptanceCriteria: JSON.stringify(criteria),
        requiredFiles: JSON.stringify(reqFiles),
        dependencies: JSON.stringify(deps)
      });
      setIsTaskModalOpen(false);
      setTaskTitle("");
      setTaskDesc("");
      setTaskOwner("");
      setTaskRequiredFiles("");
      setTaskAcceptanceCriteria("");
      setTaskDependencies("");
      loadTasks();
      setRefreshKanban(prev => prev + 1);
    } catch (err: any) {
      console.error("Failed to create task", err);
      window.toast("Failed to create task: " + err);
    }
  };

  // Transition Card Status general helper
  const handleTransitionStatus = async (taskId: string, nextStatus: string) => {
    try {
      await api.updateTaskStatus({
        id: taskId,
        status: nextStatus,
        evidencePath: null
      });
      // Refresh modal if open
      if (selectedKanbanTask && selectedKanbanTask.id === taskId) {
        const list = await invoke<Task[]>("get_tasks");
        const updated = list.find(t => t.id === taskId);
        if (updated) setSelectedKanbanTask(updated);
      }
      loadTasks();
    } catch (err: any) {
      window.toast("Failed to transition status: " + err);
    }
  };

  // Claim Card
  const handleClaimCard = async (agentId: string, cardId: string) => {
    try {
      await api.claimCard({ agentId, cardId });
      loadTasks();
      // If modal is open, refresh selected task details
      if (selectedKanbanTask && selectedKanbanTask.id === cardId) {
        const list = await invoke<Task[]>("get_tasks");
        const updated = list.find(t => t.id === cardId);
        if (updated) setSelectedKanbanTask(updated);
      }
    } catch (err: any) {
      window.toast("Failed to claim card: " + err);
    }
  };

  // Complete and Validate Card on Host System
  const handleCompleteCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKanbanTask) return;
    if (!selectedCompletingAgentId) {
      window.toast("Please select the agent completing the task.");
      return;
    }

    setCompletionError(null);
    try {
      await api.completeCard({
        agentId: selectedCompletingAgentId,
        cardId: selectedKanbanTask.id,
        evidence: evidenceText,
        validationPassed: validationPassed,
        validationNotes: validationNotes || null
      });

      setIsCompletingTask(false);
      setEvidenceText("");
      setValidationNotes("");
      setValidationPassed(true);
      setSelectedCompletingAgentId("");
      setSelectedKanbanTask(null);
      loadTasks();
    } catch (err: any) {
      console.error("Failed to complete card", err);
      setCompletionError(err.toString());
    }
  };

  // Add Comment to card history
  const handleAddComment = async () => {
    if (!selectedKanbanTask || !detailCommentText.trim()) return;
    try {
      await api.updateCardProgress({
        agentId: "user",
        cardId: selectedKanbanTask.id,
        notes: detailCommentText,
        files: null,
        artifacts: null,
        blockers: null,
        validationStatus: null
      });
      setDetailCommentText("");
      // Refresh selected task details
      const list = await invoke<Task[]>("get_tasks");
      const updated = list.find(t => t.id === selectedKanbanTask.id);
      if (updated) setSelectedKanbanTask(updated);
      loadTasks();
    } catch (err: any) {
      window.toast("Failed to add comment: " + err);
    }
  };

  // Declare Card Blocked via database dependency blockers mapping
  const handleAddBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKanbanTask || !blockerText.trim()) return;
    try {
      await api.createTaskBlocker({
        taskId: selectedKanbanTask.id,
        blockedByTaskId: blockedByTaskId || "None",
        reason: blockerText
      });
      setBlockerText("");
      setBlockedByTaskId("");
      setIsAddingBlocker(false);
      // Refresh task details
      const list = await invoke<Task[]>("get_tasks");
      const updated = list.find(t => t.id === selectedKanbanTask.id);
      if (updated) setSelectedKanbanTask(updated);
      loadTasks();
    } catch (err: any) {
      window.toast("Failed to add blocker: " + err);
    }
  };

  // Toggle Acceptance Checklist Item
  const handleToggleChecklistItem = async (index: number, currentChecked: boolean) => {
    if (!selectedKanbanTask) return;
    const criteria = safeParseJson<string[]>(selectedKanbanTask.acceptance_criteria, []);
    
    const updatedCriteria = criteria.map((item, idx) => {
      if (idx === index) {
        const clean = item.replace(/^\[[ x]\]\s*/, "");
        return currentChecked ? `[ ] ${clean}` : `[x] ${clean}`;
      }
      return item;
    });

    try {
      const updatedTask = {
        ...selectedKanbanTask,
        acceptance_criteria: JSON.stringify(updatedCriteria)
      };
      
      const clean = criteria[index].replace(/^\[[ x]\]\s*/, "");
      const actionText = currentChecked ? "unchecked" : "checked";
      
      await api.updateCardProgress({
        agentId: "user",
        cardId: selectedKanbanTask.id,
        notes: `Checklist item '${clean}' was ${actionText} by user.`,
        files: null,
        artifacts: null,
        blockers: null,
        validationStatus: null
      });

      setSelectedKanbanTask(updatedTask);
      loadTasks();
    } catch (err: any) {
      window.toast("Failed to toggle checklist item: " + err);
    }
  };

  // Delete Agent
  const handleDeleteAgent = async (id: string) => {
    if (confirm(`Are you sure you want to retire Agent ${id}?`)) {
      try {
        await api.deleteAgent({ id });
        loadAgents();
      } catch (e) {
        console.error("Failed to delete agent", e);
      }
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      await api.saveProviderConfig({
        provider: "camelid",
        modelName: "camelid-default",
        apiKey: null,
        endpointUrl: camelidUrl,
        isDefault: true,
      });
      await api.saveProviderConfig({
        provider: "ollama",
        modelName: "qwen2.5-coder",
        apiKey: null,
        endpointUrl: ollamaUrl,
        isDefault: true,
      });
      if (openaiKey) {
        await api.saveProviderConfig({
          provider: "openai",
          modelName: "gpt-4o",
          apiKey: openaiKey,
          endpointUrl: null,
          isDefault: true,
        });
      }
      if (anthropicKey) {
        await api.saveProviderConfig({
          provider: "anthropic",
          modelName: "claude-3-5-sonnet",
          apiKey: anthropicKey,
          endpointUrl: null,
          isDefault: true,
        });
      }
      if (blackboardInput) {
        await api.updateSharedState({
          key: "objective",
          value: blackboardInput,
        });
        setBlackboardInput("");
        loadBlackboard();
      }
      window.toast("Settings saved successfully!");
    } catch (e) {
      console.error("Failed to save settings", e);
    }
  };

  const blockingOverlayStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(10, 13, 20, 0.75)",
    backdropFilter: "blur(20px) saturate(180%)",
    WebkitBackdropFilter: "blur(20px) saturate(180%)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-main)",
    fontFamily: "var(--font-sans)",
  };

  const glassCardStyle: React.CSSProperties = {
    background: "rgba(19, 24, 38, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "20px",
    padding: "32px",
    boxShadow: "0 20px 50px rgba(0, 0, 0, 0.5), 0 0 45px rgba(0, 242, 254, 0.05)",
    textAlign: "center",
  };

  const overlayTitleStyle: React.CSSProperties = {
    fontSize: "1.4rem",
    fontWeight: 700,
    marginBottom: "12px",
    background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  };

  const renderBlockingOverlay = () => {
    if (activeTab === "system") return null;
    if (!backendStatus) {
      return (
        <div style={blockingOverlayStyle}>
          <div style={glassCardStyle}>
            <h2 style={overlayTitleStyle}>Initializing Supervisor Context...</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: 0 }}>Connecting to local GGUF backend supervisor state.</p>
            <div className="dot-pulse" style={{ justifyContent: "center", marginTop: "24px" }}>
              <span></span><span></span><span></span>
            </div>
          </div>
        </div>
      );
    }

    const isStartingOrLoading = ["starting", "restarting", "stopping"].includes(backendStatus.state);
    
    if (backendStatus.state !== "ready") {
      return (
        <div style={blockingOverlayStyle}>
          <div style={{ ...glassCardStyle, width: "650px", maxWidth: "90%" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "20px", marginBottom: "20px" }}>
              <span style={{ fontSize: "2.2rem" }}>
                {isStartingOrLoading ? "⏳" : "⚠️"}
              </span>
              <div style={{ textAlign: "left" }}>
                <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {backendStatus.state === "starting" && "Starting Backend Inference..."}
                  {backendStatus.state === "restarting" && "Restarting Backend..."}
                  {backendStatus.state === "stopping" && "Stopping Backend..."}
                  {backendStatus.state === "failed" && "Backend Failed to Start"}
                  {backendStatus.state === "crashed" && "Backend Inference Process Crashed"}
                  {backendStatus.state === "stopped" && "Backend Inference Stopped"}
                  {backendStatus.state === "not_installed" && "Backend Binary Missing"}
                  {["unknown", "degraded"].includes(backendStatus.state) && `Backend Status: ${backendStatus.state.toUpperCase()}`}
                </h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                  Cameleer Local Daemon Supervisor (State: <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-primary)", fontWeight: 700 }}>{backendStatus.state}</span>)
                </p>
              </div>
            </div>

            {/* Diagnostic / Error Block */}
            {backendStatus.last_error && (
              <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "10px", padding: "14px 16px", marginBottom: "20px", color: "#f87171", fontSize: "0.85rem", textAlign: "left", lineHeight: 1.4 }}>
                <div style={{ fontWeight: 700, textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.5px", marginBottom: "4px", color: "#ef4444" }}>Diagnostic Error Summary</div>
                {backendStatus.last_error}
              </div>
            )}

            {/* Live Log Console */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", textAlign: "left", marginBottom: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.78rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px" }}>Live Log Stream (Last 150 Lines)</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{backendStatus.log_path ? backendStatus.log_path.split("/").pop() : "camelid.log"}</span>
              </div>
              <pre style={{
                background: "rgba(0,0,0,0.45)",
                border: "1px solid var(--border-color)",
                borderRadius: "10px",
                padding: "14px",
                fontSize: "0.75rem",
                color: "#34d399",
                fontFamily: "var(--font-mono)",
                maxHeight: "180px",
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                margin: 0,
                lineHeight: 1.45,
                boxShadow: "inset 0 4px 20px rgba(0,0,0,0.5)"
              }}>
                {backendLogs || "No logs streams piped yet."}
              </pre>
            </div>

            {/* Telemetry Footer */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", fontSize: "0.8rem", background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "12px", marginBottom: "24px", textAlign: "left" }}>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.68rem", textTransform: "uppercase", marginBottom: "2px" }}>Target Port / Bind</div>
                <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{backendStatus.bind_address}:{backendStatus.port || 8181}</div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.68rem", textTransform: "uppercase", marginBottom: "2px" }}>Process PID</div>
                <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{backendStatus.pid || "None"}</div>
              </div>
              <div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.68rem", textTransform: "uppercase", marginBottom: "2px" }}>Restarts Count</div>
                <div style={{ fontWeight: 600, color: backendStatus.restart_count > 0 ? "var(--color-blocked)" : "var(--text-main)" }}>{backendStatus.restart_count} / 5</div>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={handleCheckBackendHealth} className="action-btn" style={{ margin: 0, height: "38px", padding: "0 16px", fontSize: "0.82rem" }}>
                  🔄 Check Status
                </button>
                {!isStartingOrLoading ? (
                  <button onClick={handleRestartBackend} className="action-btn" style={{ margin: 0, height: "38px", padding: "0 16px", fontSize: "0.82rem", background: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }}>
                    🚀 Restart Backend
                  </button>
                ) : (
                  <button disabled className="action-btn" style={{ margin: 0, height: "38px", padding: "0 16px", fontSize: "0.82rem", opacity: 0.6 }}>
                    ⏳ Restarting...
                  </button>
                )}
                {backendStatus.state !== "stopped" && (
                  <button onClick={handleStopBackend} className="action-btn danger-btn" style={{ margin: 0, height: "38px", padding: "0 16px", fontSize: "0.82rem" }}>
                    🛑 Stop
                  </button>
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <button onClick={handleOpenBackendLogs} className="action-btn" style={{ margin: 0, height: "38px", padding: "0 16px", fontSize: "0.82rem" }}>
                  📂 Open Logs
                </button>
                <button onClick={async () => {
                  try {
                    await api.revealBackendBinary();
                  } catch(e) {
                    window.toast("Failed to reveal binary: " + e);
                  }
                }} className="action-btn" style={{ margin: 0, height: "38px", padding: "0 16px", fontSize: "0.82rem" }}>
                  🔍 Reveal Binary
                </button>
                <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab("system"); }} style={{ fontSize: "0.85rem", color: "var(--accent-primary)", textDecoration: "none", fontWeight: 700, marginLeft: "8px", transition: "color 0.2s ease" }} onMouseEnter={(e) => e.currentTarget.style.color = "var(--accent-secondary)"} onMouseLeave={(e) => e.currentTarget.style.color = "var(--accent-primary)"}>
                  Go to Settings →
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  

  return {
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
  };
}
