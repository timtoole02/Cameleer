import { apiCall } from "./client";
import { BacklogItem, CreateBacklogItemInput, KanbanCard, UpdateBacklogItemInput } from "../types";

export async function getBacklogSnapshot(workspaceId: string, projectId?: string, teamId?: string): Promise<BacklogItem[]> {
  return apiCall<BacklogItem[]>("get_backlog_snapshot", { workspaceId, projectId, teamId });
}

export async function createBacklogItem(input: CreateBacklogItemInput): Promise<BacklogItem> {
  return apiCall<BacklogItem>("create_backlog_item", { input });
}

export async function updateBacklogItem(id: string, input: UpdateBacklogItemInput): Promise<BacklogItem> {
  return apiCall<BacklogItem>("update_backlog_item", { id, input });
}

export async function convertBacklogItemToCard(id: string): Promise<KanbanCard> {
  return apiCall<KanbanCard>("convert_backlog_item_to_card", { id });
}
