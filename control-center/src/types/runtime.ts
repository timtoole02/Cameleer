import { Workspace } from "./project";

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
