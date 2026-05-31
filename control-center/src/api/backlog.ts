import { apiCall } from "./client";
import { BacklogItem } from "../types";

export async function getBacklogSnapshot(workspaceId: string): Promise<BacklogItem[]> {
  return apiCall<BacklogItem[]>("get_backlog_snapshot", { workspaceId });
}

export async function createBacklogItem(workspaceId: string, title: string, description: string, priority: string): Promise<string> {
  return apiCall<string>("create_backlog_item", { workspaceId, title, description, priority });
}

export async function convertBacklogItemToCard(itemId: string, boardId?: string): Promise<string> {
  return apiCall<string>("convert_backlog_item_to_card", { itemId, boardId });
}
