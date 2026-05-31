import { apiCall } from "./client";
import { KanbanCard } from "../types";

export async function getBoardSnapshot(workspaceId: string): Promise<KanbanCard[]> {
  return apiCall<KanbanCard[]>("get_board_snapshot", { workspaceId });
}

export async function createCard(workspaceId: string, title: string, description: string, priority: string, reporter: string): Promise<string> {
  return apiCall<string>("create_card", { workspaceId, title, description, priority, reporter });
}

export async function assignCard(id: string, agentId: string): Promise<void> {
  return apiCall<void>("assign_card", { id, agentId });
}

export async function moveCard(id: string, status: string): Promise<void> {
  return apiCall<void>("move_card", { id, status });
}
