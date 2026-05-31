import { apiCall } from "./client";
import { AgentRun, AgentRunStep, CommandApproval } from "../types";

export async function getAgentRuns(agentId?: string, taskId?: string): Promise<AgentRun[]> {
  return apiCall<AgentRun[]>("get_agent_runs", { agentId, taskId });
}

export async function getRunSteps(runId: string): Promise<AgentRunStep[]> {
  return apiCall<AgentRunStep[]>("get_run_steps", { runId });
}

export async function getPendingCommandApproval(workspaceId: string): Promise<CommandApproval[]> {
  return apiCall<CommandApproval[]>("get_pending_command_approval", { workspaceId });
}

export async function resolveCommandApproval(invocationId: string, approved: boolean, feedback?: string): Promise<void> {
  return apiCall<void>("resolve_command_approval", { invocationId, approved, feedback });
}
