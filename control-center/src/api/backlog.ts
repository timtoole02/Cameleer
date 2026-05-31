import { apiCall } from "./client";
import { BacklogItem, KanbanCard } from "../types";

export async function getBacklogSnapshot(workspaceId: string, projectId?: string, teamId?: string): Promise<BacklogItem[]> {
  return apiCall<BacklogItem[]>("get_backlog_snapshot", { workspaceId, projectId, teamId });
}

export async function createBacklogItem(
    workspaceId: string, 
    title: string, 
    description?: string, 
    typeName?: string,
    priority?: string
): Promise<BacklogItem> {
  return apiCall<BacklogItem>("create_backlog_item", { workspaceId, title, description, typeName, priority });
}

export async function updateBacklogItem(
    id: string,
    title?: string,
    description?: string,
    typeName?: string,
    priority?: string,
    status?: string,
    acceptanceCriteria?: string,
    definitionOfDone?: string,
    requiredFiles?: string,
    proposedAgentRole?: string,
    dependencies?: string,
    riskLevel?: string,
    effortEstimate?: string,
    readinessScore?: number,
    refinementNotes?: string,
    labels?: string
): Promise<void> {
    return apiCall<void>("update_backlog_item", {
        id, title, description, typeName, priority, status, acceptanceCriteria, definitionOfDone, requiredFiles,
        proposedAgentRole, dependencies, riskLevel, effortEstimate, readinessScore, refinementNotes, labels
    });
}

export async function convertBacklogItemToCard(id: string): Promise<KanbanCard> {
  return apiCall<KanbanCard>("convert_backlog_item_to_card", { id });
}
