import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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
  title: string;
  description: string | null;
  owner_id: string | null;
  status: string;
  priority: string;
  parent_id: string | null;
  evidence_path: string | null;
  created_at?: string;
  updated_at?: string;
}

interface ProviderConfig {
  id?: number;
  provider: string;
  model_name: string;
  api_key: string | null;
  endpoint_url: string | null;
  is_default: boolean;
}
function App() {
  const [activeTab, setActiveTab] = useState<"global" | "dm" | "kanban" | "skills" | "channels" | "files" | "system" | "agents" | "models">("global");
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [blackboardText, setBlackboardText] = useState<string>("");
  const [inputText, setInputText] = useState<string>("");
  
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

  // 1. Initial Load of Database contents
  useEffect(() => {
    loadAgents();
    loadTasks();
    loadBlackboard();
    loadProviderConfigs();
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

  useEffect(() => {
    loadLocalModels();
  }, []);

  useEffect(() => {
    const intervalTime = downloadState.downloading ? 1000 : 5000;
    const timer = setInterval(() => {
      loadLocalModels();
    }, intervalTime);
    return () => clearInterval(timer);
  }, [downloadState.downloading]);

  const handleDownloadModel = async (modelId: string) => {
    try {
      await invoke("download_model", { modelId });
      loadLocalModels();
    } catch (e: any) {
      alert("Failed to start download: " + e);
    }
  };

  const handleActivateModel = async (modelFilename: string) => {
    try {
      await invoke("activate_model", { modelName: modelFilename });
      loadLocalModels();
    } catch (e: any) {
      alert("Failed to activate model: " + e);
    }
  };

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
      const sessionId = activeTab === "global" ? "global" : `direct_${selectedAgentId}`;
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

    const sessionId = activeTab === "global" ? "global" : `direct_${selectedAgentId}`;
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
      const targetedAgentId = activeTab === "global" ? "agent-coder" : selectedAgentId;
      setIsThinking(true);
      
      await invoke("trigger_agent_reply", {
        agentId: targetedAgentId,
        sessionId,
      });

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

  // Create Kanban Task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle) return;

    const newTask: Task = {
      id: "task-" + Math.random().toString(36).substring(2, 7),
      title: taskTitle,
      description: taskDesc || null,
      owner_id: taskOwner || null,
      status: "pending",
      priority: taskPriority,
      parent_id: null,
      evidence_path: null,
    };

    try {
      await invoke("create_task", { task: newTask });
      setIsTaskModalOpen(false);
      setTaskTitle("");
      setTaskDesc("");
      loadTasks();
    } catch (e) {
      console.error("Failed to create task", e);
    }
  };

  // Update Task Status
  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await invoke("update_task_status", {
        id: taskId,
        status: newStatus,
        evidencePath: null,
      });
      loadTasks();
    } catch (e) {
      console.error("Failed to update task status", e);
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

  return (
    <div className="app-layout">
      {/* 1. Sidebar Column */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">💻 CAMELEER</div>
        </div>

        <button className="sidebar-btn" onClick={() => setIsSpawnModalOpen(true)}>
          🤖 Spawn Custom Agent
        </button>

        <div className="agent-list">
          <div className="agent-list-title">Active Crew</div>
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`agent-item ${
                activeTab === "dm" && selectedAgentId === agent.id ? "active" : ""
              }`}
              onClick={() => {
                setSelectedAgentId(agent.id);
                setActiveTab("dm");
              }}
            >
              <div className="agent-avatar">
                {agent.name.charAt(0)}
                <div className={`status-badge ${agent.status}`} />
              </div>
              <div className="agent-info">
                <div className="agent-name">{agent.name}</div>
                <div className="agent-role">{agent.role}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* 2. Main Chat/Board panel */}
      <main className="chat-panel">
        <header className="chat-header">
          <div className="chat-title-group">
            {activeTab === "global" ? (
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
            ) : (
              <div>
                <h2 className="chat-title">System Metrics</h2>
                <div className="chat-subtitle">Real-time GGUF local model execution and hardware telemetry</div>
              </div>
            )}
          </div>

          <div className="panel-tabs">
            <button
              className={`panel-tab ${activeTab === "global" ? "active" : ""}`}
              onClick={() => setActiveTab("global")}
            >
              Global Feed
            </button>
            <button
              className={`panel-tab ${activeTab === "dm" ? "active" : ""}`}
              onClick={() => setActiveTab("dm")}
            >
              Direct Chats
            </button>
            <button
              className={`panel-tab ${activeTab === "kanban" ? "active" : ""}`}
              onClick={() => setActiveTab("kanban")}
            >
              Kanban Board
            </button>
            <button
              className={`panel-tab ${activeTab === "agents" ? "active" : ""}`}
              onClick={() => setActiveTab("agents")}
            >
              Agents
            </button>
            <button
              className={`panel-tab ${activeTab === "models" ? "active" : ""}`}
              onClick={() => setActiveTab("models")}
            >
              Models
            </button>
            <button
              className={`panel-tab ${activeTab === "skills" ? "active" : ""}`}
              onClick={() => setActiveTab("skills")}
            >
              Skills
            </button>
            <button
              className={`panel-tab ${activeTab === "channels" ? "active" : ""}`}
              onClick={() => setActiveTab("channels")}
            >
              Channels
            </button>
            <button
              className={`panel-tab ${activeTab === "files" ? "active" : ""}`}
              onClick={() => setActiveTab("files")}
            >
              Files
            </button>
            <button
              className={`panel-tab ${activeTab === "system" ? "active" : ""}`}
              onClick={() => setActiveTab("system")}
            >
              System
            </button>
          </div>
        </header>

        {activeTab === "global" || activeTab === "dm" ? (
          <>
            {/* Messages Feed */}
            <div className="messages-feed">
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
          </>
        ) : activeTab === "kanban" ? (
          /* Kanban Board */
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div style={{ padding: "16px 24px", display: "flex", justifyContent: "flex-end" }}>
              <button className="sidebar-btn" style={{ margin: 0 }} onClick={() => setIsTaskModalOpen(true)}>
                ➕ Create Task
              </button>
            </div>
            <div className="kanban-board">
              {["pending", "working", "blocked", "complete"].map((status) => {
                const columnTasks = tasks.filter((t) => t.status === status);
                return (
                  <div key={status} className="kanban-column">
                    <div className="kanban-column-header">
                      <span>{status}</span>
                      <span className="kanban-column-count">{columnTasks.length}</span>
                    </div>
                    <div className="kanban-cards">
                      {columnTasks.map((task) => (
                        <div key={task.id} className="kanban-card">
                          <div className="kanban-card-title">{task.title}</div>
                          {task.description && <div className="kanban-card-desc">{task.description}</div>}
                          <div className="kanban-card-meta">
                            <span className="kanban-card-owner">
                              {agents.find((a) => a.id === task.owner_id)?.name || "unassigned"}
                            </span>
                            <span className={`kanban-card-priority ${task.priority}`}>
                              {task.priority}
                            </span>
                          </div>
                          <div style={{ marginTop: "10px", display: "flex", gap: "6px" }}>
                            {status !== "complete" && (
                              <button
                                className="action-btn"
                                style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                                onClick={() => handleUpdateTaskStatus(task.id, "complete")}
                              >
                                Done
                              </button>
                            )}
                            {status === "pending" && (
                              <button
                                className="action-btn"
                                style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                                onClick={() => handleUpdateTaskStatus(task.id, "working")}
                              >
                                Claim
                              </button>
                            )}
                            {status === "working" && (
                              <button
                                className="action-btn"
                                style={{ padding: "4px 8px", fontSize: "0.7rem" }}
                                onClick={() => handleUpdateTaskStatus(task.id, "blocked")}
                              >
                                Block
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
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
          /* Models Page */
          <div className="models-container" style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
            {/* Download Progress Status Banner if downloading */}
            {downloadState.downloading && (
              <div style={{
                background: "rgba(0, 242, 254, 0.08)",
                border: "1px solid rgba(0, 242, 254, 0.25)",
                borderRadius: "12px",
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                backdropFilter: "blur(8px)",
                animation: "pulse 2s infinite"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "1.2rem" }}>📥</span>
                    <div>
                      <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text-main)" }}>Downloading Live Inference GGUF Model...</span>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "2px" }}>Active Task: <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-primary)" }}>{downloadState.model}</span></div>
                    </div>
                  </div>
                  <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent-primary)", fontFamily: "var(--font-mono)" }}>
                    {downloadState.progress.toFixed(1)}%
                  </span>
                </div>
                <div style={{ height: "8px", background: "rgba(255,255,255,0.05)", borderRadius: "4px", overflow: "hidden", position: "relative" }}>
                  <div style={{
                    height: "100%",
                    background: "linear-gradient(90deg, #00f2fe, #4facfe)",
                    width: `${downloadState.progress}%`,
                    transition: "width 0.2s ease",
                    boxShadow: "0 0 10px rgba(0, 242, 254, 0.5)"
                  }} />
                </div>
              </div>
            )}

            {/* Error state if download failed */}
            {downloadState.error && (
              <div style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: "1px solid rgba(239, 68, 68, 0.25)",
                borderRadius: "12px",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                color: "#f87171"
              }}>
                <span style={{ fontSize: "1.2rem" }}>⚠️</span>
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 700 }}>Download Failed</div>
                  <div style={{ fontSize: "0.78rem", opacity: 0.9 }}>{downloadState.error}</div>
                </div>
              </div>
            )}

            {/* Models Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
              {[
                {
                  id: "tinyllama-1.1b",
                  filename: "tinyllama-1.1b-chat-v1.0.Q8_0.gguf",
                  name: "TinyLlama 1.1B Chat (Q8_0)",
                  size: "1.1 GB",
                  ram: "2 GB RAM",
                  desc: "Ultralight, extremely fast chat model optimized for fast responses and minimal hardware requirements.",
                  badge: "Ultralightweight & Speedy"
                },
                {
                  id: "llama-3.2-1b",
                  filename: "Llama-3.2-1B-Instruct-Q8_0.gguf",
                  name: "Llama 3.2 1B Instruct (Q8_0)",
                  size: "1.2 GB",
                  ram: "2.5 GB RAM",
                  desc: "Highly competent small model by Meta, perfect for fast edge processing and robust task classification.",
                  badge: "Efficient Edge Specialist"
                },
                {
                  id: "llama-3.2-3b",
                  filename: "Llama-3.2-3B-Instruct-Q8_0.gguf",
                  name: "Llama 3.2 3B Instruct (Q8_0)",
                  size: "3.2 GB",
                  ram: "6 GB RAM",
                  desc: "The recommended local baseline model. Exceptional tool-use parsing, reasoning depth, and agent autonomy.",
                  badge: "Recommended Baseline"
                },
                {
                  id: "llama-3-8b",
                  filename: "Meta-Llama-3-8B-Instruct-Q8_0.gguf",
                  name: "Llama 3 8B Instruct (Q8_0)",
                  size: "8.5 GB",
                  ram: "12 GB RAM",
                  desc: "Full-bodied local reasoning engine. Capable of coding, complex task planning, and persistent context integration.",
                  badge: "Advanced Local Intelligence"
                },
                {
                  id: "mistral-7b",
                  filename: "Mistral-7B-Instruct-v0.3.Q8_0.gguf",
                  name: "Mistral 7B Instruct v0.3 (Q8_0)",
                  size: "7.7 GB",
                  ram: "10 GB RAM",
                  desc: "High-reasoning generalist model by Mistral AI, optimized for complex instruction following and coding syntaxes.",
                  badge: "Reasoning Generalist"
                }
              ].map((model) => {
                const isDownloaded = localModels.includes(model.filename);
                const isActive = activeModel === model.filename;
                const isDownloadingThis = downloadState.downloading && downloadState.model === model.filename;
                
                return (
                  <div key={model.id} style={{
                    background: "rgba(255, 255, 255, 0.02)",
                    border: isActive ? "1px solid rgba(0, 242, 254, 0.3)" : "1px solid var(--border-color)",
                    borderRadius: "16px",
                    padding: "24px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: isActive ? "0 8px 32px rgba(0, 242, 254, 0.06)" : "none",
                    transition: "all 0.3s ease"
                  }}>
                    {/* Active Gradient Border Accent */}
                    {isActive && (
                      <div style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "3px",
                        background: "linear-gradient(90deg, #00f2fe, #4facfe)"
                      }} />
                    )}

                    <div>
                      {/* Top Header Row */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                        <span style={{
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          background: isActive ? "rgba(0, 242, 254, 0.08)" : "rgba(255,255,255,0.03)",
                          color: isActive ? "var(--accent-primary)" : "var(--text-muted)",
                          border: isActive ? "1px solid rgba(0, 242, 254, 0.15)" : "1px solid rgba(255,255,255,0.04)"
                        }}>
                          {model.badge}
                        </span>
                        
                        {isActive ? (
                          <span style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "#10b981",
                            background: "rgba(16, 185, 129, 0.08)",
                            padding: "3px 8px",
                            borderRadius: "6px"
                          }}>
                            <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 1.5s infinite" }} />
                            Installed & Active
                          </span>
                        ) : isDownloaded ? (
                          <span style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "var(--accent-secondary)",
                            background: "rgba(79, 172, 254, 0.08)",
                            padding: "3px 8px",
                            borderRadius: "6px"
                          }}>
                            Downloaded
                          </span>
                        ) : (
                          <span style={{
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: "var(--text-muted)",
                            background: "rgba(255,255,255,0.03)",
                            padding: "3px 8px",
                            borderRadius: "6px"
                          }}>
                            Not Downloaded
                          </span>
                        )}
                      </div>

                      {/* Model Name & Specs */}
                      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px" }}>
                        {model.name}
                      </h3>
                      
                      <div style={{ display: "flex", gap: "10px", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "16px", fontFamily: "var(--font-mono)" }}>
                        <span>📂 File Size: {model.size}</span>
                        <span>•</span>
                        <span>⚡ Requires: {model.ram}</span>
                      </div>

                      {/* Description */}
                      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", lineHeight: 1.5, marginBottom: "24px" }}>
                        {model.desc}
                      </p>
                    </div>

                    {/* Footer Actions */}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "16px", marginTop: "auto" }}>
                      {isDownloadingThis ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.72rem", color: "var(--text-muted)" }}>
                            <span>Downloading...</span>
                            <span>{downloadState.progress.toFixed(0)}%</span>
                          </div>
                          <div style={{ height: "4px", background: "rgba(255,255,255,0.05)", borderRadius: "2px", overflow: "hidden" }}>
                            <div style={{ height: "100%", background: "var(--accent-primary)", width: `${downloadState.progress}%` }} />
                          </div>
                        </div>
                      ) : isActive ? (
                        <button disabled style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "10px",
                          background: "rgba(16, 185, 129, 0.04)",
                          border: "1px solid rgba(16, 185, 129, 0.15)",
                          color: "#10b981",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "not-allowed"
                        }}>
                          ✓ Primary Active Model
                        </button>
                      ) : isDownloaded ? (
                        <button onClick={() => handleActivateModel(model.filename)} style={{
                          width: "100%",
                          padding: "10px",
                          borderRadius: "10px",
                          background: "rgba(79, 172, 254, 0.08)",
                          border: "1px solid rgba(79, 172, 254, 0.25)",
                          color: "#fff",
                          fontSize: "0.82rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          transition: "all 0.2s ease"
                        }} className="action-btn-hover">
                          ⚙️ Activate Model
                        </button>
                      ) : (
                        <button
                          disabled={downloadState.downloading}
                          onClick={() => handleDownloadModel(model.id)}
                          style={{
                            width: "100%",
                            padding: "10px",
                            borderRadius: "10px",
                            background: downloadState.downloading ? "rgba(255,255,255,0.02)" : "rgba(0, 242, 254, 0.08)",
                            border: downloadState.downloading ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(0, 242, 254, 0.25)",
                            color: downloadState.downloading ? "var(--text-muted)" : "#fff",
                            fontSize: "0.82rem",
                            fontWeight: 700,
                            cursor: downloadState.downloading ? "not-allowed" : "pointer",
                            transition: "all 0.2s ease"
                          }}
                          className={downloadState.downloading ? "" : "action-btn-hover"}
                        >
                          {downloadState.downloading ? "Downloader Busy..." : "Download Model 📥"}
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

            {/* Note Panel */}
            <div style={{
              background: "rgba(255,255,255,0.01)",
              border: "1px solid var(--border-color)",
              borderRadius: "14px",
              padding: "20px",
              marginTop: "8px"
            }}>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main)", marginBottom: "4px" }}>💡 Architecture Notice</h4>
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                All local inference engines operate via the unified <span style={{ color: "var(--accent-primary)", fontWeight: 600 }}>Camelid</span> framework. Downloaded GGUFs are saved into <span style={{ fontFamily: "var(--font-mono)" }}>~/.cameleer/models/</span>. The active model is fully sandboxed, memory-mapped, and gains native access to Metal/GPU offloading for optimal latency speeds.
              </p>
            </div>

          </div>
        ) : (
          /* System Page */
          <div className="system-container" style={{ flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "24px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
              
              {/* Telemetry Card 1 */}
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px" }}>
                <h4 style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "12px" }}>🧠 Local Inference (Camelid)</h4>
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

            {/* OS Gateway & Camelid Configurations */}
            <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--border-color)", borderRadius: "14px", padding: "20px", marginTop: "16px" }}>
              <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--accent-primary)", marginBottom: "6px" }}>⚙️ OS Gateway & Camelid Configurations</h3>
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
      <aside className="inspector-panel">
        {/* Selected Agent Inspector */}
        <section className="inspector-section">
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

        {/* Blackboard shared awareness */}
        <section className="inspector-section">
          <div className="inspector-section-title">Shared Awareness</div>
          <div
            style={{
              maxHeight: "250px",
              overflowY: "auto",
              fontSize: "0.78rem",
              background: "rgba(0,0,0,0.2)",
              padding: "10px",
              borderRadius: "8px",
              whiteSpace: "pre-wrap",
              fontFamily: "var(--font-mono)",
            }}
          >
            {blackboardText}
          </div>
        </section>
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
          <form className="modal-content" onSubmit={handleCreateTask}>
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
                placeholder="Add files to analyze or technical requirements..."
              />
            </div>

            <div className="form-group">
              <label className="form-label">Assignee Owner</label>
              <select
                className="form-input"
                value={taskOwner}
                onChange={(e) => setTaskOwner(e.target.value)}
                style={{ background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
              >
                <option value="">unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
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
                style={{ background: "#0a0d14", border: "1px solid rgba(255,255,255,0.08)", color: "#fff" }}
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
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
    </div>
  );
}

export default App;
