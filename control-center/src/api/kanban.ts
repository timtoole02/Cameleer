import { apiCall } from "./client";
import { KanbanCard } from "../types";

export async function getBoardSnapshot(workspaceId: string, projectId?: string, teamId?: string): Promise<KanbanCard[]> {
  return apiCall<KanbanCard[]>("get_board_snapshot", { workspaceId, projectId, teamId });
}

export async function createCard(
    workspaceId: string, 
    title: string, 
    description?: string, 
    typeName?: string,
    priority?: string, 
    status?: string,
    assignedAgentId?: string,
    acceptanceCriteria?: string,
    requiredFiles?: string,
    dependencies?: string,
    projectId?: string,
    teamId?: string
): Promise<string> {
  return apiCall<string>("create_card", { 
    workspaceId, projectId, teamId, title, description, 
    typeName, priority, status, assignedAgentId, 
    acceptanceCriteria, requiredFiles, dependencies 
  });
}

export async function assignCard(cardId: string, agentId: string): Promise<void> {
  return apiCall<void>("assign_card", { cardId, agentId });
}

export async function moveCard(cardId: string, newStatus: string, reason?: string): Promise<void> {
  return apiCall<void>("move_card", { cardId, newStatus, reason });
}

export async function getAgentWorkQueue(workspaceId: string, agentId: string, projectId?: string, teamId?: string): Promise<KanbanCard[]> {
  return apiCall<KanbanCard[]>("get_agent_work_queue", { agentId, workspaceId, projectId, teamId });
}
