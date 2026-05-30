import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import BacklogView from "./components/board/BacklogView";
import KanbanBoard from "./components/board/KanbanBoard";
import { OrgSidebar } from "./components/org/OrgSidebar";
import { ProjectDashboard } from "./components/org/ProjectDashboard";
import { AgentOrgNode } from "./types";
import "./App.css";

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
  required_files?: string | null;      // serialized JSON
  related_files?: string | null;       // serialized JSON
  related_artifacts?: string | null;   // serialized JSON
  dependencies?: string | null;        // serialized JSON
  blockers?: string | null;            // serialized JSON
  comments?: string | null;            // serialized JSON
  activity_log?: string | null;        // serialized JSON
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
  const [activeTab, setActiveTab] = useState<"dashboard" | "global" | "dm" | "kanban" | "skills" | "channels" | "files" | "system" | "agents" | "models" | "missions" | "org_dashboard">("dashboard");
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
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("agent-coder");
  const [activeOrgNode, setActiveOrgNode] = useState<AgentOrgNode | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedKanbanTask, setSelectedKanbanTask] = useState<Task | null>(null);
  
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
      invoke("get_agent_run_timeline", { taskId: selectedKanbanTask.id }).then((entries: any) => {
        setTimelineEntries(entries);
      }).catch(console.error);
    }
    
    if (selectedKanbanTask) {
      const agentId = selectedKanbanTask.assigned_agent_id || selectedKanbanTask.owner_id;
      if (agentId) {
        invoke("get_agent_contract", { agentId })
          .then((res: any) => setActiveContract(res))
          .catch((err) => console.error("Error loading agent contract:", err));
      } else {
        setActiveContract(null);
      }

      if (selectedKanbanTask.status === "done") {
        invoke("get_work_receipt", { cardId: selectedKanbanTask.id })
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
      alert("Please specify your outcome goal first!");
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
      alert("Failed to generate mission preview: " + e);
    }
  };

  // API Call: Apply draft proposed crew and board
  const handleApplyMission = async () => {
    if (!missionPreview) return;
    try {
      await invoke("apply_mission_preview", { previewId: missionPreview.preview_id });
      alert("🚀 Mission applied successfully! Real agents, cards, and contracts have been provisioned on the board.");
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
      alert("Failed to apply mission: " + e);
    }
  };

  // API Call: Discard draft proposal
  const handleDiscardMission = async () => {
    if (!missionPreview) return;
    try {
      await invoke("discard_mission_preview", { previewId: missionPreview.preview_id });
      setMissionPreview(null);
      alert("Proposal discarded.");
    } catch (e) {
      alert("Failed to discard proposal: " + e);
    }
  };

  // API Call: Save current proposal settings as reusable Custom Mission Pack
  const handleSaveCustomPack = async () => {
    if (!missionPreview || !customPackName.trim()) {
      alert("Please specify a custom pack name!");
      return;
    }
    try {
      await invoke("save_mission_pack_from_preview", {
        previewId: missionPreview.preview_id,
        name: customPackName
      });
      alert(`💾 Custom Mission Pack '${customPackName}' saved successfully!`);
      setCustomPackName("");
      loadMissionData();
    } catch (e) {
      alert("Failed to save custom pack: " + e);
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
      await invoke("update_autopilot_settings", { settings: payload });
      setAutopilotEnabled(enabled);
      setAutopilotScope(scope);
      setApprovalRequirements(reqs);
      setNetworkPermissions(net);
      setDoneApprovalRules(rules);
      loadMissionData();
    } catch (e) {
      alert("Failed to update autopilot configurations: " + e);
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
      await invoke("create_software_team", { modelProvider: "camelid", modelName: "camelid-default" });
      await loadAgents();
      alert("Turnkey Software Team successfully created!");
    } catch (e) {
      alert("Failed to create software team: " + e);
    }
  };

  const handleCreateCodingSprint = async () => {
    try {
      await invoke("create_coding_sprint", { workspaceId: "default" });
      await loadTasks();
      alert("Tetris coding sprint enqueued into backlog!");
    } catch (e) {
      alert("Failed to create coding sprint: " + e);
    }
  };

  const handleLaunchAgent = async () => {
    try {
      await invoke("create_agent_from_template", {
        templateKey: selectedTemplateKey,
        customizedName: wizardCustomName,
        modelProvider: "camelid",
        modelName: "camelid-default"
      });
      await loadAgents();
      alert(`Agent "${wizardCustomName}" successfully launched into workforce!`);
    } catch (e) {
      alert("Failed to launch agent: " + e);
    }
  };

  const handleDecompose = async (taskId: string) => {
    try {
      setDecomposingTaskId(taskId);
      const proposals = await invoke<SubtaskProposal[]>("decompose_task", { parentTaskId: taskId });
      setDecomposedProposals(proposals);
    } catch (e) {
      alert("Failed to decompose task: " + e);
    }
  };

  const handleApproveSubtasks = async () => {
    try {
      await invoke("approve_subtasks", {
        parentTaskId: decomposingTaskId,
        proposals: decomposedProposals
      });
      setDecomposedProposals([]);
      setDecomposingTaskId("");
      await loadTasks();
      alert("Subtask sprint approved and enqueued successfully!");
    } catch (e) {
      alert("Failed to approve subtasks: " + e);
    }
  };

  const handleResolveCommandApproval = async (taskId: string, approved: boolean) => {
    try {
      await invoke("resolve_command_approval", { taskId, approved });
      await loadSuggestions();
      await loadTasks();
      await loadAgents();
      alert(approved ? "Command execution approved!" : "Command execution rejected.");
    } catch (e) {
      alert("Failed to resolve command approval: " + e);
    }
  };

  const handleSuggestionAction = async (command: string) => {
    try {
      const parts = command.split(":");
      const action = parts[0];
      
      if (action === "restart_agent") {
        const agentId = parts[1];
        await invoke("update_agent", {
          agent: {
            id: agentId,
            status: "idle",
            last_heartbeat: null
          }
        });
        await loadAgents();
        alert("Agent status reset to idle.");
      } else if (action === "approve_task") {
        const taskId = parts[1];
        await invoke("update_task_status", { id: taskId, status: "done", evidencePath: "User manual validation override." });
        await loadTasks();
        alert("Task approved and completed!");
      } else if (action === "accept_handoff") {
        const handoffId = parseInt(parts[1], 10);
        await invoke("resolve_handoff_cmd", { handoffId, resolution: "approved" });
        await loadTasks();
        alert("Agent handoff resolved successfully!");
      } else if (action === "assign_task") {
        const taskId = parts[1];
        const agentId = parts[2];
        await invoke("claim_card", { agentId, cardId: taskId });
        await loadTasks();
        await loadAgents();
        alert("Task claimed and assigned successfully!");
      }
      await loadSuggestions();
    } catch (e) {
      alert("Failed to execute suggestion action: " + e);
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
      alert("Hugging Face Hub Search failed: " + e);
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
      alert("Preflight Check failed: " + e);
    } finally {
      setPreflightLoading(false);
    }
  };

  const handleDownloadModel = async (modelId: string) => {
    try {
      await invoke("queue_model_download", { modelId });
      loadModelCatalog();
      loadStorageUsage();
      loadLocalModels();
      setModelsSubTab("downloads");
    } catch (e) {
      alert("Failed to queue model download: " + e);
    }
  };

  const handlePauseDownload = async (downloadId: string) => {
    try {
      await invoke("pause_model_download", { downloadId });
      loadModelCatalog();
      loadLocalModels();
    } catch (e) {
      alert("Failed to pause download: " + e);
    }
  };

  const handleCancelDownload = async (downloadId: string) => {
    try {
      await invoke("cancel_model_download", { downloadId });
      loadModelCatalog();
      loadStorageUsage();
      loadLocalModels();
    } catch (e) {
      alert("Failed to cancel download: " + e);
    }
  };

  const handleImportLocal = async () => {
    if (!importPath.trim()) {
      alert("Please specify a valid local GGUF file path first.");
      return;
    }
    try {
      await invoke("import_local_model", {
        path: importPath,
        copyIntoStore: importCopy
      });
      alert("Model successfully verified and imported into local catalog!");
      setImportPath("");
      loadModelCatalog();
      loadStorageUsage();
      setModelsSubTab("installed");
    } catch (e) {
      alert("Import failed: " + e);
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
      await invoke("activate_model_scoped", {
        modelId,
        scopeType,
        scopeId
      });
      alert(`Model successfully activated for ${scopeType} (${scopeId})!`);
      loadModelCatalog();
      loadLocalModels();
      if (selectedModelForInspect && selectedModelForInspect.model_id === modelId) {
        handleOpenModelInspect(selectedModelForInspect);
      }
    } catch (e) {
      alert("Activation failed: " + e);
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
      alert("Smoke Test benchmark failed: " + e);
    } finally {
      setSmokeTesting(false);
    }
  };

  const handleDeleteModelSecure = async (modelId: string) => {
    if (!confirm("Are you absolutely sure you want to delete this model? This will permanently erase the local GGUF binary from your hard drive.")) {
      return;
    }
    try {
      await invoke("delete_model", { modelId });
      alert("Model payload successfully deleted.");
      setSelectedModelForInspect(null);
      loadModelCatalog();
      loadStorageUsage();
    } catch (e) {
      alert("Failed to delete model: " + e);
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
      alert(`Backend health check completed! Current state: ${status.state}`);
    } catch (e) {
      alert("Health check command failed: " + e);
    }
  };

  const handleRestartBackend = async () => {
    try {
      const status = await invoke<BackendStatus>("restart_backend", { reason: "user_requested" });
      setBackendStatus(status);
      alert(`Backend successfully restarted! Current state: ${status.state}`);
      handleGetBackendLogs();
    } catch (e) {
      alert("Restart command failed: " + e);
    }
  };

  const handleStopBackend = async () => {
    try {
      const status = await invoke<BackendStatus>("stop_backend");
      setBackendStatus(status);
      alert("Backend inference daemon successfully stopped.");
    } catch (e) {
      alert("Stop command failed: " + e);
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
      await invoke("open_backend_logs");
    } catch (e) {
      alert("Failed to open logs: " + e);
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
      await invoke("save_backend_config_cmd", { newConfig });
      
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
        alert("Supervisor configuration successfully saved!");
      }
      loadBackendStatus();
    } catch (e) {
      alert("Failed to save config: " + e);
    }
  };

  const handleResetBackendRuntime = async () => {
    if (!confirm("Are you sure you want to completely reset the backend runtime supervisor? This will stop the daemon and revert all port and auto-start configurations to standard defaults.")) {
      return;
    }
    try {
      const status = await invoke<BackendStatus>("reset_backend_runtime_state");
      setBackendStatus(status);
      alert("Backend runtime supervisor reset successfully!");
      setFormBinaryPath("");
      setFormBindAddress("127.0.0.1");
      setFormPort(8181);
      setFormLogPath("");
      setFormMaxRestarts(5);
      setFormBackoffPolicy("exponential");
    } catch (e) {
      alert("Failed to reset supervisor state: " + e);
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
      await invoke("resolve_handoff_cmd", { id, status });
      loadCoordinationDetails();
    } catch (e) {
      alert("Failed to resolve handoff: " + e);
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
      await invoke("save_message", {
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
        await invoke("trigger_org_reply", {
          orgNodeType: activeOrgNode.node_type,
          orgNodeId: activeOrgNode.id,
          sessionId,
        });
      } else {
        const targetedAgentId = activeTab === "global" ? "agent-coder" : selectedAgentId;
        await invoke("trigger_agent_reply", {
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
    };

    try {
      await invoke("create_agent", { agent: newAgent });
      setIsSpawnModalOpen(false);
      setSpawnName("");
      setSpawnRole("");
      setSpawnPersona("");
      loadAgents();
    } catch (e) {
      console.error("Failed to spawn agent", e);
    }
  };

  // Save Agent Configuration
  const handleSaveAgentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAgentId || !editName || !editRole) {
      alert("Name and Role are required fields.");
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
    };

    try {
      await invoke("update_agent", { agent: updatedAgent });
      await loadAgents();
      alert(`Agent directive for ${editName} updated successfully!`);
    } catch (err) {
      console.error("Failed to update agent", err);
      alert(`Failed to update agent: ${err}`);
    }
  };

  // Retire Agent Configured
  const handleRetireAgent = async (agentId: string) => {
    if (!confirm(`Are you sure you want to retire Agent ${agents.find((a) => a.id === agentId)?.name || agentId}?`)) {
      return;
    }

    try {
      await invoke("delete_agent", { id: agentId });
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
      alert("Agent retired successfully!");
    } catch (err) {
      console.error("Failed to delete agent", err);
      alert(`Failed to delete agent: ${err}`);
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
      await invoke("create_card", { 
        workspaceId: "default",
        projectId: activeOrgNode?.project_id || null,
        teamId: activeOrgNode?.team_id || null,
        title: taskTitle,
        description: taskDesc || null,
        typeName: "task",
        priority: taskPriority,
        status: "Ready",
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
      alert("Failed to create task: " + err);
    }
  };

  // Transition Card Status general helper
  const handleTransitionStatus = async (taskId: string, nextStatus: string) => {
    try {
      await invoke("update_task_status", {
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
      alert("Failed to transition status: " + err);
    }
  };

  // Claim Card
  const handleClaimCard = async (agentId: string, cardId: string) => {
    try {
      await invoke("claim_card", { agentId, cardId });
      loadTasks();
      // If modal is open, refresh selected task details
      if (selectedKanbanTask && selectedKanbanTask.id === cardId) {
        const list = await invoke<Task[]>("get_tasks");
        const updated = list.find(t => t.id === cardId);
        if (updated) setSelectedKanbanTask(updated);
      }
    } catch (err: any) {
      alert("Failed to claim card: " + err);
    }
  };

  // Complete and Validate Card on Host System
  const handleCompleteCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKanbanTask) return;
    if (!selectedCompletingAgentId) {
      alert("Please select the agent completing the task.");
      return;
    }

    setCompletionError(null);
    try {
      await invoke("complete_card", {
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
      await invoke("update_card_progress", {
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
      alert("Failed to add comment: " + err);
    }
  };

  // Declare Card Blocked via database dependency blockers mapping
  const handleAddBlocker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKanbanTask || !blockerText.trim()) return;
    try {
      await invoke("create_task_blocker", {
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
      alert("Failed to add blocker: " + err);
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
      
      await invoke("update_card_progress", {
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
      alert("Failed to toggle checklist item: " + err);
    }
  };

  // Delete Agent
  const handleDeleteAgent = async (id: string) => {
    if (confirm(`Are you sure you want to retire Agent ${id}?`)) {
      try {
        await invoke("delete_agent", { id });
        loadAgents();
      } catch (e) {
        console.error("Failed to delete agent", e);
      }
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    try {
      await invoke("save_provider_config", {
        provider: "camelid",
        modelName: "camelid-default",
        apiKey: null,
        endpointUrl: camelidUrl,
        isDefault: true,
      });
      await invoke("save_provider_config", {
        provider: "ollama",
        modelName: "qwen2.5-coder",
        apiKey: null,
        endpointUrl: ollamaUrl,
        isDefault: true,
      });
      if (openaiKey) {
        await invoke("save_provider_config", {
          provider: "openai",
          modelName: "gpt-4o",
          apiKey: openaiKey,
          endpointUrl: null,
          isDefault: true,
        });
      }
      if (anthropicKey) {
        await invoke("save_provider_config", {
          provider: "anthropic",
          modelName: "claude-3-5-sonnet",
          apiKey: anthropicKey,
          endpointUrl: null,
          isDefault: true,
        });
      }
      if (blackboardInput) {
        await invoke("update_shared_state", {
          key: "objective",
          value: blackboardInput,
        });
        setBlackboardInput("");
        loadBlackboard();
      }
      alert("Settings saved successfully!");
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
                    await invoke("reveal_backend_binary");
                  } catch(e) {
                    alert("Failed to reveal binary: " + e);
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

  return (
    <div className="app-layout">
      {renderBlockingOverlay()}
      {/* 1. Sidebar Column */}
      <aside className="sidebar" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="sidebar-header" style={{ padding: '16px' }}>
          <div className="sidebar-logo">💻 CAMELEER</div>
        </div>

        <div style={{ padding: '0 16px 16px 16px' }}>
          <button className="sidebar-btn" onClick={() => setIsSpawnModalOpen(true)}>
            🤖 Spawn Custom Agent
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', padding: '0 16px 16px', gap: '4px' }}>
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginBottom: '8px' }}>Workspace</div>
          <button className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>📊 Dashboard</button>
          <button className={`sidebar-nav-item ${activeTab === 'global' ? 'active' : ''}`} onClick={() => setActiveTab('global')}>🌐 Global Feed</button>
          <button className={`sidebar-nav-item ${activeTab === 'kanban' ? 'active' : ''}`} onClick={() => setActiveTab('kanban')}>📋 Task Backlog</button>
          <button className={`sidebar-nav-item ${activeTab === 'missions' ? 'active' : ''}`} onClick={() => setActiveTab('missions')}>🎯 Missions</button>
          <button className={`sidebar-nav-item ${activeTab === 'files' ? 'active' : ''}`} onClick={() => setActiveTab('files')}>🧠 Memory & Files</button>
          
          <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '1px', marginTop: '16px', marginBottom: '8px' }}>Orchestration</div>
          <button className={`sidebar-nav-item ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => setActiveTab('agents')}>🤖 Agents</button>
          <button className={`sidebar-nav-item ${activeTab === 'models' ? 'active' : ''}`} onClick={() => setActiveTab('models')}>⚙️ Local Models</button>
          <button className={`sidebar-nav-item ${activeTab === 'skills' ? 'active' : ''}`} onClick={() => setActiveTab('skills')}>📚 Skills</button>
          <button className={`sidebar-nav-item ${activeTab === 'channels' ? 'active' : ''}`} onClick={() => setActiveTab('channels')}>📡 Channels</button>
          <button className={`sidebar-nav-item ${activeTab === 'system' ? 'active' : ''}`} onClick={() => setActiveTab('system')}>🔌 System</button>
        </div>

        <div style={{ flex: 1, overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <OrgSidebar 
            workspaceId="default" 
            agents={agents}
            onNodeSelect={(node) => {
              setActiveOrgNode(node);
              if (node.node_type === 'agent' && node.agent_id) {
                setSelectedAgentId(node.agent_id);
                setActiveTab("dm");
              } else {
                setActiveTab("org_dashboard");
              }
            }} 
          />
        </div>
      </aside>

      {/* 2. Main Chat/Board panel */}
      <main className="chat-panel">
        <header className="chat-header">
          <div className="chat-title-group">
            {activeTab === "dashboard" ? (
              <div>
                <h2 className="chat-title">Mission Control</h2>
                <div className="chat-subtitle">Turnkey Local AI Workforce Platform Overview</div>
              </div>
            ) : activeTab === "global" ? (
              <div>
                <h2 className="chat-title">#global-room</h2>
                <div className="chat-subtitle">Broadcasting coordination blackboard packet to all active agents</div>
              </div>
            ) : activeTab === "dm" ? (
              <div>
                <h2 className="chat-title">
                  Direct Messages: @
                  {agents.find((a) => a.id === selectedAgentId)?.name || selectedAgentId}
                </h2>
                <div className="chat-subtitle">
                  {agents.find((a) => a.id === selectedAgentId)?.role || "Agent Profile"}
                </div>
              </div>
            ) : activeTab === "kanban" ? (
              <div>
                <h2 className="chat-title">Task Objectives</h2>
                <div className="chat-subtitle">Local Filesystem Coordination Kanban Workspace</div>
              </div>
            ) : activeTab === "skills" ? (
              <div>
                <h2 className="chat-title">Skill Playbooks</h2>
                <div className="chat-subtitle">Dynamic autonomous playbook configurations loaded from workspace</div>
              </div>
            ) : activeTab === "channels" ? (
              <div>
                <h2 className="chat-title">Messaging Surfaces</h2>
                <div className="chat-subtitle">Connect, pair, and audit external communication interfaces</div>
              </div>
            ) : activeTab === "files" ? (
              <div>
                <h2 className="chat-title">Workspace Artifacts</h2>
                <div className="chat-subtitle">Direct local filesystem view of all saved outputs</div>
              </div>
            ) : activeTab === "agents" ? (
              <div>
                <h2 className="chat-title">Crew Control Center</h2>
                <div className="chat-subtitle">Inspect, customize, tune, and hot-swap active agent models</div>
              </div>
            ) : activeTab === "models" ? (
              <div>
                <h2 className="chat-title">Local Inference Models</h2>
                <div className="chat-subtitle">Download and activate optimized GGUF language models running natively via Camelid</div>
              </div>
            ) : activeTab === "org_dashboard" && activeOrgNode ? (
              <div>
                <h2 className="chat-title">{activeOrgNode.display_name}</h2>
                <div className="chat-subtitle">{activeOrgNode.node_type.toUpperCase()} SCOPE</div>
              </div>
            ) : (
              <div>
                <h2 className="chat-title">System Metrics</h2>
                <div className="chat-subtitle">Real-time GGUF local model execution and hardware telemetry</div>
              </div>
            )}
          </div>

          {/* panel-tabs moved to sidebar */}
        </header>

        {activeTab === "dashboard" ? (
          <div className="dashboard-container">
            {/* Dashboard Hero Banner */}
            <div className="dashboard-hero">
              <div className="hero-text">
                <h3>Autonomous AI Crew Operations</h3>
                <p>Natively powered by local GGUF models. Turnkey sprint coordination, safety command auditing, and active state recovery watchdog.</p>
              </div>
              <div className="hero-actions">
                <button className="hero-btn primary" onClick={handleCreateSoftwareTeam}>
                  Launch Software Team
                </button>
                <button className="hero-btn secondary" onClick={handleCreateCodingSprint}>
                  Bootstrap Coding Sprint
                </button>
              </div>
            </div>

            {/* Dashboard Operation Widgets */}
            <div className="dashboard-grid">
              
              {/* AI Crew Heartbeats Widget */}
              <div className="dashboard-card">
                <div className="card-header-group">
                  <div className="card-title">
                    <span style={{ color: "var(--accent-primary)", marginRight: "8px" }}>●</span> Active Crew Heartbeats
                  </div>
                  <span className="telemetry-tag success" style={{ textTransform: "capitalize" }}>{agents.length} specialist(s) active</span>
                </div>
                <div className="crew-grid">
                  {agents.map((agent) => (
                    <div key={agent.id} className="crew-item">
                      <div className="crew-avatar">
                        {agent.name.charAt(0)}
                        <div className={`crew-status-dot ${agent.status}`} />
                      </div>
                      <div className="crew-name">{agent.name}</div>
                      <div className="crew-role">{agent.role}</div>
                      {agent.last_heartbeat && (
                        <div className="crew-hb">HB: {agent.last_heartbeat.slice(-4)}s</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Work Suggestions Stream */}
              <div className="dashboard-card">
                <div className="card-header-group">
                  <div className="card-title">Next Best Actions</div>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{suggestions.length} suggestions</span>
                </div>
                <div className="dashboard-scrollable">
                  {suggestions.length === 0 ? (
                    <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", textAlign: "center", padding: "20px" }}>
                      All systems green. No blockers or idle specialists detected.
                    </div>
                  ) : (
                    suggestions.map((sug) => (
                      <div key={sug.id} className={`suggestion-card ${sug.severity}`}>
                        <div className="suggestion-header">
                          <span className={`suggestion-tag ${sug.severity}`}>{sug.suggestion_type}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{sug.severity}</span>
                        </div>
                        <h4 style={{ fontSize: "0.9rem", fontWeight: "bold" }}>{sug.title}</h4>
                        <div className="suggestion-desc">{sug.description}</div>
                        {sug.action_command && sug.action_label && (
                          <button 
                            className="suggestion-action-btn"
                            onClick={() => handleSuggestionAction(sug.action_command!)}
                          >
                            {sug.action_label}
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Turnkey Specialist Agent wizard */}
              <div className="dashboard-card">
                <div className="card-header-group">
                  <div className="card-title">Agent Builder Wizard</div>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>10 templates ready</span>
                </div>
                <div className="wizard-templates-grid">
                  {templates.slice(0, 4).map((t) => (
                    <div 
                      key={t.key} 
                      className={`wizard-template-card ${selectedTemplateKey === t.key ? "active" : ""}`}
                      onClick={() => {
                        setSelectedTemplateKey(t.key);
                        setWizardCustomName(t.name);
                      }}
                    >
                      <h4>{t.name}</h4>
                      <p>{t.role}</p>
                    </div>
                  ))}
                </div>
                <div className="wizard-config-panel">
                  <div className="wizard-form-group">
                    <label>Agent Custom Call-Sign</label>
                    <input 
                      type="text" 
                      className="wizard-input" 
                      value={wizardCustomName} 
                      onChange={(e) => setWizardCustomName(e.target.value)} 
                    />
                  </div>
                  <div className="wizard-checkboxes">
                    <label className="wizard-checkbox-label">
                      <input type="checkbox" defaultChecked /> Full Files Access
                    </label>
                    <label className="wizard-checkbox-label">
                      <input type="checkbox" defaultChecked /> Shell execution
                    </label>
                    <label className="wizard-checkbox-label">
                      <input type="checkbox" defaultChecked /> Auto-Subtasks
                    </label>
                    <label className="wizard-checkbox-label">
                      <input type="checkbox" defaultChecked /> Review Required
                    </label>
                  </div>
                  <button className="wizard-submit-btn" onClick={handleLaunchAgent}>
                    Launch Agent specialist
                  </button>
                </div>
              </div>

              {/* Smart Subtask Decomposer widget */}
              <div className="dashboard-card">
                <div className="card-header-group">
                  <div className="card-title">Subtask Decomposer</div>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Sprint splitting tool</span>
                </div>
                <div className="decomposer-panel">
                  <div className="wizard-form-group">
                    <label>Choose Parent Task to split</label>
                    <select 
                      className="wizard-select"
                      onChange={(e) => {
                        if (e.target.value) {
                          handleDecompose(e.target.value);
                        }
                      }}
                    >
                      <option value="">-- Select Task Card --</option>
                      {tasks
                        .filter((t) => t.status !== "done" && t.status !== "blocked")
                        .map((t) => (
                          <option key={t.id} value={t.id}>{t.title} ({t.status})</option>
                        ))}
                    </select>
                  </div>

                  {decomposedProposals.length > 0 && (
                    <div className="subtask-proposal-list">
                      <div style={{ fontSize: "0.8rem", fontWeight: "bold", marginBottom: "6px" }}>Proposed Child Sprint Tree:</div>
                      <div className="dashboard-scrollable" style={{ maxHeight: "140px" }}>
                        {decomposedProposals.map((prop) => (
                          <div key={prop.id} className="subtask-proposal-item">
                            <div className="subtask-title-desc">
                              <h5>{prop.title}</h5>
                              <p>{prop.description}</p>
                            </div>
                            <div className="subtask-tags">
                              <span className="subtask-tag role">{prop.preferred_role}</span>
                              <span className={`subtask-tag priority-${prop.priority}`}>{prop.priority}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button className="wizard-submit-btn" style={{ background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }} onClick={handleApproveSubtasks}>
                        Approve Child Sprint
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Command Guard & Security Reviews widget */}
              <div className="dashboard-card" style={{ gridColumn: "span 2" }}>
                <div className="card-header-group">
                  <div className="card-title" style={{ color: "var(--color-blocked)" }}>🛡️ Security Sandbox Review Queue</div>
                  <span className="telemetry-tag success" style={{ background: "rgba(245, 158, 11, 0.1)", color: "var(--color-blocked)" }}>Audit Shield Active</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {tasks.filter((t) => t.status === "waiting_for_approval").length === 0 ? (
                    <div style={{ fontSize: "0.85rem", color: "var(--text-muted)", textAlign: "center", padding: "10px" }}>
                      No blocked agent shell executions requiring security review.
                    </div>
                  ) : (
                    tasks
                      .filter((t) => t.status === "waiting_for_approval")
                      .map((t) => (
                        <div key={t.id} className="review-box" style={{ border: "1px dashed var(--color-blocked)" }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: "bold" }}>
                            ⚠️ Security Warning: Card "{t.title}" is paused. An agent is requesting a high-risk system command execution!
                          </div>
                          <div style={{ fontStyle: "italic", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                            Review is mandatory under the default Moderate Safety Profile whitelist.
                          </div>
                          <div className="review-actions">
                            <button className="review-btn approve" onClick={() => handleResolveCommandApproval(t.id, true)}>
                              Approve & Resume
                            </button>
                            <button className="review-btn reject" onClick={() => handleResolveCommandApproval(t.id, false)}>
                              Reject & Block
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>
          </div>
        ) : activeTab === "global" || activeTab === "dm" || activeTab === "org_dashboard" ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {activeTab === "org_dashboard" && activeOrgNode && (
              <div style={{ flex: "0 0 auto", maxHeight: "45%", borderBottom: "1px solid rgba(255,255,255,0.05)", overflowY: "auto" }}>
                <ProjectDashboard 
                  activeNode={activeOrgNode} 
                  agents={agents}
                  onCardClick={(card) => {
                    setSelectedKanbanTask(card as any);
                    setCompletionError(null);
                    setIsCompletingTask(false);
                    setIsAddingBlocker(false);
                    setIsTaskModalOpen(false); // Make sure modal state is right if used
                    // wait, KanbanBoard in App.tsx just does:
                    // setSelectedKanbanTask(card as any);
                    // setCompletionError(null);
                    // setIsCompletingTask(false);
                    // setIsAddingBlocker(false);
                  }}
                  refreshTrigger={refreshKanban}
                />
              </div>
            )}
            {/* Messages Feed */}
            <div className="messages-feed" style={{ flex: 1, overflowY: "auto" }}>
              {messages.length === 0 && (
                <div style={{ textAlign: "center", color: "var(--text-muted)", marginTop: "40px" }}>
                  No messages in this channel yet. Send a prompt to get started!
                </div>
              )}
              {messages.map((msg, index) => (
                <div key={index} className={`message-bubble ${msg.role}`}>
                  <div className={`message-avatar ${msg.role}`}>
                    {msg.role === "user" ? "U" : msg.sender_id?.charAt(0) || "A"}
                  </div>
                  <div className="message-content-wrapper">
                    <div className="message-sender">
                      {msg.role === "user" ? "You" : agents.find((a) => a.id === msg.sender_id)?.name || msg.sender_id}
                    </div>
                    <div className="message-content">
                      <p style={{ whiteSpace: "pre-wrap" }}>{msg.content}</p>
                    </div>
                  </div>
                </div>
              ))}
              {isThinking && (
                <div className="thinking-indicator">
                  <span>Agent is reasoning</span>
                  <div className="dot-pulse">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
              <div ref={feedEndRef} />
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendMessage} className="chat-input-area">
              <div className="chat-input-wrapper">
                <input
                  className="chat-input"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    activeTab === "global"
                      ? "Broadcast message to the blackboard room..."
                      : `Message @${agents.find((a) => a.id === selectedAgentId)?.name}...`
                  }
                />
                <button type="submit" className="chat-send-btn">
                  →
                </button>
              </div>
            </form>
          </div>
        ) : activeTab === "kanban" ? (
          /* Kanban System */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="kanban-view-toggle" style={{ display: "flex", gap: "8px", background: "rgba(0,0,0,0.2)", padding: "4px", borderRadius: "8px" }}>
                <button 
                  className={`view-toggle-btn ${kanbanView === "board" ? "active" : ""}`}
                  onClick={() => setKanbanView("board")}
                >
                  Active Board
                </button>
                <button 
                  className={`view-toggle-btn ${kanbanView === "backlog" ? "active" : ""}`}
                  onClick={() => setKanbanView("backlog")}
                >
                  Backlog
                </button>
              </div>
              <button className="primary-btn" onClick={() => setIsTaskModalOpen(true)}>
                ➕ New Card
              </button>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
              {kanbanView === "backlog" ? (
                <BacklogView 
                  workspaceId="default" 
                  onItemConverted={() => {
                    setRefreshKanban(prev => prev + 1);
                    setKanbanView("board");
                  }} 
                />
              ) : (
                <KanbanBoard 
                  workspaceId="default" 
                  agents={agents} 
                  onCardClick={(card) => {
                    setSelectedKanbanTask(card as any);
                    setCompletionError(null);
                    setIsCompletingTask(false);
                    setIsAddingBlocker(false);
                  }} 
                  refreshTrigger={refreshKanban}
                />
              )}
            </div>
          </div>
            

        ) : activeTab === "skills" ? (
          /* Skills Page */
          <div className="skills-container" style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            <div className="skills-header-section" style={{ marginBottom: "20px" }}>
              <h3 className="section-subtitle" style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--accent-primary)" }}>🔧 Whitelisted Skill Registry</h3>
              <p className="section-desc" style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>These modular playbooks define host capabilities the agents can autonomously orchestrate under human sandbox boundaries.</p>
            </div>
            <div className="skills-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
              {[
                {
                  id: "file-write",
                  name: "File Saver & Mutator",
                  desc: "Physically saves and updates files on host directories, specifically whitelisted to Desktop. Automatically parses annotations inside markdown blocks.",
                  tools: ["std::fs::write", "std::fs::create_dir_all"],
                  inputs: ["path", "content"],
                  status: "Active & Whitelisted"
                },
                {
                  id: "shell-exec",
                  name: "Host Shell Executor",
                  desc: "Launches shell commands via standard command processes, dynamically feeding outcomes back to agent memory blocks. Safely blocks recursive deletion flags.",
                  tools: ["std::process::Command"],
                  inputs: ["command"],
                  status: "Active & Whitelisted"
                },
                {
                  id: "system-info",
                  name: "System Profiler",
                  desc: "Checks current operating system platforms, gathers active hardware statistics, processes, and logs, compiling rich Markdown system reports.",
                  tools: ["df -h", "ifconfig", "uname", "ps"],
                  inputs: [],
                  status: "Active & Whitelisted"
                },
                {
                  id: "multi-agent",
                  name: "Blackboard Crew Orchestrator",
                  desc: "Triggers joint coordination by feeding the shared awareness blackboard context to multiple agents, allowing concurrent planning and consensus.",
                  tools: ["Blackboard Context Engine"],
                  inputs: ["shared_objective"],
                  status: "Active & Whitelisted"
                },
                {
                  id: "web-crawler",
                  name: "HTML Client & Crawler",
                  desc: "Fetches live web content and APIs using curl under whitelisted network proxies, giving agents basic internet search and read capabilities.",
                  tools: ["curl", "wttr.in"],
                  inputs: ["url"],
                  status: "Active & Whitelisted"
                }
              ].map((skill) => (
                <div key={skill.id} className="skill-card" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ fontWeight: 600, fontSize: "0.95rem" }}>🔧 {skill.name}</h4>
                    <span style={{ fontSize: "0.7rem", color: "var(--color-working)", background: "rgba(16,185,129,0.1)", padding: "2px 8px", borderRadius: "8px", fontWeight: 600 }}>{skill.status}</span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{skill.desc}</p>
                  
                  <div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "4px" }}>System Tools Used:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                      {skill.tools.map((t, i) => (
                        <span key={i} style={{ fontSize: "0.7rem", fontFamily: "var(--font-mono)", background: "rgba(0,242,254,0.08)", color: "var(--accent-primary)", padding: "2px 6px", borderRadius: "4px" }}>{t}</span>
                      ))}
                    </div>
                  </div>

                  {skill.inputs.length > 0 && (
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600, marginBottom: "4px" }}>Parameters Required:</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                        {skill.inputs.map((inp, i) => (
                          <span key={i} style={{ fontSize: "0.7rem", background: "rgba(255,255,255,0.05)", color: "var(--text-main)", padding: "2px 6px", borderRadius: "4px" }}>{inp}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === "channels" ? (
          /* Channels Page */
          <div className="channels-container" style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
            <div className="channels-header-section" style={{ marginBottom: "20px" }}>
              <h3 className="section-subtitle" style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--accent-primary)" }}>💬 External Messaging Channels</h3>
              <p className="section-desc" style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>Pair and audit external communication interfaces. Senders must be approved via the Pairing Code protocol before accessing workspace agents.</p>
            </div>
            <div className="channels-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
              {[
                {
                  id: "telegram",
                  name: "Telegram Gateway",
                  icon: "✈️",
                  status: "Active & Paired",
                  statusCode: "online",
                  desc: "Listening on bot endpoint with default pairing policy enabled.",
                  metric: "Connected as @Cameleer_Bot"
                },
                {
                  id: "discord",
                  name: "Discord Bot Integration",
                  icon: "🎮",
                  status: "Active & Paired",
                  statusCode: "online",
                  desc: "Multi-agent guild listener paired successfully.",
                  metric: "Active in 2 server guilds"
                },
                {
                  id: "whatsapp",
                  name: "WhatsApp Personal Pair",
                  icon: "💬",
                  status: "Pairing Required (QR Code)",
                  statusCode: "pairing",
                  desc: "Awaiting QR scan verification to initialize session flow.",
                  metric: "Click to generate pairing barcode"
                },
                {
                  id: "slack",
                  name: "Slack Workplace Node",
                  icon: "💼",
                  status: "Inactive",
                  statusCode: "offline",
                  desc: "Slack bot user token is missing. Configure in settings.",
                  metric: "Not configured"
                }
              ].map((channel) => (
                <div key={channel.id} className="channel-card" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "1.25rem" }}>{channel.icon}</span>
                      <h4 style={{ fontWeight: 600, fontSize: "0.95rem" }}>{channel.name}</h4>
                    </div>
                    <span style={{
                      fontSize: "0.7rem",
                      color: channel.statusCode === "online" ? "var(--color-working)" : channel.statusCode === "pairing" ? "var(--color-blocked)" : "var(--text-muted)",
                      background: channel.statusCode === "online" ? "rgba(16,185,129,0.1)" : channel.statusCode === "pairing" ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.05)",
                      padding: "2px 8px",
                      borderRadius: "8px",
                      fontWeight: 600
                    }}>{channel.status}</span>
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>{channel.desc}</p>
                  
                  {channel.statusCode === "pairing" && (
                    <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontFamily: "monospace", fontSize: "10px", color: "var(--accent-primary)", opacity: 0.8 }}>
                        <div>■ ■   ■ ■ ■</div>
                        <div>■     ■ ■  </div>
                        <div>■ ■ ■   ■ ■</div>
                        <div>■   ■ ■ ■  </div>
                      </div>
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Scan QR Code with WhatsApp Web Link</span>
                    </div>
                  )}

                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "10px" }}>
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Gateway Details:</div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--accent-primary)", marginTop: "2px" }}>{channel.metric}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === "files" ? (
          /* Files Page */
          <div className="files-container" style={{ flex: 1, display: "flex", height: "100%", overflow: "hidden" }}>
            <div className="files-sidebar" style={{ width: "240px", borderRight: "1px solid var(--border-color)", background: "rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflowY: "auto" }}>
              <div style={{ padding: "16px", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)" }}>Workspace Files</div>
              <div className="files-list" style={{ flex: 1, padding: "8px" }}>
                {artifacts.length === 0 ? (
                  <div style={{ padding: "20px", fontSize: "0.78rem", color: "var(--text-muted)", textAlign: "center" }}>No files generated by agent sandbox yet. Try asking your Coder to save a file!</div>
                ) : (
                  artifacts.map((art) => {
                    const parts = art.path.split("/");
                    const filename = parts[parts.length - 1];
                    let icon = "📄";
                    if (filename.endsWith(".rs")) icon = "🦀";
                    if (filename.endsWith(".py")) icon = "🐍";
                    if (filename.endsWith(".json")) icon = "📦";
                    if (filename.endsWith(".md")) icon = "📝";
                    return (
                      <div
                        key={art.path}
                        className={`file-item ${selectedArtifactPath === art.path ? "active" : ""}`}
                        onClick={() => handleSelectArtifact(art.path)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          cursor: "pointer",
                          marginBottom: "4px",
                          transition: "all 0.2s ease",
                          background: selectedArtifactPath === art.path ? "rgba(0,242,254,0.06)" : "transparent",
                          border: selectedArtifactPath === art.path ? "1px solid rgba(0,242,254,0.15)" : "1px solid transparent"
                        }}
                      >
                        <span style={{ fontSize: "1.1rem" }}>{icon}</span>
                        <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                          <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{filename}</span>
                          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{art.artifact_type}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className="files-preview-pane" style={{ flex: 1, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.25)", overflow: "hidden" }}>
              <div className="files-preview-header" style={{ padding: "12px 20px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--accent-primary)", fontFamily: "var(--font-mono)" }}>
                  {selectedArtifactPath || "No file selected"}
                </span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Workspace Frame View</span>
              </div>
              <pre className="files-code-editor" style={{ flex: 1, margin: 0, padding: "20px", overflow: "auto", background: "transparent", color: "#e2e8f0", fontFamily: "var(--font-mono)", fontSize: "0.82rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                <code>{selectedArtifactContent || "// Select a workspace file from the left column to view its live contents."}</code>
              </pre>
            </div>
          </div>
        ) : activeTab === "missions" ? (
          /* Crew Autonomy & Mission Builder Portal */
          <div className="missions-container" style={{ flex: 1, display: "flex", height: "100%", overflow: "hidden" }}>
            
            {/* Left Column: Outcome Planner & Autopilot Settings */}
            <div className="missions-planner-sidebar" style={{ width: "420px", borderRight: "1px solid var(--border-color)", background: "rgba(0,0,0,0.18)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.08)" }}>
                <h3 style={{ margin: 0, fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", color: "var(--accent-primary)", letterSpacing: "0.5px" }}>
                  🎯 Workspace Outcome Planner
                </h3>
              </div>
              
              <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "24px" }}>
                
                {/* Section 1: Outcome Goal */}
                <div className="card-glass" style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.01)" }}>
                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>
                    Select Accelerating Mission Pack
                  </label>
                  <select
                    value={selectedMissionPack}
                    onChange={(e) => setSelectedMissionPack(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", color: "var(--text-main)", fontSize: "0.82rem", marginBottom: "12px" }}
                  >
                    {missionPacks.map((pack) => (
                      <option key={pack.mission_pack_id} value={pack.mission_pack_id}>
                        {pack.name} ({pack.category})
                      </option>
                    ))}
                  </select>

                  <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "8px" }}>
                    Describe Desired Outcome / Goal
                  </label>
                  <textarea
                    value={outcomeGoal}
                    onChange={(e) => setOutcomeGoal(e.target.value)}
                    placeholder="E.g., Build a Tetris game in HTML/TS with keyboard controls, collision checks, score metrics, and manual..."
                    style={{ width: "100%", height: "90px", padding: "10px", borderRadius: "8px", background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", color: "var(--text-main)", fontSize: "0.82rem", lineHeight: 1.4, resize: "none", marginBottom: "16px", fontFamily: "inherit" }}
                  />

                  <button
                    onClick={handleGenerateProposal}
                    className="btn-primary"
                    style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)", border: "none", color: "#06080c", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", boxShadow: "0 0 15px rgba(0,242,254,0.15)" }}
                  >
                    ✦ Propose Crew & Workboard
                  </button>
                </div>

                {/* Section 2: Autopilot Scope & Dashboard widgets */}
                <div className="card-glass" style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--border-color)", background: "rgba(255,255,255,0.01)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <h4 style={{ margin: 0, fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)", textTransform: "uppercase" }}>
                      🚀 Autopilot Controls
                    </h4>
                    <span style={{ fontSize: "0.68rem", color: autopilotEnabled ? "#10b981" : "var(--text-muted)", background: autopilotEnabled ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.04)", padding: "2px 8px", borderRadius: "6px", fontWeight: "bold" }}>
                      {autopilotEnabled ? "Active" : "Off"}
                    </span>
                  </div>

                  <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.82rem", cursor: "pointer", marginBottom: "14px" }}>
                    <input
                      type="checkbox"
                      checked={autopilotEnabled}
                      onChange={(e) => handleUpdateAutopilotSettings(e.target.checked, autopilotScope, approvalRequirements, networkPermissions, doneApprovalRules)}
                      style={{ width: "16px", height: "16px", accentColor: "var(--accent-primary)" }}
                    />
                    <span>Enable Workspace Autopilot Autonomy</span>
                  </label>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>Autopilot Scope</label>
                      <select
                        value={autopilotScope}
                        onChange={(e) => handleUpdateAutopilotSettings(autopilotEnabled, e.target.value, approvalRequirements, networkPermissions, doneApprovalRules)}
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", color: "var(--text-main)", fontSize: "0.78rem" }}
                      >
                        <option value="off">Off (Manual starts only)</option>
                        <option value="card">Card Autopilot (Current card only)</option>
                        <option value="agent">Agent Autopilot (Assigned cards queue)</option>
                        <option value="mission">Mission Autopilot (Full board coordination)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>Approval Safety Profile</label>
                      <select
                        value={approvalRequirements}
                        onChange={(e) => handleUpdateAutopilotSettings(autopilotEnabled, autopilotScope, e.target.value, networkPermissions, doneApprovalRules)}
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", color: "var(--text-main)", fontSize: "0.78rem" }}
                      >
                        <option value="strict">Strict (Review all file changes & runs)</option>
                        <option value="moderate">Moderate (Freely read, ask on writes)</option>
                        <option value="none">None (Headless run sandbox)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "4px" }}>Network Boundaries</label>
                      <select
                        value={networkPermissions}
                        onChange={(e) => handleUpdateAutopilotSettings(autopilotEnabled, autopilotScope, approvalRequirements, e.target.value, doneApprovalRules)}
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", color: "var(--text-main)", fontSize: "0.78rem" }}
                      >
                        <option value="none">No External Calls (Sandboxed)</option>
                        <option value="whitelist">Whitelisted addresses only</option>
                        <option value="all">Unconstrained network access</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Section 3: Audited Events Terminal Logs */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px" }}>
                  <h4 style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>
                    🛡️ Autopilot Security Audit Log
                  </h4>
                  <div style={{ flex: 1, minHeight: "150px", padding: "12px", borderRadius: "10px", background: "rgba(0,0,0,0.5)", border: "1px solid var(--border-color)", overflowY: "auto", fontFamily: "var(--font-mono)", fontSize: "0.74rem", lineHeight: 1.4, color: "var(--text-muted)" }}>
                    {missionAuditEvents.length === 0 ? (
                      <div style={{ color: "var(--text-muted)" }}>// No audit events logged yet. Active sandboxes will output records here.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {missionAuditEvents.map((ev) => (
                          <div key={ev.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", paddingBottom: "4px" }}>
                            <span style={{ color: "var(--accent-secondary)" }}>[{ev.timestamp.split(" ")[1] || ev.timestamp}]</span>{" "}
                            <span style={{ color: "var(--accent-primary)", fontWeight: "bold" }}>{ev.event_type.toUpperCase()}</span>{" "}
                            <span style={{ color: "var(--text-main)" }}>{ev.payload}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Right Column: Mission Preview Inspector */}
            <div className="missions-proposal-body" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "16px 28px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: "1.0rem", fontWeight: 700, color: "var(--text-main)" }}>
                    {missionPreview ? missionPreview.mission_title : "No Active Proposal"}
                  </h2>
                  <p style={{ margin: "2px 0 0 0", fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    {missionPreview ? `Workspace goal proposal blueprint. Draft generated at ${new Date(parseInt(missionPreview.generated_at) * 1000).toLocaleTimeString()}` : "Formulate a mission goal on the left side to compile a crew and card hierarchy proposal."}
                  </p>
                </div>
                {missionPreview && (
                  <span style={{ fontSize: "0.7rem", color: "var(--accent-primary)", border: "1px solid rgba(0,242,254,0.3)", background: "rgba(0,242,254,0.06)", padding: "2px 8px", borderRadius: "6px", fontWeight: "bold", textTransform: "uppercase" }}>
                    Preview: {missionPreview.status}
                  </span>
                )}
              </div>

              {/* Preview Body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "28px", display: "flex", flexDirection: "column", gap: "28px" }}>
                {!missionPreview ? (
                  /* Empty state */
                  <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", height: "100%", gap: "16px", color: "var(--text-muted)" }}>
                    <div style={{ fontSize: "3.5rem" }}>🤖</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--text-main)" }}>Cameleer Intelligent Workspace Architect</div>
                    <div style={{ fontSize: "0.82rem", maxWidth: "420px", textAlign: "center", lineHeight: 1.4 }}>
                      Enter your desired project goal (e.g., game developers, repository bug fixes, document sweeps) on the outcome planner. Nothing is created on your workspace until you approve the compiled blueprint!
                    </div>
                  </div>
                ) : (
                  /* Preview active state */
                  <>
                    {/* Risks and Assumptions banner */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                      <div style={{ background: "rgba(245,158,11,0.03)", border: "1px solid rgba(245,158,11,0.15)", borderRadius: "10px", padding: "12px 16px" }}>
                        <h4 style={{ margin: "0 0 6px 0", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", color: "#f59e0b" }}>⚠️ Identified Constraints & Risks</h4>
                        <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                          {missionPreview.risks.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                        </ul>
                      </div>
                      <div style={{ background: "rgba(79,172,254,0.03)", border: "1px solid rgba(79,172,254,0.15)", borderRadius: "10px", padding: "12px 16px" }}>
                        <h4 style={{ margin: "0 0 6px 0", fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", color: "var(--accent-secondary)" }}>✦ Key Architecture Assumptions</h4>
                        <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                          {missionPreview.assumptions.map((a: string, idx: number) => <li key={idx}>{a}</li>)}
                        </ul>
                      </div>
                    </div>

                    {/* Proposed Team */}
                    <div>
                      <h3 style={{ fontSize: "0.9rem", fontWeight: 700, textTransform: "uppercase", color: "var(--accent-primary)", letterSpacing: "0.5px", marginBottom: "12px" }}>
                        👥 Proposed Specialized Agent Crew
                      </h3>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
                        {missionPreview.proposed_agents.map((agent: any, idx: number) => (
                          <div key={idx} className="card-glass" style={{ padding: "16px", borderRadius: "12px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: "12px", background: "rgba(255,255,255,0.01)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <input
                                value={agent.name}
                                onChange={(e) => {
                                  const updated = [...missionPreview.proposed_agents];
                                  updated[idx].name = e.target.value;
                                  setMissionPreview({ ...missionPreview, proposed_agents: updated });
                                }}
                                style={{ fontSize: "0.85rem", fontWeight: "bold", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "var(--text-main)", padding: "2px 4px", width: "130px" }}
                              />
                              <button
                                onClick={() => {
                                  const updated = missionPreview.proposed_agents.filter((_: any, i: number) => i !== idx);
                                  setMissionPreview({ ...missionPreview, proposed_agents: updated });
                                }}
                                style={{ background: "none", border: "none", color: "var(--color-blocked)", fontSize: "0.85rem", cursor: "pointer" }}
                              >
                                Remove
                              </button>
                            </div>

                            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                              <strong>Role:</strong> {agent.role}
                            </div>

                            <div>
                              <label style={{ display: "block", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "4px" }}>Inference Model</label>
                              <input
                                value={agent.suggested_model}
                                onChange={(e) => {
                                  const updated = [...missionPreview.proposed_agents];
                                  updated[idx].suggested_model = e.target.value;
                                  setMissionPreview({ ...missionPreview, proposed_agents: updated });
                                }}
                                style={{ width: "100%", padding: "6px", borderRadius: "6px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", color: "var(--text-main)", fontSize: "0.75rem" }}
                              />
                            </div>

                            <div>
                              <label style={{ display: "block", fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "4px" }}>Allowed Tools Scope</label>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                                {agent.allowed_tools.map((t: string, tid: number) => (
                                  <span key={tid} style={{ fontSize: "0.66rem", background: "rgba(124, 77, 255, 0.08)", color: "var(--accent-primary)", padding: "2px 6px", borderRadius: "4px" }}>
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", background: "rgba(255,255,255,0.01)", padding: "8px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.03)", lineClamp: 2, overflow: "hidden" }}>
                              <strong>Rationale:</strong> {agent.rationale || "Seeded template profile."}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Proposed Cards */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <h3 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, textTransform: "uppercase", color: "var(--accent-primary)", letterSpacing: "0.5px" }}>
                          📋 Proposed Kanban Cards Checklist
                        </h3>
                        <button
                          onClick={() => {
                            const newCard = {
                              id: `custom-card-${Date.now()}`,
                              title: "New Custom Task",
                              description: "A customized task card for this sprint.",
                              suggested_agent_role: "Software Engineer",
                              suggested_agent_id: "",
                              priority: "medium",
                              status: "backlog",
                              acceptance_criteria: ["Deliverables completed and validated."],
                              required_files: [],
                              related_files: [],
                              dependencies: [],
                              evidence_gate: "",
                              review_required: false
                            };
                            setMissionPreview({ ...missionPreview, proposed_cards: [...missionPreview.proposed_cards, newCard] });
                          }}
                          className="btn-primary"
                          style={{ padding: "6px 12px", fontSize: "0.76rem", borderRadius: "6px", background: "rgba(0,242,254,0.08)", color: "var(--accent-primary)", border: "1px solid rgba(0,242,254,0.2)" }}
                        >
                          + Add Custom Card
                        </button>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {missionPreview.proposed_cards.map((card: any, idx: number) => (
                          <div key={card.id} className="card-glass" style={{ padding: "16px 20px", borderRadius: "12px", border: "1px solid var(--border-color)", display: "grid", gridTemplateColumns: "1fr 220px 80px", gap: "20px", alignItems: "center", background: "rgba(255,255,255,0.01)" }}>
                            
                            {/* Card Content Edit */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                              <input
                                value={card.title}
                                onChange={(e) => {
                                  const updated = [...missionPreview.proposed_cards];
                                  updated[idx].title = e.target.value;
                                  setMissionPreview({ ...missionPreview, proposed_cards: updated });
                                }}
                                style={{ fontSize: "0.86rem", fontWeight: "bold", background: "none", border: "none", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "var(--text-main)", padding: "2px 4px", width: "100%" }}
                              />
                              <input
                                value={card.description}
                                onChange={(e) => {
                                  const updated = [...missionPreview.proposed_cards];
                                  updated[idx].description = e.target.value;
                                  setMissionPreview({ ...missionPreview, proposed_cards: updated });
                                }}
                                style={{ fontSize: "0.78rem", background: "none", border: "none", color: "var(--text-muted)", padding: "2px 4px", width: "100%" }}
                              />
                              <div style={{ fontSize: "0.7rem", color: "var(--accent-secondary)", opacity: 0.8 }}>
                                <strong>Criteria:</strong> {card.acceptance_criteria.join(", ")}
                              </div>
                            </div>

                            {/* Card Attributes */}
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <div>
                                <label style={{ display: "block", fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "2px" }}>Assigned Owner Role</label>
                                <select
                                  value={card.suggested_agent_role}
                                  onChange={(e) => {
                                    const updated = [...missionPreview.proposed_cards];
                                    updated[idx].suggested_agent_role = e.target.value;
                                    setMissionPreview({ ...missionPreview, proposed_cards: updated });
                                  }}
                                  style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", color: "var(--text-main)", fontSize: "0.72rem" }}
                                >
                                  {missionPreview.proposed_agents.map((ag: any) => (
                                    <option key={ag.role} value={ag.role}>{ag.role} ({ag.name})</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label style={{ display: "block", fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "2px" }}>Priority</label>
                                <select
                                  value={card.priority}
                                  onChange={(e) => {
                                    const updated = [...missionPreview.proposed_cards];
                                    updated[idx].priority = e.target.value;
                                    setMissionPreview({ ...missionPreview, proposed_cards: updated });
                                  }}
                                  style={{ width: "100%", padding: "4px 8px", borderRadius: "4px", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border-color)", color: "var(--text-main)", fontSize: "0.72rem" }}
                                >
                                  <option value="high">High</option>
                                  <option value="medium">Medium</option>
                                  <option value="low">Low</option>
                                </select>
                              </div>
                            </div>

                            {/* Card Removal */}
                            <button
                              onClick={() => {
                                const updated = missionPreview.proposed_cards.filter((c: any) => c.id !== card.id);
                                setMissionPreview({ ...missionPreview, proposed_cards: updated });
                              }}
                              style={{ background: "none", border: "none", color: "var(--color-blocked)", fontSize: "0.8rem", cursor: "pointer", alignSelf: "center" }}
                            >
                              Delete
                            </button>

                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Preview Apply Footer Action panel */}
                    <div className="card-glass" style={{ padding: "20px", borderRadius: "12px", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", background: "rgba(255,255,255,0.01)" }}>
                      <div style={{ display: "flex", gap: "12px" }}>
                        <button
                          onClick={handleApplyMission}
                          className="btn-primary"
                          style={{ padding: "10px 20px", borderRadius: "8px", background: "linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)", border: "none", color: "#06080c", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}
                        >
                          🚀 Approve & Launch Sprint
                        </button>
                        <button
                          onClick={handleDiscardMission}
                          className="btn-secondary"
                          style={{ padding: "10px 20px", borderRadius: "8px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border-color)", color: "var(--text-main)", fontSize: "0.82rem", cursor: "pointer" }}
                        >
                          🚫 Discard Proposal
                        </button>
                      </div>

                      {/* Save As custom pack */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <input
                          value={customPackName}
                          onChange={(e) => setCustomPackName(e.target.value)}
                          placeholder="Pack Name (e.g. Tetris Sprint)"
                          style={{ padding: "8px 12px", borderRadius: "6px", background: "rgba(0,0,0,0.4)", border: "1px solid var(--border-color)", color: "var(--text-main)", fontSize: "0.78rem" }}
                        />
                        <button
                          onClick={handleSaveCustomPack}
                          className="btn-primary"
                          style={{ padding: "8px 14px", borderRadius: "6px", background: "rgba(124, 77, 255, 0.15)", color: "var(--accent-primary)", border: "1px solid rgba(124, 77, 255, 0.3)", fontSize: "0.78rem", cursor: "pointer" }}
                        >
                          💾 Save Pack
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        ) : activeTab === "agents" ? (
          /* Crew Control Page */
          <div className="agents-container" style={{ flex: 1, display: "flex", height: "100%", overflow: "hidden" }}>
            {/* Left Column: Agent Cards Grid */}
            <div className="agents-sidebar" style={{ width: "320px", borderRight: "1px solid var(--border-color)", background: "rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "16px", fontSize: "0.78rem", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Active Agent Crew</span>
                <span className="kanban-column-count">{agents.length}</span>
              </div>
              
              <div className="agents-list" style={{ flex: 1, padding: "12px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                {agents.map((agent) => {
                  const isSelected = editAgentId === agent.id;
                  let providerLabel = "camelid";
                  if (agent.model_provider === "ollama") providerLabel = "ollama";
                  if (agent.model_provider === "openai") providerLabel = "openai";
                  if (agent.model_provider === "anthropic") providerLabel = "anthropic";
                  
                  return (
                    <div
                      key={agent.id}
                      onClick={() => selectAgentForEdit(agent)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "12px",
                        borderRadius: "12px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        background: isSelected ? "rgba(0,242,254,0.06)" : "rgba(255,255,255,0.01)",
                        border: isSelected ? "1px solid rgba(0,242,254,0.25)" : "1px solid var(--border-color)",
                      }}
                    >
                      <div className="agent-avatar" style={{ width: "40px", height: "40px", fontSize: "1.1rem", position: "relative" }}>
                        {agent.name.charAt(0)}
                        <div className={`status-badge ${agent.status}`} style={{ width: "10px", height: "10px", bottom: "-2px", right: "-2px" }} />
                      </div>
                      
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent.name}</span>
                          <span style={{ fontSize: "0.65rem", textTransform: "uppercase", padding: "1px 6px", borderRadius: "6px", background: "rgba(0, 242, 254, 0.08)", color: "var(--accent-primary)", fontWeight: 700 }}>{providerLabel}</span>
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "2px" }}>{agent.role}</div>
                        <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "4px" }}>🤖 {agent.model_name}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: "16px", borderTop: "1px solid var(--border-color)" }}>
                <button className="sidebar-btn" style={{ margin: 0, width: "100%" }} onClick={() => setIsSpawnModalOpen(true)}>
                  ➕ Spawn Custom Agent
                </button>
              </div>
            </div>

            {/* Right Column: Customization Editor */}
            <div className="agent-editor-pane" style={{ flex: 1, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.2)", overflowY: "auto", padding: "24px" }}>
              {!editAgentId ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", color: "var(--text-muted)", gap: "12px", textAlign: "center", padding: "40px" }}>
                  <span style={{ fontSize: "3rem" }}>🧠</span>
                  <h3 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--text-main)" }}>No Agent Selected</h3>
                  <p style={{ fontSize: "0.85rem", maxWidth: "340px", lineHeight: 1.4 }}>Select an active agent from the left crew list to customize their behavior prompts, tune LLM inference parameters, or reassign execution models.</p>
                </div>
              ) : (
                <form onSubmit={handleSaveAgentConfig} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "800px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "20px" }}>
                    <div className="agent-avatar" style={{ width: "56px", height: "56px", fontSize: "1.5rem" }}>
                      {editName.charAt(0) || "?"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--accent-primary)" }}>{editName || "Agent Profile"}</h3>
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Agent ID: <span style={{ fontFamily: "var(--font-mono)" }}>{editAgentId}</span> | Status: <span style={{ textTransform: "capitalize", fontWeight: 600, color: agents.find(a => a.id === editAgentId)?.status === "working" ? "var(--color-working)" : "var(--text-main)" }}>{agents.find(a => a.id === editAgentId)?.status}</span></p>
                    </div>
                  </div>

                  {/* Editable Profile Inputs */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
                    <div className="form-group">
                      <label className="form-label">Agent Display Name</label>
                      <input className="form-input" required value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Sentry Analyst" />
                    </div>
                    
                    <div className="form-group">
                      <label className="form-label">Primary Assigned Role</label>
                      <input className="form-input" required value={editRole} onChange={(e) => setEditRole(e.target.value)} placeholder="e.g. Quality Assurance Sentry" />
                    </div>
                  </div>

                  {/* Model Assignment Section */}
                  <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                    <h4 style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--accent-primary)", display: "flex", alignItems: "center", gap: "6px" }}>🧠 Inference Provider & Model Assignment</h4>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                      <div className="form-group">
                        <label className="form-label">Active Provider</label>
                        <select
                          className="form-input"
                          value={editProvider}
                          onChange={(e) => {
                            setEditProvider(e.target.value);
                            if (e.target.value === "camelid") setEditModelName("camelid-default");
                            else if (e.target.value === "ollama") setEditModelName("qwen2.5-coder");
                            else if (e.target.value === "openai") setEditModelName("gpt-4o");
                            else if (e.target.value === "anthropic") setEditModelName("claude-3-5-sonnet");
                          }}
                          style={{ background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", height: "42px" }}
                        >
                          <option value="camelid">Local Camelid GGUF</option>
                          <option value="ollama">Ollama Local API</option>
                          <option value="openai">OpenAI Cloud API</option>
                          <option value="anthropic">Anthropic Claude API</option>
                        </select>
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">LLM Model Name</label>
                        {(() => {
                          const camelidOptions = [
                            "camelid-default",
                            "tinyllama-1.1b-chat-v1.0.Q8_0.gguf",
                            "Llama-3.2-1B-Instruct-Q8_0.gguf",
                            "Llama-3.2-3B-Instruct-Q8_0.gguf",
                            "Meta-Llama-3-8B-Instruct-Q8_0.gguf",
                            "Mistral-7B-Instruct-v0.3.Q8_0.gguf",
                            ...localModels
                          ];
                          const uniqueCamelid = Array.from(new Set(camelidOptions));
                          const ollamaOptions = ["qwen2.5-coder", "llama3.2", "llama3", "mistral", "deepseek-r1"];
                          const openaiOptions = ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o1-mini", "o1-preview"];
                          const anthropicOptions = ["claude-3-5-sonnet", "claude-3-5-haiku", "claude-3-opus"];

                          let opts: string[] = [];
                          let defaultVal = "";
                          if (editProvider === "camelid") {
                            opts = uniqueCamelid;
                            defaultVal = "camelid-default";
                          } else if (editProvider === "ollama") {
                            opts = ollamaOptions;
                            defaultVal = "qwen2.5-coder";
                          } else if (editProvider === "openai") {
                            opts = openaiOptions;
                            defaultVal = "gpt-4o";
                          } else if (editProvider === "anthropic") {
                            opts = anthropicOptions;
                            defaultVal = "claude-3-5-sonnet";
                          }

                          const isCustom = editModelName !== "" && !opts.includes(editModelName);
                          const selectValue = isCustom ? "__custom__" : (editModelName || defaultVal);

                          return (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <select
                                className="form-input"
                                value={selectValue}
                                onChange={(e) => {
                                  if (e.target.value === "__custom__") {
                                    setEditModelName("");
                                  } else {
                                    setEditModelName(e.target.value);
                                  }
                                }}
                                style={{ background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", height: "42px" }}
                              >
                                {opts.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt === "camelid-default" ? "camelid-default (System Active GGUF)" : opt}
                                  </option>
                                ))}
                                {editProvider !== "camelid" && (
                                  <option value="__custom__">✦ Custom Model Tag...</option>
                                )}
                              </select>
                              {(isCustom || selectValue === "__custom__") && (
                                <input
                                  className="form-input"
                                  required
                                  value={editModelName}
                                  onChange={(e) => setEditModelName(e.target.value)}
                                  placeholder="Type custom tag, e.g. llama3.2:1b"
                                  style={{ marginTop: "4px" }}
                                />
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Multi-Model Telemetry & Concurrency Notice */}
                  <div style={{
                    background: "rgba(0, 242, 254, 0.03)",
                    border: "1px solid rgba(0, 242, 254, 0.15)",
                    borderRadius: "14px",
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px"
                  }}>
                    <span style={{ fontSize: "1.3rem", marginTop: "2px" }}>⚡</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--accent-primary)" }}>Concurrent Multi-Model Routing Active</span>
                      <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.4, margin: 0 }}>
                        Each agent in your crew is fully containerized. By assigning distinct local weights (via Ollama) or cloud engines (via OpenAI/Anthropic), your agents can operate and execute task block dependencies <span style={{ color: "var(--text-main)", fontWeight: 600 }}>simultaneously and concurrently</span>. Use the left crew list to assign specialists to their ideal reasoning model!
                      </p>
                    </div>
                  </div>

                  {/* System Prompt / Persona Directive */}
                  <div className="form-group">
                    <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>📜 Soul Persona & Instructions (SOUL.md)</span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Supports custom ReAct behavior prompts</span>
                    </label>
                    <textarea
                      className="form-input form-textarea"
                      required
                      value={editPersona}
                      onChange={(e) => setEditPersona(e.target.value)}
                      placeholder="Specify agent behaviors, capabilities, and system rules..."
                      style={{ height: "180px", fontFamily: "var(--font-mono)", fontSize: "0.8rem", lineHeight: 1.4 }}
                    />
                  </div>

                  {/* Advanced Parameter Sliders */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px", background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px" }}>
                    <div className="form-group">
                      <label className="form-label">Temperature: {editTemp}</label>
                      <input type="range" min="0.1" max="1.5" step="0.1" value={editTemp} onChange={(e) => setEditTemp(parseFloat(e.target.value))} style={{ width: "100%", accentColor: "var(--accent-primary)", margin: "10px 0" }} />
                      <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>Lower values are more factual, higher values are creative.</span>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Max Token Output Limit</label>
                      <input type="number" className="form-input" value={editMaxTokens} onChange={(e) => setEditMaxTokens(parseInt(e.target.value))} min={64} max={16384} />
                    </div>
                  </div>

                  {/* Behavior Flags */}
                  <div style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    <h4 style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--accent-primary)" }}>🛡️ Safety & Execution Policies</h4>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", userSelect: "none", fontSize: "0.85rem" }}>
                        <input type="checkbox" checked={editContinuous} onChange={(e) => setEditContinuous(e.target.checked)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-main)" }}>Continuous Autonomous Loop Execution</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Agent will automatically plan, run whitelisted shell actions, and self-heal without stopping.</div>
                        </div>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", userSelect: "none", fontSize: "0.85rem", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "10px" }}>
                        <input type="checkbox" checked={editSpawnSubtasks} onChange={(e) => setEditSpawnSubtasks(e.target.checked)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-main)" }}>Spawn Subtask Authority</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Permits the agent to create dependency objectives and delegate subtasks to other crew.</div>
                        </div>
                      </label>

                      <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", userSelect: "none", fontSize: "0.85rem", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "10px" }}>
                        <input type="checkbox" checked={editTalkGlobally} onChange={(e) => setEditTalkGlobally(e.target.checked)} style={{ width: "16px", height: "16px", cursor: "pointer" }} />
                        <div>
                          <div style={{ fontWeight: 600, color: "var(--text-main)" }}>Global Blackboard Broadcasting</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Allows this agent to broadcast state details directly to the shared coordination feed.</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Submit Actions */}
                  <div style={{ display: "flex", gap: "16px", marginTop: "8px", borderTop: "1px solid var(--border-color)", paddingTop: "20px", justifyContent: "flex-end" }}>
                    <button type="button" className="action-btn danger-btn" style={{ margin: 0, padding: "10px 24px" }} onClick={() => handleRetireAgent(editAgentId)}>
                      🚫 Retire Agent from Crew
                    </button>
                    
                    <button type="submit" className="sidebar-btn" style={{ margin: 0, padding: "10px 24px" }}>
                      💾 Save System Directive
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        ) : activeTab === "models" ? (
          /* Scoped Local Models Package Manager Dashboard */
          <div className="models-container" style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
            
            {/* Top Stats Banner */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.15)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <span style={{ fontSize: "1.3rem" }}>🧠</span>
                <div>
                  <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>Local Model Package Manager</h2>
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                    Storage Directory: <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-primary)" }}>{storageUsage?.models_storage_path || "~/.cameleer/models"}</span>
                  </div>
                </div>
              </div>
              
              <div style={{ display: "flex", gap: "20px", fontSize: "0.8rem", alignItems: "center" }}>
                {activeModel && (
                  <>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>ACTIVE GLOBAL MODEL</div>
                      <div style={{ color: "var(--accent-glow)", fontWeight: 700, maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {activeModel}
                      </div>
                    </div>
                    <div style={{ width: "1px", height: "24px", background: "var(--border-color)" }} />
                  </>
                )}
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>TOTAL ALLOCATED STORAGE</div>
                  <div style={{ color: "var(--accent-primary)", fontWeight: 700 }}>
                    {storageUsage ? `${(storageUsage.total_allocated_bytes / 1024 / 1024 / 1024).toFixed(2)} GB` : "0.00 GB"}
                  </div>
                </div>
                <div style={{ width: "1px", height: "24px", background: "var(--border-color)" }} />
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>INSTALLED RUNNABLES</div>
                  <div style={{ color: "var(--color-working)", fontWeight: 700 }}>
                    {storageUsage?.installed_count || 0} Models
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Tabs Selector and Navigation */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.08)", padding: "0 12px" }}>
              {[
                { id: "recommended", label: "🌟 Curated & Recommended", desc: "Seeded tested quants" },
                { id: "installed", label: "💾 Installed Models", desc: "Active local runtimes" },
                { id: "search", label: "🔍 HF Remote Search", desc: "Hugging Face library" },
                { id: "downloads", label: "📥 Downloads Queue", desc: "Background processes" },
                { id: "advanced", label: "⚙️ Advanced & Local Import", desc: "Drag & drop quants" }
              ].map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setModelsSubTab(sub.id as any)}
                  style={{
                    padding: "12px 18px",
                    border: "none",
                    background: "transparent",
                    color: modelsSubTab === sub.id ? "var(--accent-primary)" : "var(--text-muted)",
                    borderBottom: modelsSubTab === sub.id ? "2px solid var(--accent-primary)" : "2px solid transparent",
                    fontSize: "0.8rem",
                    fontWeight: modelsSubTab === sub.id ? 700 : 500,
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* Sub-Tab Panel Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
              
              {/* Tab 1: Recommended Models */}
              {modelsSubTab === "recommended" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
                    {modelsCatalog.filter((m) => m.provider === "curated").map((model) => {
                      const isInstalled = model.install_status === "installed";
                      const isActive = model.active_status;
                      
                      return (
                        <div key={model.model_id} className="card-glass" style={{
                          padding: "24px",
                          borderRadius: "16px",
                          border: isActive ? "1px solid rgba(0, 242, 254, 0.3)" : "1px solid var(--border-color)",
                          background: isActive ? "rgba(0, 242, 254, 0.02)" : "rgba(255,255,255,0.02)",
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          transition: "all 0.3s ease"
                        }}>
                          {isActive && (
                            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #00f2fe, #4facfe)" }} />
                          )}
                          <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                              <span style={{
                                fontSize: "0.65rem",
                                fontWeight: 800,
                                textTransform: "uppercase",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                background: model.compatibility_status === "recommended" ? "rgba(16,185,129,0.08)" : "rgba(245,158,11,0.08)",
                                color: model.compatibility_status === "recommended" ? "#10b981" : "#f59e0b",
                                border: model.compatibility_status === "recommended" ? "1px solid rgba(16,185,129,0.2)" : "1px solid rgba(245,158,11,0.2)"
                              }}>
                                {model.compatibility_status}
                              </span>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                {model.quantization}
                              </span>
                            </div>

                            <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)" }}>
                              {model.display_name}
                            </h3>
                            <div style={{ display: "flex", gap: "10px", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "14px", fontFamily: "var(--font-mono)" }}>
                              <span>Size: {(model.file_size_bytes / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                              <span>•</span>
                              <span>Params: {model.parameter_count}</span>
                            </div>
                            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "20px" }}>
                              {model.license}
                            </p>
                          </div>

                          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "16px", display: "flex", gap: "10px" }}>
                            {isInstalled ? (
                              <>
                                <button onClick={() => handleOpenModelInspect(model)} className="btn-primary" style={{ flex: 1, padding: "8px 12px", fontSize: "0.78rem" }}>
                                  🔍 Inspect Structure
                                </button>
                                <button
                                  onClick={() => handleActivateModelScopedSelect(model.model_id, "global", "default")}
                                  className="action-btn-hover"
                                  disabled={isActive}
                                  style={{
                                    flex: 1,
                                    padding: "8px 12px",
                                    fontSize: "0.78rem",
                                    background: isActive ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.03)",
                                    border: isActive ? "1px solid rgba(16,185,129,0.2)" : "1px solid var(--border-color)",
                                    color: isActive ? "#10b981" : "#fff",
                                    fontWeight: 700,
                                    borderRadius: "8px"
                                  }}
                                >
                                  {isActive ? "✓ Global Active" : "⚙️ Activate"}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleDownloadModel(model.model_id)}
                                className="btn-primary"
                                style={{ width: "100%", padding: "10px" }}
                              >
                                Install Curated Model 📥
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tab 2: Installed Models Grid */}
              {modelsSubTab === "installed" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
                    {modelsCatalog.filter((m) => m.install_status === "installed").length === 0 ? (
                      <div className="card-glass" style={{ padding: "40px", textAlign: "center", gridColumn: "1/-1" }}>
                        <span style={{ fontSize: "2rem" }}>📂</span>
                        <h4 style={{ color: "var(--text-main)", margin: "12px 0 6px 0" }}>No Models Installed Locally Yet</h4>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", maxWidth: "420px", margin: "0 auto" }}>
                          Choose a vetted GGUF quant under the Curated tab or search Hugging Face to install models.
                        </p>
                      </div>
                    ) : (
                      modelsCatalog.filter((m) => m.install_status === "installed").map((model) => {
                        const isActive = model.active_status;
                        return (
                          <div key={model.model_id} className="card-glass" style={{
                            padding: "24px",
                            borderRadius: "16px",
                            border: isActive ? "1px solid rgba(0, 242, 254, 0.3)" : "1px solid var(--border-color)",
                            background: "rgba(255,255,255,0.02)",
                            position: "relative",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "space-between"
                          }}>
                            {isActive && (
                              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "3px", background: "linear-gradient(90deg, #00f2fe, #4facfe)" }} />
                            )}
                            <div>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                                <span style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 800,
                                  textTransform: "uppercase",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  background: model.runnable_status ? "rgba(0, 242, 254, 0.08)" : "rgba(124, 77, 255, 0.08)",
                                  color: model.runnable_status ? "var(--accent-primary)" : "var(--accent-glow)",
                                  border: model.runnable_status ? "1px solid rgba(0, 242, 254, 0.15)" : "1px solid rgba(124, 77, 255, 0.15)"
                                }}>
                                  {model.runnable_status ? "Runnable" : "Inspectable Only"}
                                </span>
                                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                                  {model.quantization}
                                </span>
                              </div>

                              <h3 style={{ margin: "0 0 4px 0", fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)" }}>
                                {model.display_name}
                              </h3>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "14px", fontFamily: "var(--font-mono)" }}>
                                📁 File Size: {(model.file_size_bytes / 1024 / 1024 / 1024).toFixed(2)} GB
                              </div>
                              <div style={{ fontSize: "0.75rem", background: "rgba(0,0,0,0.18)", padding: "10px", borderRadius: "8px", color: "var(--text-muted)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: "20px" }}>
                                Path: {model.local_path}
                              </div>
                            </div>

                            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "16px", display: "flex", gap: "10px" }}>
                              <button onClick={() => handleOpenModelInspect(model)} className="btn-primary" style={{ flex: 1, padding: "8px 12px", fontSize: "0.78rem" }}>
                                🔍 Inspect & Validate
                              </button>
                              <button
                                onClick={() => handleActivateModelScopedSelect(model.model_id, "global", "default")}
                                className="action-btn-hover"
                                disabled={isActive || !model.runnable_status}
                                style={{
                                  flex: 1,
                                  padding: "8px 12px",
                                  fontSize: "0.78rem",
                                  background: isActive ? "rgba(16,185,129,0.1)" : !model.runnable_status ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.03)",
                                  border: "1px solid var(--border-color)",
                                  color: isActive ? "#10b981" : !model.runnable_status ? "rgba(255,255,255,0.1)" : "#fff",
                                  fontWeight: 700,
                                  borderRadius: "8px",
                                  cursor: !model.runnable_status ? "not-allowed" : "pointer"
                                }}
                              >
                                {isActive ? "✓ Global Active" : "⚙️ Activate"}
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Tab 3: Remote HF Search & Preflight */}
              {modelsSubTab === "search" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <input
                      type="text"
                      placeholder="Search Hugging Face GGUF repositories (e.g. bartowski/Llama-3.2)..."
                      value={modelsSearchQuery}
                      onChange={(e) => setModelsSearchQuery(e.target.value)}
                      style={{
                        flex: 1,
                        background: "rgba(0,0,0,0.25)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "10px",
                        color: "#fff",
                        padding: "12px 18px",
                        fontSize: "0.85rem"
                      }}
                    />
                    <select
                      value={modelsFilterQuant}
                      onChange={(e) => setModelsFilterQuant(e.target.value)}
                      style={{
                        background: "rgba(0,0,0,0.25)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "10px",
                        color: "#fff",
                        padding: "0 18px",
                        fontSize: "0.85rem"
                      }}
                    >
                      <option value="all">All Quants Whitelists</option>
                      <option value="Q8_0">Q8_0 Only</option>
                      <option value="Q4_K_M">Q4_K_M Only</option>
                      <option value="IQ4_NL">IQ4_NL Only</option>
                    </select>
                    <button onClick={handleRemoteSearch} className="btn-primary" style={{ padding: "0 24px" }}>
                      Search Hub 🔍
                    </button>
                  </div>

                  {/* Preflight Inspection Drawer inside Search Panel */}
                  {preflightLoading && (
                    <div className="card-glass" style={{ padding: "20px", display: "flex", gap: "16px", alignItems: "center" }}>
                      <div className="loading-spinner-small" style={{ width: "20px", height: "20px" }} />
                      <span style={{ fontSize: "0.85rem", color: "var(--accent-primary)" }}>Fetching remote range bytes metadata preflight checks...</span>
                    </div>
                  )}

                  {preflightReport && (
                    <div className="card-glass" style={{ padding: "24px", border: "1px solid var(--border-color)", borderRadius: "14px", display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h4 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-main)", fontWeight: 700 }}>🔍 GGUF Preflight Range Inspection Report</h4>
                        <span style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: "6px",
                          background: preflightReport.compatibility_tier === "Recommended" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                          color: preflightReport.compatibility_tier === "Recommended" ? "#10b981" : "#ef4444"
                        }}>
                          Tier: {preflightReport.compatibility_tier}
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        <div>• Architecture: <span style={{ color: "#fff", fontWeight: 600 }}>{preflightReport.architecture}</span></div>
                        <div>• GGUF Version: <span style={{ color: "#fff", fontWeight: 600 }}>v{preflightReport.gguf_version}</span></div>
                        <div>• Tensors Parsed: <span style={{ color: "#fff", fontWeight: 600 }}>{preflightReport.tensor_count}</span></div>
                        <div>• Est. RAM overhead: <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>{preflightReport.estimated_memory_required}</span></div>
                      </div>

                      {preflightReport.blockers.length > 0 && (
                        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", padding: "12px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f87171" }}>⚠️ GGUF Compatibility Blockers:</span>
                          {preflightReport.blockers.map((bl, i) => (
                            <div key={i} style={{ fontSize: "0.72rem", color: "#fca5a5" }}>• {bl}</div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "12px", fontSize: "0.8rem" }}>
                        <div style={{ color: "var(--text-muted)" }}>Recommended Action:</div>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>{preflightReport.recommended_action}</div>
                      </div>
                    </div>
                  )}

                  {/* Remote Results */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {remoteModels.length === 0 ? (
                      <div className="card-glass" style={{ padding: "30px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                        Enter search strings to find GGUF models on the Hugging Face hub.
                      </div>
                    ) : (
                      remoteModels.map((entry, idx) => {
                        const existingModel = modelsCatalog.find((m) => m.source_file === entry.filename);
                        const isInstalled = existingModel?.install_status === "installed";
                        const isDownloading = downloadState.downloading && downloadState.model === entry.filename;
                        
                        return (
                          <div key={idx} className="card-glass" style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{entry.repo_id}</div>
                              <h4 style={{ margin: "4px 0", fontSize: "0.9rem", color: "var(--text-main)", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {entry.filename}
                              </h4>
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                File Size: {(entry.size_bytes / 1024 / 1024 / 1024).toFixed(2)} GB
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: "10px" }}>
                              <button onClick={() => handlePreflightCheck(entry)} className="action-btn-hover" style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "transparent", color: "#fff", fontSize: "0.78rem", cursor: "pointer" }}>
                                Preflight Audit 🔍
                              </button>
                              {isInstalled ? (
                                <button disabled style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid rgba(16,185,129,0.2)", background: "rgba(16,185,129,0.05)", color: "#10b981", fontSize: "0.78rem", fontWeight: 700 }}>
                                  ✓ Installed
                                </button>
                              ) : isDownloading ? (
                                <button disabled style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid rgba(0, 242, 254, 0.2)", background: "rgba(0, 242, 254, 0.05)", color: "var(--accent-primary)", fontSize: "0.78rem" }}>
                                  Downloading {downloadState.progress.toFixed(0)}%
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleDownloadModel(existingModel?.model_id || "llama-3.2-3b")}
                                  className="btn-primary"
                                  style={{ padding: "8px 14px", fontSize: "0.78rem" }}
                                >
                                  Install GGUF 📥
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Tab 4: Active Downloads Queue */}
              {modelsSubTab === "downloads" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  {downloadState.downloading ? (
                    <div className="card-glass" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>Downloading Model Payload</h4>
                          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            Filename: {downloadState.model}
                          </span>
                        </div>
                        <span style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--accent-primary)", fontFamily: "var(--font-mono)" }}>
                          {downloadState.progress.toFixed(1)}%
                        </span>
                      </div>

                      <div style={{ height: "10px", background: "rgba(255,255,255,0.05)", borderRadius: "5px", overflow: "hidden", position: "relative" }}>
                        <div style={{
                          height: "100%",
                          background: "linear-gradient(90deg, #00f2fe, #4facfe)",
                          width: `${downloadState.progress}%`,
                          transition: "width 0.2s ease"
                        }} />
                      </div>

                      <div style={{ display: "flex", gap: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "16px", marginTop: "8px" }}>
                        <button onClick={() => handlePauseDownload(`${downloadState.model}-dl`)} className="action-btn-hover" style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid var(--border-color)", background: "transparent", color: "#fff", fontSize: "0.78rem" }}>
                          Pause Download ⏸
                        </button>
                        <button onClick={() => handleCancelDownload(`${downloadState.model}-dl`)} className="action-btn-hover" style={{ padding: "8px 16px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.05)", color: "#ef4444", fontSize: "0.78rem" }}>
                          Cancel & Purge 🚫
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="card-glass" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem" }}>
                      No active model downloads running in the background queue.
                    </div>
                  )}
                </div>
              )}

              {/* Tab 5: Local GGUF Import */}
              {modelsSubTab === "advanced" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  
                  {/* File Import Form */}
                  <div className="card-glass" style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
                    <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>Import Local GGUF File</h3>
                    <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      Import a GGUF model already stored on your hard drive. Cameleer will analyze its tensor structure and register it inside your catalog manifest instantly.
                    </p>

                    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                      <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>Absolute GGUF Path:</label>
                      <input
                        type="text"
                        placeholder="e.g. /Users/timtoole/Downloads/model.gguf"
                        value={importPath}
                        onChange={(e) => setImportPath(e.target.value)}
                        style={{
                          background: "rgba(0,0,0,0.25)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "8px",
                          color: "#fff",
                          padding: "10px 14px",
                          fontSize: "0.82rem"
                        }}
                      />
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem" }}>
                      <input
                        type="checkbox"
                        id="copyCopy"
                        checked={importCopy}
                        onChange={(e) => setImportCopy(e.target.checked)}
                      />
                      <label htmlFor="copyCopy" style={{ color: "var(--text-muted)" }}>
                        Copy file directly into Cameleer's internal model store (Recommended for path consistency)
                      </label>
                    </div>

                    <button onClick={handleImportLocal} className="btn-primary" style={{ padding: "12px", width: "180px", alignSelf: "flex-start" }}>
                      Verify & Import Model 📂
                    </button>
                  </div>

                  {/* Settings toggle */}
                  <div className="card-glass" style={{ padding: "24px" }}>
                    <h3 style={{ margin: "0 0 12px 0", fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>Developer Options</h3>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.8rem" }}>
                      <input
                        type="checkbox"
                        id="devMode"
                        checked={developerMode}
                        onChange={(e) => setDeveloperMode(e.target.checked)}
                      />
                      <label htmlFor="devMode" style={{ color: "var(--text-muted)", fontWeight: 600 }}>
                        Enable Developer Mod (Permits raw overrides and custom activations of unsupported quants)
                      </label>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Model Inspect Details Drawer Panel Overlay */}
            {selectedModelForInspect && (
              <div style={{
                position: "fixed",
                top: 0, right: 0, bottom: 0, left: 0,
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(4px)",
                zIndex: 999,
                display: "flex",
                justifyContent: "flex-end"
              }}>
                <div style={{
                  width: "720px",
                  height: "100%",
                  background: "var(--bg-glass-heavy)",
                  borderLeft: "1px solid var(--border-color)",
                  boxShadow: "-10px 0 40px rgba(0,0,0,0.5)",
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden"
                }}>
                  
                  {/* Drawer Header */}
                  <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.2)" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-primary)" }}>
                        {selectedModelForInspect.display_name}
                      </h3>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>
                        ID: {selectedModelForInspect.model_id}
                      </div>
                    </div>
                    <button onClick={() => setSelectedModelForInspect(null)} style={{ border: "none", background: "transparent", color: "var(--text-muted)", fontSize: "1.4rem", cursor: "pointer" }}>
                      ×
                    </button>
                  </div>

                  {/* Drawer Tabs Navigation */}
                  <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", background: "rgba(0,0,0,0.05)" }}>
                    {[
                      { id: "overview", label: "📋 Overview" },
                      { id: "metadata", label: "⚙️ GGUF Metadata" },
                      { id: "tensors", label: "🧩 Tensor Layout" },
                      { id: "compatibility", label: "🎯 Compatibility" },
                      { id: "smoke", label: "⚡ Smoke Test" }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveModelDetailTab(tab.id as any)}
                        style={{
                          flex: 1,
                          padding: "12px",
                          border: "none",
                          background: "transparent",
                          color: activeModelDetailTab === tab.id ? "var(--accent-primary)" : "var(--text-muted)",
                          borderBottom: activeModelDetailTab === tab.id ? "2px solid var(--accent-primary)" : "2px solid transparent",
                          fontSize: "0.78rem",
                          fontWeight: activeModelDetailTab === tab.id ? 700 : 500,
                          cursor: "pointer"
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Drawer Body Scroll */}
                  <div style={{ flex: 1, overflowY: "auto", padding: "24px" }}>
                    
                    {/* Drawer Tab 1: Overview */}
                    {activeModelDetailTab === "overview" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                        
                        {/* Summary Metrics */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                          <div className="card-glass" style={{ padding: "16px" }}>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>ARCHITECTURE</div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginTop: "4px" }}>
                              {selectedModelForInspect.architecture || "unknown"}
                            </div>
                          </div>
                          <div className="card-glass" style={{ padding: "16px" }}>
                            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>QUANTIZATION TYPE</div>
                            <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#fff", marginTop: "4px" }}>
                              {selectedModelForInspect.quantization || "unknown"}
                            </div>
                          </div>
                        </div>

                        {/* License/Description */}
                        <div className="card-glass" style={{ padding: "20px" }}>
                          <h4 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", fontWeight: 700 }}>Description & Recommendation</h4>
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
                            {selectedModelForInspect.license || "No specific usage notes populated for this local model."}
                          </p>
                        </div>

                        {/* Scoped Activation Control */}
                        <div className="card-glass" style={{ padding: "20px" }}>
                          <h4 style={{ margin: "0 0 12px 0", fontSize: "0.85rem", fontWeight: 700 }}>Scoped Activations Gateway</h4>
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                            
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}>Activate Globally</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Sets this model as default for all workspace flows.</div>
                              </div>
                              <button
                                onClick={() => handleActivateModelScopedSelect(selectedModelForInspect.model_id, "global", "default")}
                                className="btn-primary"
                                style={{ padding: "8px 16px", fontSize: "0.78rem" }}
                              >
                                Activate Global 🚀
                              </button>
                            </div>

                            <div style={{ width: "100%", height: "1px", background: "var(--border-color)" }} />

                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div>
                                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}>Assign to Lead Coder</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Directly binds this model to your coding agent.</div>
                              </div>
                              <button
                                onClick={() => handleActivateModelScopedSelect(selectedModelForInspect.model_id, "agent", "agent-coder")}
                                className="action-btn-hover"
                                style={{ padding: "8px 16px", border: "1px solid var(--border-color)", background: "transparent", color: "#fff", fontSize: "0.78rem" }}
                              >
                                Bind Agent-Coder ⚙️
                              </button>
                            </div>

                          </div>
                        </div>

                        {/* Uninstall Secure Button */}
                        <button
                          onClick={() => handleDeleteModelSecure(selectedModelForInspect.model_id)}
                          style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: "10px",
                            background: "rgba(239,68,68,0.06)",
                            border: "1px solid rgba(239,68,68,0.2)",
                            color: "#f87171",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                        >
                          Uninstall and Delete Model Payload 🗑️
                        </button>

                      </div>
                    )}

                    {/* Drawer Tab 2: GGUF Metadata */}
                    {activeModelDetailTab === "metadata" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <input
                          type="text"
                          placeholder="Filter GGUF metadata keys..."
                          value={metadataSearch}
                          onChange={(e) => setMetadataSearch(e.target.value)}
                          style={{
                            background: "rgba(0,0,0,0.2)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "8px",
                            color: "#fff",
                            padding: "10px 14px",
                            fontSize: "0.8rem"
                          }}
                        />

                        <div style={{ border: "1px solid var(--border-color)", borderRadius: "10px", overflow: "hidden" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", textAlign: "left" }}>
                            <thead>
                              <tr style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid var(--border-color)" }}>
                                <th style={{ padding: "12px" }}>Metadata Key Name</th>
                                <th style={{ padding: "12px" }}>Parsed Value</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modelDetails?.inspection?.gguf_version ? (
                                Object.entries(modelDetails.inspection)
                                  .filter(([k, _]) => k.toLowerCase().includes(metadataSearch.toLowerCase()))
                                  .map(([k, v], idx) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                      <td style={{ padding: "10px 12px", color: "var(--accent-primary)", fontFamily: "var(--font-mono)" }}>{k}</td>
                                      <td style={{ padding: "10px 12px", color: "var(--text-main)", wordBreak: "break-all" }}>{String(v)}</td>
                                    </tr>
                                  ))
                              ) : (
                                <tr>
                                  <td colSpan={2} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                                    No GGUF metadata parsed. Full verification required.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Drawer Tab 3: Tensor Layout */}
                    {activeModelDetailTab === "tensors" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        <input
                          type="text"
                          placeholder="Search tensors in directory layout..."
                          value={tensorSearch}
                          onChange={(e) => setTensorSearch(e.target.value)}
                          style={{
                            background: "rgba(0,0,0,0.2)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "8px",
                            color: "#fff",
                            padding: "10px 14px",
                            fontSize: "0.8rem"
                          }}
                        />

                        <div style={{ border: "1px solid var(--border-color)", borderRadius: "10px", overflow: "hidden" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", textAlign: "left" }}>
                            <thead>
                              <tr style={{ background: "rgba(0,0,0,0.3)", borderBottom: "1px solid var(--border-color)" }}>
                                <th style={{ padding: "12px" }}>Tensor Directory Path</th>
                                <th style={{ padding: "12px" }}>Type</th>
                                <th style={{ padding: "12px" }}>Shape</th>
                                <th style={{ padding: "12px" }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modelDetails?.tensors && modelDetails.tensors.length > 0 ? (
                                modelDetails.tensors
                                  .filter((t) => t.tensor_name.toLowerCase().includes(tensorSearch.toLowerCase()))
                                  .map((t, idx) => (
                                    <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                                      <td style={{ padding: "10px 12px", color: "var(--text-main)", fontFamily: "var(--font-mono)" }}>{t.tensor_name}</td>
                                      <td style={{ padding: "10px 12px", color: "var(--accent-secondary)", fontFamily: "var(--font-mono)" }}>{t.tensor_type}</td>
                                      <td style={{ padding: "10px 12px", color: "var(--text-muted)" }}>{JSON.stringify(t.shape)}</td>
                                      <td style={{ padding: "10px 12px" }}>
                                        <span style={{
                                          fontSize: "0.65rem",
                                          fontWeight: 700,
                                          padding: "2px 6px",
                                          borderRadius: "4px",
                                          background: t.supported ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                                          color: t.supported ? "#10b981" : "#ef4444"
                                        }}>
                                          {t.supported ? "Supported" : "Unsupported"}
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                              ) : (
                                <tr>
                                  <td colSpan={4} style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)" }}>
                                    Tensor map verification pending.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Drawer Tab 4: Compatibility Checklist */}
                    {activeModelDetailTab === "compatibility" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        
                        <h4 style={{ margin: 0, fontSize: "0.9rem", color: "var(--text-main)", fontWeight: 700 }}>🔍 System Validation Pipeline Checklist</h4>
                        
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {[
                            { label: "GGUF File Headers Validation", pass: modelDetails?.inspection?.gguf_version !== undefined, desc: "Magic prefix verification (assert GGUF v2/v3 structures)." },
                            { label: "Architecture Model Compatibility", pass: selectedModelForInspect.runnable_status, desc: "Is architecture whitelisted inside local camelid framework execution loops?" },
                            { label: "Quantized Weights Layout Sanity", pass: selectedModelForInspect.runnable_status, desc: "Verify GGUF contains zero unsupported tensor quant allocations." },
                            { label: "Tokenizer Structure Verification", pass: modelDetails?.inspection?.tokenizer_model !== undefined, desc: "Tokenizer model parameters parsed successfully." }
                          ].map((check, idx) => (
                            <div key={idx} className="card-glass" style={{ padding: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                              <div>
                                <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}>{check.label}</div>
                                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "2px" }}>{check.desc}</div>
                              </div>
                              <span style={{
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                padding: "4px 10px",
                                borderRadius: "6px",
                                background: check.pass ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                                color: check.pass ? "#10b981" : "#ef4444"
                              }}>
                                {check.pass ? "✓ PASS" : "✗ FAILED"}
                              </span>
                            </div>
                          ))}
                        </div>

                      </div>
                    )}

                    {/* Drawer Tab 5: Smoke Testing */}
                    {activeModelDetailTab === "smoke" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                        <div className="card-glass" style={{ padding: "20px" }}>
                          <h4 style={{ margin: "0 0 8px 0", fontSize: "0.85rem", fontWeight: 700 }}>Load Performance Benchmark</h4>
                          <p style={{ margin: 0, fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                            Instruct the local Camelid daemon to load the GGUF model binary, allocate GPU Metal caching, compile prompts, and measure generation tokens speed (TPS) on your hard drive.
                          </p>
                          <button
                            onClick={() => handleRunSmokeLoadingTest(selectedModelForInspect.model_id)}
                            disabled={smokeTesting || !selectedModelForInspect.runnable_status}
                            className="btn-primary"
                            style={{ marginTop: "16px", padding: "10px 20px" }}
                          >
                            {smokeTesting ? "Smoke Testing Runtimes..." : "Run Smoke Test ⚡"}
                          </button>
                        </div>

                        {smokeTestResult && (
                          <div style={{ background: "#0b0f19", border: "1px solid var(--border-color)", borderRadius: "10px", overflow: "hidden" }}>
                            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-color)", background: "rgba(255,255,255,0.03)", fontSize: "0.75rem", fontFamily: "var(--font-mono)", color: "var(--accent-primary)" }}>
                              Diagnostics Log Output Stream
                            </div>
                            <pre style={{
                              margin: 0,
                              padding: "16px",
                              fontSize: "0.78rem",
                              color: "#a5b4fc",
                              fontFamily: "var(--font-mono)",
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.4
                            }}>
                              <code>{smokeTestResult.log_output}</code>
                            </pre>
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                </div>
              </div>
            )}

          </div>
        ) : (
          /* System Page */
          <div className="system-container" style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              
              {/* Telemetry Card 1 */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px" }}>
                <h4 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "12px" }}>🧠 Local Inference (Camelid Runtime Engine)</h4>
                <div style={{ fontSize: "2rem", fontWeight: 700, display: "flex", alignItems: "baseline", gap: "6px" }}>
                  {tps} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>tok/sec</span>
                </div>
                <div style={{ marginTop: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                    <span>Metal GPU Offloading</span>
                    <span>100% Core GPU</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "linear-gradient(90deg, #10b981, #00f2fe)", width: "100%" }} />
                  </div>
                </div>
                <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Engine Daemon:</span>
                    <span style={{ color: "var(--color-working)", fontWeight: 600 }}>ACTIVE (Port 8181)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>GGUF Format:</span>
                    <span>Llama 3.2 3B Instruct</span>
                  </div>
                </div>
              </div>

              {/* Telemetry Card 2 */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px" }}>
                <h4 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "12px" }}>💻 Host CPU Thread Pool</h4>
                <div style={{ fontSize: "2rem", fontWeight: 700 }}>{cpuUsage}%</div>
                <div style={{ marginTop: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                    <span>Tokio Concurrency Load</span>
                    <span>Watchdog Active</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "var(--accent-primary)", width: `${cpuUsage}%`, transition: "width 0.5s ease" }} />
                  </div>
                </div>
                <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Watchdog Loop:</span>
                    <span>5000ms Sleep</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Active Threads:</span>
                    <span>4 Async Pools</span>
                  </div>
                </div>
              </div>

              {/* Telemetry Card 3 */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px" }}>
                <h4 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "12px" }}>💾 OS Memory Allocations</h4>
                <div style={{ fontSize: "2rem", fontWeight: 700, display: "flex", alignItems: "baseline", gap: "6px" }}>
                  {ramUsage} <span style={{ fontSize: "0.85rem", color: "var(--text-muted)", fontWeight: 500 }}>GB</span>
                </div>
                <div style={{ marginTop: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                    <span>RAM Allocated (OS + Model)</span>
                    <span>{( (ramUsage / 16.0) * 100 ).toFixed(1)}%</span>
                  </div>
                  <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                    <div style={{ height: "100%", background: "var(--accent-secondary)", width: `${(ramUsage / 16.0) * 100}%`, transition: "width 0.5s ease" }} />
                  </div>
                </div>
                <div style={{ marginTop: "12px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "8px", display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.75rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Total System RAM:</span>
                    <span>16.00 GB</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Swap Memory:</span>
                    <span>0.00 GB</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Model Failover/Priority Sequences */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent-primary)", marginBottom: "6px" }}>🤖 Dynamic Model Failover Sequence</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.4 }}>If a model provider fails (e.g. cloud rate limits or daemon swap latency), Cameleer will autonomously cascade tasks down the priority chain:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {modelPriority.map((model, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      background: idx === 0 ? "rgba(0,242,254,0.05)" : "rgba(255,255,255,0.01)",
                      border: idx === 0 ? "1px solid rgba(0,242,254,0.25)" : "1px solid var(--border-color)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: idx === 0 ? "var(--accent-primary)" : "var(--text-muted)" }}>#{idx + 1}</span>
                      <div>
                        <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{model}</div>
                        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "1px" }}>
                          {idx === 0 ? "ACTIVE PRIMARY - Camelid GGUF GPU" : idx === 1 ? "STANDBY LOCAL GGUF" : "CLOUD API FAILOVER"}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {idx > 0 && (
                        <button
                          onClick={() => {
                            const newP = [...modelPriority];
                            const temp = newP[idx];
                            newP[idx] = newP[idx - 1];
                            newP[idx - 1] = temp;
                            setModelPriority(newP);
                          }}
                          style={{ background: "rgba(255,255,255,0.04)", border: "none", color: "#fff", width: "24px", height: "24px", borderRadius: "6px", cursor: "pointer", fontSize: "0.7rem" }}
                        >
                          ▲
                        </button>
                      )}
                      {idx < modelPriority.length - 1 && (
                        <button
                          onClick={() => {
                            const newP = [...modelPriority];
                            const temp = newP[idx];
                            newP[idx] = newP[idx + 1];
                            newP[idx + 1] = temp;
                            setModelPriority(newP);
                          }}
                          style={{ background: "rgba(255,255,255,0.04)", border: "none", color: "#fff", width: "24px", height: "24px", borderRadius: "6px", cursor: "pointer", fontSize: "0.7rem" }}
                        >
                          ▼
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>

            {/* Backend Runtime Supervisor Control & Telemetry Panel */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px", marginTop: "16px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent-primary)", marginBottom: "6px" }}>🔌 Backend Runtime Supervisor</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.4 }}>
                Monitor status and modify supervisor policies for the local GGUF inference engine daemon (Camelid Runtime). Single source of truth.
              </p>

              {/* Status details sub-card */}
              <div style={{ background: "rgba(0,0,0,0.15)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "16px", marginBottom: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", fontSize: "0.8rem" }}>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "2px" }}>SUPERVISED STATUS</span>
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
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "2px" }}>PROCESS ID (PID)</span>
                    <span style={{ fontWeight: 600 }}>{backendStatus?.pid || "None"}</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "2px" }}>ACTIVE PORT / BIND</span>
                    <span style={{ fontWeight: 600 }}>{backendStatus?.bind_address || "127.0.0.1"}:{backendStatus?.port || 8181}</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "2px" }}>ENGINE VERSION</span>
                    <span style={{ fontWeight: 600 }}>{backendStatus?.version || "N/A"}</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "2px" }}>ACTIVE MODEL</span>
                    <span style={{ fontWeight: 600, color: "var(--accent-primary)" }}>{backendStatus?.active_model || "None"}</span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "2px" }}>MODEL LOADED</span>
                    <span style={{ fontWeight: 600, color: backendStatus?.model_loaded ? "var(--color-working)" : "var(--text-muted)" }}>
                      {backendStatus?.model_loaded ? "YES" : "NO"}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "2px" }}>RESTART ATTEMPTS</span>
                    <span style={{ fontWeight: 600, color: (backendStatus?.restart_count || 0) > 0 ? "var(--color-blocked)" : "var(--text-main)" }}>
                      {backendStatus?.restart_count || 0} / 5
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-muted)", display: "block", fontSize: "0.7rem", textTransform: "uppercase", marginBottom: "2px" }}>LAST HEALTH CHECK</span>
                    <span style={{ fontWeight: 600, fontSize: "0.75rem" }}>
                      {backendStatus?.last_health_check_at ? new Date(parseInt(backendStatus.last_health_check_at) * 1000).toLocaleTimeString() : "Never"}
                    </span>
                  </div>
                </div>
                
                {backendStatus?.last_error && (
                  <div style={{ marginTop: "12px", padding: "10px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "6px", fontSize: "0.75rem", color: "#f87171" }}>
                    <span style={{ fontWeight: 700 }}>Last Error:</span> {backendStatus.last_error}
                  </div>
                )}
                
                <div style={{ marginTop: "12px", fontSize: "0.72rem", color: "var(--text-muted)", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "8px" }}>
                  <span style={{ fontWeight: 600 }}>Log File Location:</span> <code style={{ color: "var(--accent-secondary)", fontFamily: "var(--font-mono)" }}>{backendStatus?.log_path || "~/.cameleer/camelid.log"}</code>
                </div>
              </div>

              {/* Log stream view inside settings */}
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", textAlign: "left", marginBottom: "16px" }}>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px" }}>Live Log Console Stream</span>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "16px" }}>
                <button onClick={handleCheckBackendHealth} className="action-btn">
                  🔄 Check Status
                </button>
                <button onClick={handleRestartBackend} className="action-btn" style={{ background: "rgba(16, 185, 129, 0.1)", borderColor: "rgba(16, 185, 129, 0.25)", color: "#10b981" }}>
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
                    await invoke("reveal_backend_binary");
                  } catch(e) {
                    alert("Failed to reveal binary: " + e);
                  }
                }} className="action-btn">
                  🔍 Reveal Backend Binary
                </button>
                <button onClick={handleResetBackendRuntime} className="action-btn danger-btn" style={{ marginLeft: "auto" }}>
                  ⚠️ Reset Runtime State
                </button>
              </div>

              {/* Configuration Fields Grid */}
              <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "12px" }}>⚙️ Supervisor Policies</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px", justifyContent: "center" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", cursor: "pointer", userSelect: "none" }}>
                    <input 
                      type="checkbox" 
                      checked={formAutoStart} 
                      onChange={(e) => setFormAutoStart(e.target.checked)} 
                      style={{ cursor: "pointer" }}
                    />
                    Auto-start backend on app launch
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", cursor: "pointer", userSelect: "none" }}>
                    <input 
                      type="checkbox" 
                      checked={formAutoRestart} 
                      onChange={(e) => setFormAutoRestart(e.target.checked)} 
                      style={{ cursor: "pointer" }}
                    />
                    Auto-restart backend if it crashes
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.82rem", cursor: "pointer", userSelect: "none" }}>
                    <input 
                      type="checkbox" 
                      checked={formStopOnExit} 
                      onChange={(e) => setFormStopOnExit(e.target.checked)} 
                      style={{ cursor: "pointer" }}
                    />
                    Stop backend when Cameleer closes
                  </label>
                </div>
                
                <div className="form-group">
                  <label className="form-label">Backend Port</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formPort}
                    onChange={(e) => setFormPort(parseInt(e.target.value) || 8181)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Bind Address</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formBindAddress}
                    onChange={(e) => setFormBindAddress(e.target.value)}
                    placeholder="127.0.0.1"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Max Crash Restarts (2 min window)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formMaxRestarts}
                    onChange={(e) => setFormMaxRestarts(parseInt(e.target.value) || 5)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Restart Backoff Policy</label>
                  <select
                    className="form-input"
                    value={formBackoffPolicy}
                    onChange={(e) => setFormBackoffPolicy(e.target.value)}
                    style={{ background: "rgba(0, 0, 0, 0.3)", color: "#fff" }}
                  >
                    <option value="exponential">Exponential Backoff</option>
                    <option value="linear">Linear Backoff</option>
                  </select>
                </div>
              </div>

              {/* Developer Configuration / Advanced Section */}
              <details style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "12px", marginBottom: "16px" }}>
                <summary style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-muted)", cursor: "pointer", userSelect: "none" }}>
                  🛠️ Developer / Advanced Options (Overhead overrides)
                </summary>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "12px" }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Backend Binary Path (Leave empty for default bundled)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formBinaryPath}
                      onChange={(e) => setFormBinaryPath(e.target.value)}
                      placeholder="e.g. /usr/local/bin/camelid"
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Custom Log Path (Leave empty for default ~/.cameleer/camelid.log)</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formLogPath}
                      onChange={(e) => setFormLogPath(e.target.value)}
                      placeholder="e.g. /var/log/camelid.log"
                    />
                  </div>
                </div>
              </details>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="sidebar-btn" style={{ margin: 0, padding: "10px 24px" }} onClick={handleSaveBackendConfig}>
                  Save Supervisor Config
                </button>
              </div>
            </div>

            {/* OS Gateway & Camelid Configurations */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px", marginTop: "16px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent-primary)", marginBottom: "6px" }}>⚙️ OS Gateway & Camelid Runtime Configurations</h3>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "16px", lineHeight: 1.4 }}>Configure active connection gateways, local GGUF Metal endpoints, and cloud keys to power your local agent crew.</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
                <div className="form-group">
                  <label className="form-label">Global Goal Blackboard</label>
                  <input
                    className="form-input"
                    value={blackboardInput}
                    onChange={(e) => setBlackboardInput(e.target.value)}
                    placeholder="e.g. Save hello.rs to my Desktop"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Camelid GGUF Endpoint</label>
                  <input
                    className="form-input"
                    value={camelidUrl}
                    onChange={(e) => setCamelidUrl(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Ollama API URL</label>
                  <input
                    className="form-input"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">OpenAI Key (Cloud)</label>
                  <input
                    type="password"
                    className="form-input"
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Anthropic Key (Cloud)</label>
                  <input
                    type="password"
                    className="form-input"
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                  />
                </div>
              </div>
              
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
                <button className="sidebar-btn" style={{ margin: 0, padding: "10px 24px" }} onClick={handleSaveSettings}>
                  Save OS Settings
                </button>
              </div>
            </div>

          </div>
        )}
      </main>

      {/* 3. Right Inspector panel */}
      <aside className="inspector-panel" style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
        {/* Tab Navigation */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", marginBottom: "16px", flexShrink: 0 }}>
          <button
            onClick={() => setInspectorTab("snapshot")}
            style={{
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
            }}
          >
            🧠 Project Brain
          </button>
          <button
            onClick={() => setInspectorTab("profile")}
            style={{
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
            }}
          >
            👤 Agent Profile
          </button>
        </div>

        {inspectorTab === "profile" ? (
          /* Agent Profile Tab */
          <section className="inspector-section" style={{ flex: 1 }}>
            <div className="inspector-section-title">Agent Profile</div>
            {agents.find((a) => a.id === selectedAgentId) ? (
              (() => {
                const currentAgent = agents.find((a) => a.id === selectedAgentId)!;
                return (
                  <div className="inspector-details">
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
                      <div className="inspector-value" style={{ textTransform: "capitalize" }}>
                        {currentAgent.status}
                      </div>
                    </div>
                    <button
                      className="action-btn danger-btn"
                      style={{ marginTop: "10px" }}
                      onClick={() => handleDeleteAgent(currentAgent.id)}
                    >
                      Retire Agent
                    </button>
                  </div>
                );
              })()
            ) : (
              <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                No agent selected. Click on an agent in the sidebar to inspect.
              </div>
            )}
          </section>
        ) : (
          /* Project Brain Snapshot Tab */
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Active Workspace Banner */}
            <section className="inspector-section" style={{ marginBottom: 0 }}>
              <div className="inspector-section-title" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span>📁 Active Workspace</span>
                <span className="live-telemetry-status" style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 1.5s infinite" }} />
              </div>
              {(() => {
                const activeWs = coordinationDetails.workspaces.find(w => w.active === 1) || { name: "Default Workspace", path: "~/Desktop" };
                return (
                  <div style={{ background: "rgba(255, 255, 255, 0.02)", border: "1px solid var(--border-color)", borderRadius: "10px", padding: "12px" }}>
                    <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--text-main)" }}>{activeWs.name}</div>
                    <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: "4px", wordBreak: "break-all" }}>{activeWs.path}</div>
                  </div>
                );
              })()}
            </section>

            {/* Crew statuses */}
            <section className="inspector-section" style={{ marginBottom: 0 }}>
              <div className="inspector-section-title">Crew Statuses</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "180px", overflowY: "auto" }}>
                {agents.map((a) => (
                  <div key={a.id} style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: "rgba(255, 255, 255, 0.01)",
                    border: "1px solid rgba(255, 255, 255, 0.04)",
                    borderRadius: "8px"
                  }}>
                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--text-main)" }}>{a.name}</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{a.role}</div>
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
                  </div>
                ))}
              </div>
            </section>

            {/* Dynamic Handoffs gateway */}
            <section className="inspector-section" style={{ marginBottom: 0 }}>
              <div className="inspector-section-title">Handoffs Gateway</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                {coordinationDetails.handoffs.length === 0 ? (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", padding: "12px", border: "1px dashed var(--border-color)", borderRadius: "8px" }}>
                    No coordination handoffs registered.
                  </div>
                ) : (
                  coordinationDetails.handoffs.map((ho) => (
                    <div key={ho.id} style={{
                      padding: "10px",
                      background: "rgba(255, 255, 255, 0.02)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", fontWeight: 700 }}>
                        <span style={{ color: "var(--accent-primary)" }}>{ho.source_agent_id} ➔ {ho.target_agent_id}</span>
                        <span style={{
                          color: ho.status === "completed" ? "#10b981" : ho.status === "accepted" ? "var(--accent-secondary)" : "#f59e0b",
                          background: ho.status === "completed" ? "rgba(16, 185, 129, 0.08)" : ho.status === "accepted" ? "rgba(79, 172, 254, 0.08)" : "rgba(245, 158, 11, 0.08)",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          textTransform: "uppercase",
                          fontSize: "0.6rem"
                        }}>{ho.status}</span>
                      </div>
                      <div style={{ fontSize: "0.76rem", color: "var(--text-main)", lineHeight: 1.3 }}>{ho.reason}</div>
                      
                      {/* Action buttons based on status */}
                      {ho.status === "pending" && (
                        <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                          <button
                            onClick={() => handleResolveHandoff(ho.id!, "accepted")}
                            style={{
                              flex: 1,
                              padding: "4px 8px",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              background: "rgba(16, 185, 129, 0.15)",
                              border: "1px solid rgba(16, 185, 129, 0.3)",
                              color: "#10b981",
                              borderRadius: "4px",
                              cursor: "pointer"
                            }}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleResolveHandoff(ho.id!, "rejected")}
                            style={{
                              flex: 1,
                              padding: "4px 8px",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              background: "rgba(239, 68, 68, 0.15)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              color: "#f87171",
                              borderRadius: "4px",
                              cursor: "pointer"
                            }}
                          >
                            Reject
                          </button>
                        </div>
                      )}

                      {ho.status === "accepted" && (
                        <button
                          onClick={() => handleResolveHandoff(ho.id!, "completed")}
                          style={{
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
                          }}
                        >
                          Complete Tasks
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Decisions list & Inline logger */}
            <section className="inspector-section" style={{ marginBottom: 0 }}>
              <div className="inspector-section-title">Engineering Decisions</div>
              
              {/* Manual Input Logger */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                <input
                  className="form-input"
                  style={{ height: "32px", fontSize: "0.78rem", padding: "0 8px", margin: 0 }}
                  placeholder="Record dynamic decision..."
                  value={newDecisionText}
                  onChange={(e) => setNewDecisionText(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      if (!newDecisionText.trim()) return;
                      try {
                        const activeWs = coordinationDetails.workspaces.find(w => w.active === 1) || { id: "default" };
                        await invoke("record_decision_cmd", {
                          workspaceId: activeWs.id,
                          decision: newDecisionText,
                          decidedBy: "User"
                        });
                        setNewDecisionText("");
                        loadCoordinationDetails();
                      } catch (err) {
                        alert("Failed to record decision: " + err);
                      }
                    }
                  }}
                />
                <button
                  style={{
                    padding: "0 10px",
                    background: "rgba(0, 242, 254, 0.1)",
                    border: "1px solid rgba(0, 242, 254, 0.3)",
                    color: "#fff",
                    borderRadius: "6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer"
                  }}
                  onClick={async () => {
                    if (!newDecisionText.trim()) return;
                    try {
                      const activeWs = coordinationDetails.workspaces.find(w => w.active === 1) || { id: "default" };
                      await invoke("record_decision_cmd", {
                        workspaceId: activeWs.id,
                        decision: newDecisionText,
                        decidedBy: "User"
                      });
                      setNewDecisionText("");
                      loadCoordinationDetails();
                    } catch (err) {
                      alert("Failed to record decision: " + err);
                    }
                  }}
                >
                  Record
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "160px", overflowY: "auto" }}>
                {coordinationDetails.decisions.length === 0 ? (
                  <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center", padding: "12px", border: "1px dashed var(--border-color)", borderRadius: "8px" }}>
                    No decisions recorded yet.
                  </div>
                ) : (
                  coordinationDetails.decisions.map((dec) => (
                    <div key={dec.id} style={{
                      padding: "8px",
                      background: "rgba(255, 255, 255, 0.01)",
                      border: "1px solid rgba(255,255,255,0.03)",
                      borderRadius: "6px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.64rem", color: "var(--text-muted)", marginBottom: "4px" }}>
                        <span>👤 Decided by: {dec.decided_by || "System"}</span>
                        <span>{dec.timestamp}</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-main)", lineHeight: 1.3 }}>{dec.decision}</div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Shared Awareness Terminal */}
            <section className="inspector-section">
              <div className="inspector-section-title">Shared Awareness Terminal</div>
              <div
                style={{
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
                }}
              >
                {blackboardText}
              </div>
            </section>

          </div>
        )}
      </aside>

      {/* 4. Spawn Custom Agent Modal */}
      {isSpawnModalOpen && (
        <div className="modal-overlay">
          <form className="modal-content" onSubmit={handleSpawnAgent}>
            <div className="modal-title">🤖 Spawn Custom Agent Persona</div>
            
            <div className="form-group">
              <label className="form-label">Agent Name</label>
              <input
                className="form-input"
                required
                value={spawnName}
                onChange={(e) => setSpawnName(e.target.value)}
                placeholder="e.g. Sentry Analyst"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Agent Role</label>
              <input
                className="form-input"
                required
                value={spawnRole}
                onChange={(e) => setSpawnRole(e.target.value)}
                placeholder="e.g. Quality Assurance Sentry"
              />
            </div>

            <div className="form-group">
              <label className="form-label">System Persona Description</label>
              <textarea
                className="form-input form-textarea"
                required
                value={spawnPersona}
                onChange={(e) => setSpawnPersona(e.target.value)}
                placeholder="Detailed behavioral persona rules..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Inference Provider</label>
              <select
                className="form-input"
                value={spawnProvider}
                onChange={(e) => {
                  setSpawnProvider(e.target.value);
                  if (e.target.value === "camelid") setSpawnModel("camelid-default");
                  else if (e.target.value === "ollama") setSpawnModel("qwen2.5-coder");
                  else if (e.target.value === "openai") setSpawnModel("gpt-4o");
                  else if (e.target.value === "anthropic") setSpawnModel("claude-3-5-sonnet");
                }}
                style={{ background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
              >
                <option value="camelid">Local Camelid GGUF</option>
                <option value="ollama">Ollama Local API</option>
                <option value="openai">OpenAI Cloud API</option>
                <option value="anthropic">Anthropic Claude API</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Model Name</label>
              {(() => {
                const camelidOptions = [
                  "camelid-default",
                  "tinyllama-1.1b-chat-v1.0.Q8_0.gguf",
                  "Llama-3.2-1B-Instruct-Q8_0.gguf",
                  "Llama-3.2-3B-Instruct-Q8_0.gguf",
                  "Meta-Llama-3-8B-Instruct-Q8_0.gguf",
                  "Mistral-7B-Instruct-v0.3.Q8_0.gguf",
                  ...localModels
                ];
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
                const selectValue = isCustom ? "__custom__" : (spawnModel || defaultVal);

                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <select
                      className="form-input"
                      value={selectValue}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          setSpawnModel("");
                        } else {
                          setSpawnModel(e.target.value);
                        }
                      }}
                      style={{ background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", height: "42px" }}
                    >
                      {opts.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt === "camelid-default" ? "camelid-default (System Active GGUF)" : opt}
                        </option>
                      ))}
                      {spawnProvider !== "camelid" && (
                        <option value="__custom__">✦ Custom Model Tag...</option>
                      )}
                    </select>
                    {(isCustom || selectValue === "__custom__") && (
                      <input
                        className="form-input"
                        required
                        value={spawnModel}
                        onChange={(e) => setSpawnModel(e.target.value)}
                        placeholder="Type custom tag, e.g. llama3.2:1b"
                        style={{ marginTop: "4px" }}
                      />
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="form-group" style={{ flexDirection: "row", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <input
                type="checkbox"
                id="continuous-run"
                checked={spawnContinuous}
                onChange={(e) => setSpawnContinuous(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <label htmlFor="continuous-run" className="form-label" style={{ cursor: "pointer", userSelect: "none" }}>
                Continuous Autonomous Loop Execution
              </label>
            </div>

            <div style={{ display: "flex", gap: "16px" }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Temperature ({spawnTemp})</label>
                <input
                  type="range"
                  min="0.1"
                  max="1.5"
                  step="0.1"
                  value={spawnTemp}
                  onChange={(e) => setSpawnTemp(parseFloat(e.target.value))}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Max Tokens</label>
                <input
                  type="number"
                  className="form-input"
                  value={spawnMaxTokens}
                  onChange={(e) => setSpawnMaxTokens(parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="modal-buttons">
              <button type="button" className="action-btn" onClick={() => setIsSpawnModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="sidebar-btn" style={{ margin: 0 }}>
                Launch Agent
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 5. Create Task Modal */}
      {isTaskModalOpen && (
        <div className="modal-overlay">
          <form className="modal-content" style={{ width: "560px" }} onSubmit={handleCreateTask}>
            <div className="modal-title">➕ Create Kanban Objective</div>
            
            <div className="form-group">
              <label className="form-label">Task Title</label>
              <input
                className="form-input"
                required
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="e.g. Implement safety validation in parser"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Task Description</label>
              <textarea
                className="form-input form-textarea"
                value={taskDesc}
                onChange={(e) => setTaskDesc(e.target.value)}
                placeholder="Add technical requirements, goals, or context..."
                style={{ height: "70px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label">Assignee Owner</label>
                <select
                  className="form-input"
                  value={taskOwner}
                  onChange={(e) => setTaskOwner(e.target.value)}
                  style={{ background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", height: "40px" }}
                >
                  <option value="">unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Objective Priority</label>
                <select
                  className="form-input"
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value)}
                  style={{ background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", height: "40px" }}
                >
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
                return (
                  <div style={{ background: "rgba(0, 242, 254, 0.05)", border: "1px solid rgba(0, 242, 254, 0.2)", borderRadius: "8px", padding: "8px 12px", fontSize: "0.76rem", color: "var(--accent-primary)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <span>✨</span>
                    <span><strong>Recommendation:</strong> Assign to <strong>{rec.name}</strong> ({rec.role}) based on task keywords.</span>
                  </div>
                );
              }
              return null;
            })()}

            <div className="form-group">
              <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>📋 Acceptance Criteria (One per line)</span>
                <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Becomes checklist</span>
              </label>
              <textarea
                className="form-input form-textarea"
                value={taskAcceptanceCriteria}
                onChange={(e) => setTaskAcceptanceCriteria(e.target.value)}
                placeholder="e.g. Write standard unit test&#10;Verify compilation on local machine"
                style={{ height: "60px", fontSize: "0.8rem" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div className="form-group">
                <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>📂 Required Files</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Host path checks</span>
                </label>
                <input
                  className="form-input"
                  value={taskRequiredFiles}
                  onChange={(e) => setTaskRequiredFiles(e.target.value)}
                  placeholder="e.g. ~/Desktop/hello.rs"
                  style={{ fontSize: "0.8rem" }}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>⛓️ Dependencies</span>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Comma-sep task IDs</span>
                </label>
                <input
                  className="form-input"
                  value={taskDependencies}
                  onChange={(e) => setTaskDependencies(e.target.value)}
                  placeholder="e.g. task-9h8f"
                  style={{ fontSize: "0.8rem" }}
                />
              </div>
            </div>

            <div className="modal-buttons">
              <button type="button" className="action-btn" onClick={() => setIsTaskModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="sidebar-btn" style={{ margin: 0 }}>
                Enqueue Objective
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 6. Card Details Modal */}
      {selectedKanbanTask && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-large" style={{ display: "flex", flexDirection: "column", height: "80vh" }}>
            
            {/* Modal Header */}
            <div style={{ padding: "20px 28px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(0,0,0,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--accent-primary)", background: "rgba(0,242,254,0.06)", padding: "2px 8px", borderRadius: "6px", border: "1px solid rgba(0,242,254,0.15)" }}>
                  {selectedKanbanTask.id}
                </span>
                <span style={{ fontSize: "0.76rem", textTransform: "uppercase", padding: "2px 8px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", fontWeight: 700 }}>
                  {selectedKanbanTask.status}
                </span>
                <span className={`kanban-card-priority ${selectedKanbanTask.priority}`} style={{ fontSize: "0.75rem" }}>
                  {selectedKanbanTask.priority} Priority
                </span>
              </div>
              <button 
                onClick={() => setSelectedKanbanTask(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: "1.25rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 340px", overflow: "hidden" }}>
              
              {/* Left Column: Context, Checklist, Timeline */}
              <div style={{ padding: "28px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "24px", borderRight: "1px solid var(--border-color)" }}>
                <div>
                  <h2 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "8px" }}>
                    {selectedKanbanTask.title}
                  </h2>
                  <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", lineHeight: 1.5, background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.03)", borderRadius: "10px", padding: "12px" }}>
                    {selectedKanbanTask.description || "No description provided."}
                  </p>
                </div>

                {/* Acceptance Checklist */}
                <div>
                  <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--accent-primary)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "12px" }}>
                    📋 Acceptance Criteria Checklist
                  </h4>
                  {(() => {
                    const criteria = safeParseJson<string[]>(selectedKanbanTask.acceptance_criteria, []);
                    if (criteria.length === 0) {
                      return <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No acceptance checklist defined for this card.</div>;
                    }
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {criteria.map((item, idx) => {
                          const isChecked = item.startsWith("[x]");
                          const cleanText = item.replace(/^\[[ x]\]\s*/, "");
                          return (
                            <label key={idx} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "0.85rem", cursor: "pointer", padding: "6px 10px", background: "rgba(255,255,255,0.01)", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.02)" }}>
                              <input 
                                type="checkbox" 
                                checked={isChecked} 
                                onChange={() => handleToggleChecklistItem(idx, isChecked)}
                                style={{ width: "16px", height: "16px", accentColor: "var(--accent-primary)" }}
                              />
                              <span style={{ textDecoration: isChecked ? "line-through" : "none", color: isChecked ? "var(--text-muted)" : "var(--text-main)" }}>
                                {cleanText}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Required Files Presence Checks */}
                <div>
                  <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--accent-primary)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "12px" }}>
                    📂 Physical Host File Requirements
                  </h4>
                  {(() => {
                    const reqFiles = safeParseJson<string[]>(selectedKanbanTask.required_files, []);
                    if (reqFiles.length === 0) {
                      return <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>No host file constraints required for this card.</div>;
                    }
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {reqFiles.map((file, idx) => {
                          // Simple check: does this file match any of our artifacts?
                          const filename = file.split("/").pop();
                          const existsInArtifacts = artifacts.some(art => art.path.endsWith(filename || "---"));
                          
                          return (
                            <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "rgba(0,0,0,0.15)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
                              <span style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)", color: "var(--text-main)" }}>{file}</span>
                              {existsInArtifacts ? (
                                <span style={{ fontSize: "0.7rem", color: "#10b981", background: "rgba(16,185,129,0.08)", padding: "2px 8px", borderRadius: "6px", fontWeight: "bold" }}>
                                  ✓ Saved in Workspace
                                </span>
                              ) : (
                                <span style={{ fontSize: "0.7rem", color: "var(--color-blocked)", background: "rgba(245,158,11,0.08)", padding: "2px 8px", borderRadius: "6px", fontWeight: "bold" }}>
                                  ✗ Awaiting Sandbox Write
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Related files list */}
                {(() => {
                  const relFiles = safeParseJson<string[]>(selectedKanbanTask.related_files, []);
                  if (relFiles.length > 0) {
                    return (
                      <div>
                        <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", color: "var(--accent-primary)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "12px" }}>
                          🔗 Linked Sandbox Mutations
                        </h4>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {relFiles.map((file, idx) => (
                            <span 
                              key={idx} 
                              onClick={() => {
                                // Try to display this in the Files tab if it exists
                                const art = artifacts.find(a => a.path.endsWith(file.split("/").pop() || "---"));
                                if (art) {
                                  setActiveTab("files");
                                  handleSelectArtifact(art.path);
                                  setSelectedKanbanTask(null);
                                } else {
                                  alert(`File path: ${file}`);
                                }
                              }}
                              style={{ fontSize: "0.72rem", fontFamily: "var(--font-mono)", background: "rgba(79, 172, 254, 0.08)", color: "var(--accent-secondary)", border: "1px solid rgba(79, 172, 254, 0.2)", padding: "4px 8px", borderRadius: "6px", cursor: "pointer" }}
                            >
                              📄 {file.split("/").pop()}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Bounded Agent Contract */}
                {activeContract && (
                  <div style={{ marginTop: "20px", background: "rgba(124, 77, 255, 0.04)", border: "1px solid rgba(124, 77, 255, 0.15)", padding: "16px", borderRadius: "12px" }}>
                    <h4 style={{ fontSize: "0.82rem", textTransform: "uppercase", color: "var(--accent-primary)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                      🛡️ Bounded Agent Contract ({activeContract.role})
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      <div><strong>Responsibilities:</strong>
                        <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                          {activeContract.responsibilities.map((r: string, idx: number) => <li key={idx}>{r}</li>)}
                        </ul>
                      </div>
                      <div><strong>Allowed Tools:</strong> {activeContract.allowed_actions.join(", ") || "None"}</div>
                      <div><strong>Definition of Done:</strong> {activeContract.done_definition.join(", ") || "None"}</div>
                    </div>
                  </div>
                )}

                {/* Validated Work Receipt */}
                {activeReceipt && (
                  <div style={{ marginTop: "20px", background: "rgba(16, 185, 129, 0.04)", border: "1px solid rgba(16, 185, 129, 0.15)", padding: "16px", borderRadius: "12px" }}>
                    <h4 style={{ fontSize: "0.82rem", textTransform: "uppercase", color: "#10b981", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                      📄 Validated Work Receipt Evidence
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      <div><strong>Summary:</strong> {activeReceipt.summary}</div>
                      <div><strong>Files Created:</strong> {activeReceipt.files_created.join(", ") || "None"}</div>
                      <div><strong>Files Modified:</strong> {activeReceipt.files_modified.join(", ") || "None"}</div>
                      <div><strong>Commands Executed:</strong> {activeReceipt.commands_run.join(", ") || "None"}</div>
                      <div><strong>Tests Run:</strong> {activeReceipt.tests_run.join(", ") || "None"}</div>
                      <div><strong>Validation Status:</strong> <span style={{ color: "#10b981", fontWeight: "bold" }}>{activeReceipt.validation_status.toUpperCase()}</span></div>
                      <div><strong>Completed At:</strong> {new Date(parseInt(activeReceipt.completed_at) * 1000).toLocaleString()}</div>
                    </div>
                  </div>
                )}

                {/* Task Decomposition Trigger */}
                {selectedKanbanTask.status !== "done" && (
                  <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-color)", paddingTop: "15px" }}>
                    <h4 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "10px" }}>
                      ⚡ Smart Card Actions
                    </h4>
                    <button
                      onClick={() => {
                        handleDecompose(selectedKanbanTask.id);
                        setSelectedKanbanTask(null);
                      }}
                      className="btn-primary"
                      style={{ display: "flex", alignItems: "center", gap: "8px", background: "rgba(0, 242, 254, 0.1)", border: "1px solid rgba(0, 242, 254, 0.3)", padding: "8px 12px", borderRadius: "8px", color: "var(--accent-primary)", fontSize: "0.78rem", cursor: "pointer", transition: "all 0.2s ease" }}
                    >
                      📋 Break into child cards...
                    </button>
                  </div>
                )}

                {/* Tabs for Timeline and Comments */}
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                  <div style={{ display: "flex", gap: "16px", borderBottom: "1px solid rgba(255,255,255,0.04)", marginBottom: "16px" }}>
                    <button 
                      onClick={() => setModalDetailsTab("log")}
                      style={{ background: "none", border: "none", paddingBottom: "10px", fontSize: "0.8rem", fontWeight: 700, color: modalDetailsTab === "log" ? "var(--accent-primary)" : "var(--text-muted)", borderBottom: modalDetailsTab === "log" ? "2px solid var(--accent-primary)" : "2px solid transparent", cursor: "pointer" }}
                    >
                      ⚙️ Agent Activity Timeline
                    </button>
                    <button 
                      onClick={() => setModalDetailsTab("comments")}
                      style={{ background: "none", border: "none", paddingBottom: "10px", fontSize: "0.8rem", fontWeight: 700, color: modalDetailsTab === "comments" ? "var(--accent-primary)" : "var(--text-muted)", borderBottom: modalDetailsTab === "comments" ? "2px solid var(--accent-primary)" : "2px solid transparent", cursor: "pointer" }}
                    >
                      💬 Collaboration Comments
                    </button>
                  </div>

                  {modalDetailsTab === "log" ? (
                    /* timeline component */
                    <div className="timeline-container">
                      {(() => {
                        const logs = timelineEntries;
                        if (logs.length === 0) {
                          return <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "10px 0" }}>No coordination logs recorded.</div>;
                        }
                        return logs.map((entry, idx) => {
                          const dateStr = new Date(entry.timestamp * 1000).toLocaleString();
                          return (
                            <div key={idx} className="timeline-item">
                              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: "4px", fontWeight: 600 }}>
                                <span>🤖 {entry.agent_id} • <span style={{ color: "var(--accent-primary)" }}>{entry.action}</span></span>
                                <span>{dateStr}</span>
                              </div>
                              <div style={{ fontSize: "0.78rem", color: "var(--text-main)", lineHeight: 1.4 }}>
                                {entry.detail}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    /* comments list + input */
                    <div>
                      <div style={{ maxHeight: "250px", overflowY: "auto", marginBottom: "16px" }}>
                        {(() => {
                          const comments = safeParseJson<any[]>(selectedKanbanTask.comments, []);
                          if (comments.length === 0) {
                            return <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "10px 0" }}>No comments. Start the crew discussion below!</div>;
                          }
                          return comments.map((c, idx) => {
                            const dateStr = new Date(c.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            return (
                              <div key={idx} className="comment-bubble">
                                <div className="comment-header">
                                  <span>👤 {c.author}</span>
                                  <span>{dateStr}</span>
                                </div>
                                <div style={{ color: "var(--text-main)" }}>{c.text}</div>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      <div style={{ display: "flex", gap: "8px" }}>
                        <input
                          className="form-input"
                          style={{ flex: 1, height: "36px", fontSize: "0.82rem" }}
                          value={detailCommentText}
                          onChange={(e) => setDetailCommentText(e.target.value)}
                          placeholder="Type collaborative message..."
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddComment();
                          }}
                        />
                        <button className="sidebar-btn" style={{ margin: 0, padding: "0 16px", height: "36px", fontSize: "0.8rem" }} onClick={handleAddComment}>
                          Send
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Actions, Assignee, Blockers */}
              <div style={{ padding: "28px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "24px", background: "rgba(0,0,0,0.1)" }}>
                
                {/* Assignee Details */}
                <div>
                  <h4 style={{ fontSize: "0.82rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "8px" }}>
                    👤 Active Assigned Specialist
                  </h4>
                  <select
                    className="form-input"
                    value={selectedKanbanTask.assigned_agent_id || selectedKanbanTask.owner_id || ""}
                    onChange={(e) => {
                      const nextAgent = e.target.value;
                      if (nextAgent) {
                        handleTransitionStatus(selectedKanbanTask.id, "assigned");
                        // Manually trigger DB change to save assignee
                        invoke("update_task_status", { id: selectedKanbanTask.id, status: "assigned", evidencePath: null })
                          .then(() => {
                            // Update local owner too
                            loadTasks();
                          });
                      } else {
                        handleTransitionStatus(selectedKanbanTask.id, "backlog");
                      }
                    }}
                    style={{ width: "100%", background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", height: "40px" }}
                  >
                    <option value="">unassigned</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role})
                      </option>
                    ))}
                  </select>

                  {/* Dynamic smart assignee tip */}
                  {!selectedKanbanTask.assigned_agent_id && (
                    (() => {
                      const rec = recommendAgentForTask(selectedKanbanTask.title, selectedKanbanTask.description);
                      if (rec) {
                        return (
                          <div style={{ marginTop: "8px", background: "rgba(0, 242, 254, 0.04)", border: "1px solid rgba(0, 242, 254, 0.15)", borderRadius: "8px", padding: "8px 10px", fontSize: "0.72rem", color: "var(--accent-primary)" }}>
                            💡 <strong>Recommended Specialist:</strong> {rec.name}
                          </div>
                        );
                      }
                      return null;
                    })()
                  )}
                </div>

                {/* Blocker & Dependencies */}
                <div>
                  <h4 style={{ fontSize: "0.82rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "8px" }}>
                    ⛓️ Dependencies & Blockers
                  </h4>
                  
                  {(() => {
                    const blockersList = safeParseJson<any[]>(selectedKanbanTask.blockers, []);
                    if (blockersList.length === 0) {
                      return <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "10px" }}>No active blockers.</div>;
                    }
                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
                        {blockersList.map((blk, idx) => (
                          <div key={idx} style={{ padding: "8px", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.15)", borderRadius: "6px", fontSize: "0.74rem", color: "#f87171" }}>
                            <strong>Blocked:</strong> {blk.reason || blk}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {!isAddingBlocker ? (
                    <button className="action-btn" style={{ width: "100%", fontSize: "0.75rem" }} onClick={() => setIsAddingBlocker(true)}>
                      ⚠️ Declare Blocked Dependency
                    </button>
                  ) : (
                    <form onSubmit={handleAddBlocker} style={{ background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <input
                        className="form-input"
                        required
                        value={blockerText}
                        onChange={(e) => setBlockerText(e.target.value)}
                        placeholder="Blocker reason..."
                        style={{ fontSize: "0.75rem", height: "30px" }}
                      />
                      <select
                        className="form-input"
                        value={blockedByTaskId}
                        onChange={(e) => setBlockedByTaskId(e.target.value)}
                        style={{ fontSize: "0.75rem", height: "30px", background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                      >
                        <option value="">No task dependency</option>
                        {tasks.filter(t => t.id !== selectedKanbanTask.id).map(t => (
                          <option key={t.id} value={t.id}>{t.id} - {t.title}</option>
                        ))}
                      </select>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button type="submit" className="sidebar-btn" style={{ margin: 0, flex: 1, height: "26px", fontSize: "0.7rem", padding: 0 }}>
                          Save Blocker
                        </button>
                        <button type="button" className="action-btn" style={{ flex: 1, height: "26px", fontSize: "0.7rem", padding: 0 }} onClick={() => setIsAddingBlocker(false)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Specialist Action Controls */}
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px" }}>
                  <h4 style={{ fontSize: "0.82rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "12px" }}>
                    ⚙️ Sandbox Specialists Controls
                  </h4>
                  
                  {isCompletingTask ? (
                    /* complete form */
                    <form onSubmit={handleCompleteCard} style={{ display: "flex", flexDirection: "column", gap: "10px", background: "rgba(16, 185, 129, 0.03)", border: "1px solid rgba(16, 185, 129, 0.15)", padding: "14px", borderRadius: "10px" }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#10b981" }}>Complete & Validate Task</div>
                      
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.7rem" }}>Signed Specialist Agent</label>
                        <select
                          className="form-input"
                          required
                          value={selectedCompletingAgentId}
                          onChange={(e) => setSelectedCompletingAgentId(e.target.value)}
                          style={{ fontSize: "0.76rem", height: "30px", background: "#0a0d14" }}
                        >
                          <option value="">Select agent...</option>
                          {agents.map(a => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.7rem" }}>Attached Validation Evidence</label>
                        <input
                          className="form-input"
                          required
                          value={evidenceText}
                          onChange={(e) => setEvidenceText(e.target.value)}
                          placeholder="Evidence bundle path or text..."
                          style={{ fontSize: "0.76rem", height: "30px" }}
                        />
                      </div>

                      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.76rem", cursor: "pointer" }}>
                        <input 
                          type="checkbox" 
                          checked={validationPassed}
                          onChange={(e) => setValidationPassed(e.target.checked)}
                        />
                        <span>Checklist Validation Passed</span>
                      </label>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: "0.7rem" }}>Validation Explanatory Note</label>
                        <textarea
                          className="form-input"
                          value={validationNotes}
                          onChange={(e) => setValidationNotes(e.target.value)}
                          placeholder="Optional explanation notes..."
                          style={{ fontSize: "0.76rem", height: "40px", resize: "none" }}
                        />
                      </div>

                      {/* Detailed failure warnings from Host Filesystem */}
                      {completionError && (
                        <div style={{ padding: "8px 10px", background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "8px", fontSize: "0.72rem", color: "#f87171", lineHeight: 1.3 }}>
                          <strong>⚠️ Validation Failure:</strong> {completionError}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "6px" }}>
                        <button type="submit" className="sidebar-btn" style={{ margin: 0, flex: 1, background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", borderColor: "#10b981", color: "#fff", fontSize: "0.74rem", height: "32px", padding: 0 }}>
                          ✓ Run Complete
                        </button>
                        <button type="button" className="action-btn" style={{ flex: 1, fontSize: "0.74rem", height: "32px", padding: 0 }} onClick={() => setIsCompletingTask(false)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    /* active specialist trigger buttons */
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      
                      {selectedKanbanTask.status !== "in_progress" && (
                        <div style={{ display: "flex", gap: "8px" }}>
                          <select
                            className="form-input"
                            value={selectedClaimingAgentId}
                            onChange={(e) => setSelectedClaimingAgentId(e.target.value)}
                            style={{ flex: 1, fontSize: "0.78rem", height: "36px", background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
                          >
                            <option value="">Claim as Agent...</option>
                            {agents.map(a => (
                              <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                          </select>
                          <button 
                            className="sidebar-btn" 
                            style={{ margin: 0, padding: "0 12px", height: "36px", fontSize: "0.78rem" }}
                            onClick={() => {
                              if (!selectedClaimingAgentId) {
                                alert("Please select an agent to claim the card.");
                                return;
                              }
                              handleClaimCard(selectedClaimingAgentId, selectedKanbanTask.id);
                            }}
                          >
                            Claim
                          </button>
                        </div>
                      )}

                      {selectedKanbanTask.status === "in_progress" && (
                        <button 
                          className="action-btn" 
                          style={{ width: "100%", background: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.15)", color: "#fbbf24" }}
                          onClick={() => handleTransitionStatus(selectedKanbanTask.id, "ready")}
                        >
                          ⏸ Pause Sandbox Work
                        </button>
                      )}

                      {selectedKanbanTask.status !== "review" && selectedKanbanTask.status !== "done" && (
                        <button 
                          className="action-btn" 
                          style={{ width: "100%", background: "rgba(0,242,254,0.05)", borderColor: "rgba(0,242,254,0.15)", color: "var(--accent-primary)" }}
                          onClick={() => handleTransitionStatus(selectedKanbanTask.id, "review")}
                        >
                          👀 Request Technical Review
                        </button>
                      )}

                      {selectedKanbanTask.status !== "done" && (
                        <button 
                          className="sidebar-btn" 
                          style={{ margin: 0, width: "100%", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", borderColor: "#10b981", color: "#fff" }}
                          onClick={() => {
                            setCompletionError(null);
                            setIsCompletingTask(true);
                          }}
                        >
                          ✓ Validate & Complete Task
                        </button>
                      )}
                    </div>
                  )}

                </div>
              </div>

            </div>

          </div>
        </div>
      )}
    </div>
  );
}

export default App;
