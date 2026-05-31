import { apiCall } from "./client";
import { BackendStatus } from "../types";

export async function getBackendStatus(): Promise<BackendStatus> {
  return apiCall<BackendStatus>("get_backend_status");
}

export async function ensureBackendRunning(): Promise<void> {
  return apiCall<void>("ensure_backend_running");
}
// Note: Agent runs/steps are fetched via task_manager in the backend
export async function getAgentRuns(agentId: string): Promise<any[]> {
  return apiCall<any[]>("get_agent_runs", { agentId });
}
