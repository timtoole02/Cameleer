export interface BacklogItem {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  team_id?: string | null;
  backlog_id?: string | null;
  title: string;
  description?: string | null;
  type_name: string;
  priority: string;
  rank: number;
  labels?: string | null;
  source: string;
  status: string;
  owner_agent_id?: string | null;
  owner_human_id?: string | null;
  proposed_agent_role?: string | null;
  acceptance_criteria?: string | null;
  definition_of_done?: string | null;
  required_files?: string | null;
  refinement_notes?: string | null;
  dependencies?: string | null;
  risk_level: string;
  effort_estimate?: string | null;
  readiness_score: number;
  created_at: string;
  updated_at: string;
}

export interface KanbanCard {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  team_id?: string | null;
  board_id?: string | null;
  backlog_id?: string | null;
  parent_id?: string | null;
  title: string;
  description?: string | null;
  type_name: string;
  status: string;
  priority: string;
  rank: number;
  severity?: string | null;
  labels?: string | null;
  assigned_agent_id?: string | null;
  assigned_human_id?: string | null;
  reporter?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  due_date?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  estimate?: string | null;
  actual_time?: string | null;
  acceptance_criteria?: string | null;
  definition_of_done?: string | null;
  required_files?: string | null;
  related_files?: string | null;
  related_artifacts?: string | null;
  dependencies?: string | null;
  blocked_by?: string | null;
  blocking?: string | null;
  comments?: string | null;
  activity_log?: string | null;
  checklist?: string | null;
  validation_status: string;
  completion_evidence?: string | null;
  work_receipt_id?: string | null;
  risk_level: string;
  review_required: number;
  approval_required: number;
  reopen_reason?: string | null;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
}

export interface Team {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  parent_team_id?: string | null;
  name: string;
  description?: string | null;
}

export interface AgentOrgNode {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  parent_node_id?: string | null;
  node_type: string;
  display_name: string;
  agent_id?: string | null;
  team_id?: string | null;
  sort_order: number;
  collapsed: number;
}

export interface Agent {
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

export interface Message {
    id?: number;
    session_id: string;
    role: string;
    sender_id: string | null;
    content: string;
    timestamp: string;
}

export interface Task {
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
    acceptance_criteria?: string | null;
    required_files?: string | null;
    related_files?: string | null;
    related_artifacts?: string | null;
    dependencies?: string | null;
    blockers?: string | null;
    comments?: string | null;
    activity_log?: string | null;
    validation_status?: string | null;
    completion_evidence?: string | null;
}

export interface ProviderConfig {
    id?: number;
    provider: string;
    model_name: string;
    api_key: string | null;
    endpoint_url: string | null;
    is_default: boolean;
}

export interface Workspace {
    id: string;
    name: string;
    path: string;
    active: number;
}

export interface Decision {
    id?: number;
    workspace_id?: string;
    decision: string;
    decided_by?: string;
    timestamp: string;
}

export interface Handoff {
    id?: number;
    task_id?: string;
    source_agent_id: string;
    target_agent_id: string;
    reason: string;
    status: string;
    timestamp: string;
}

export interface CoordinationDetails {
    workspaces: Workspace[];
    decisions: Decision[];
    handoffs: Handoff[];
}

export interface WorkSuggestion {
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

export interface TemplateInfo {
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

export interface SubtaskProposal {
    id: string;
    title: string;
    description: string;
    priority: string;
    preferred_role: string;
    required_files: string;
}

export interface MissionProgress {
    preview_id: string;
    title: string;
    goal: string;
    total_cards: number;
    completed_cards: number;
    progress_percent: number;
    status: string;
}

export interface ModelCatalogEntry {
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

export interface HuggingFaceModelEntry {
    repo_id: string;
    filename: string;
    size_bytes: number;
    download_url: string;
}

export interface PreflightResponse {
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

export interface TensorDetails {
    tensor_name: string;
    tensor_type: string;
    shape: number[];
    supported: boolean;
    notes: string | null;
}

export interface DownloadDetails {
    download_id: string;
    status: string;
    total_bytes: number;
    downloaded_bytes: number;
    resume_supported: boolean;
    started_at: string;
    completed_at: string | null;
    error_message: string | null;
}

export interface ActivationDetails {
    scope_type: string;
    scope_id: string;
    activated_at: string;
}

export interface InspectionDetails {
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

export interface ModelDetailsResponse {
    entry: ModelCatalogEntry;
    inspection: InspectionDetails | null;
    tensors: TensorDetails[];
    download: DownloadDetails | null;
    activations: ActivationDetails[];
}

export interface StorageUsageResponse {
    total_allocated_bytes: number;
    space_saved_partial_bytes: number;
    installed_count: number;
    models_storage_path: string;
}

export interface SmokeTestResult {
    success: boolean;
    prompt: string;
    tokens_generated: number;
    tokens_per_second: number;
    load_latency_ms: number;
    memory_allocated_mb: number;
    log_output: string;
}

export interface BackendStatus {
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

export interface BackendRuntimeConfig {
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

export interface RuntimeVerification {
    found: boolean;
    resolved_path: string | null;
    executable: boolean;
    version_output: string | null;
    searched_paths: string[];
    error_message: string | null;
}
