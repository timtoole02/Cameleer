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

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  status: string;
  priority: string;
}

export interface Team {
  id: string;
  workspace_id: string;
  project_id: string | null;
  parent_team_id: string | null;
  name: string;
  description: string | null;
}

export async function createProject(workspaceId: string, name: string, description?: string): Promise<Project> {
  return apiCall<Project>("create_project", { workspaceId, name, description });
}

export async function createTeam(workspaceId: string, name: string, projectId?: string, description?: string): Promise<Team> {
  return apiCall<Team>("create_team", { workspaceId, projectId, name, description });
}

export async function moveAgentToTeam(agentId: string, projectId: string, teamId: string): Promise<void> {
  return apiCall<void>("move_agent_to_team", { agentId, projectId, teamId });
}
