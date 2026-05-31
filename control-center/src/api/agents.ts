import { apiCall } from "./client";
import { Agent, AgentOrgNode } from "../types";

export async function getAgents(): Promise<Agent[]> {
  return apiCall<Agent[]>("get_agents");
}

export async function createAgent(agent: Agent): Promise<void> {
  return apiCall<void>("create_agent", { agent });
}

export async function updateAgent(agent: Agent): Promise<void> {
  return apiCall<void>("update_agent", { agent });
}

export async function deleteAgent(id: string): Promise<void> {
  return apiCall<void>("delete_agent", { id });
}

export async function getAgentOrgTree(workspaceId: string, projectId?: string, teamId?: string): Promise<AgentOrgNode[]> {
  return apiCall<AgentOrgNode[]>("get_agent_org_tree", { workspaceId, projectId, teamId });
}
