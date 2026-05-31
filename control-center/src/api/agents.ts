import { apiCall } from "./client";
import { Agent, AgentOrgNode } from "../types";

export async function getAgents(): Promise<Agent[]> {
  return apiCall<Agent[]>("get_agents");
}

export async function createAgent(
  name: string,
  role: string,
  persona: string,
  provider: string,
  modelName: string,
  temperature: number,
  maxTokens: number,
  spawnSubtasks: boolean,
  talkGlobally: boolean,
  isContinuous: boolean,
  parentAgentId?: string,
  allowedTools?: string
): Promise<string> {
  return apiCall<string>("create_agent", {
    name,
    role,
    persona,
    provider,
    modelName,
    temperature,
    maxTokens,
    spawnSubtasks,
    talkGlobally,
    isContinuous,
    parentAgentId,
    allowedTools
  });
}

export async function getAgentOrgTree(workspaceId: string): Promise<AgentOrgNode[]> {
  return apiCall<AgentOrgNode[]>("get_agent_org_tree", { workspaceId });
}

export async function deleteAgent(id: string): Promise<void> {
  return apiCall<void>("delete_agent", { id });
}
