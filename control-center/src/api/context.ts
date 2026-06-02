import { apiCall } from "./client";

export interface Decision {
  id: number | null;
  workspace_id: string;
  decision: string;
  decided_by: string;
  timestamp: string;
}

export interface Handoff {
  id: number | null;
  task_id: string | null;
  source_agent_id: string;
  target_agent_id: string;
  reason: string;
  status: string;
  timestamp: string;
}

export interface CoordinationDetails {
  workspaces: { id: string; name: string; path: string | null; active: boolean }[];
  decisions: Decision[];
  handoffs: Handoff[];
}

export async function getCoordinationDetails(): Promise<CoordinationDetails> {
  return apiCall<CoordinationDetails>("get_coordination_details");
}

export async function recordDecision(workspaceId: string, decision: string, decidedBy: string): Promise<void> {
  return apiCall<void>("record_decision_cmd", { workspaceId, decision, decidedBy });
}

export async function requestHandoff(
  sourceAgentId: string,
  targetAgentId: string,
  reason: string,
  taskId?: string,
): Promise<void> {
  return apiCall<void>("request_handoff_cmd", { sourceAgentId, targetAgentId, reason, taskId });
}

export async function resolveHandoff(id: number, status: string): Promise<void> {
  return apiCall<void>("resolve_handoff_cmd", { id, status });
}
