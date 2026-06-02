import { apiCall } from "./client";

export interface Memory {
  id: string;
  agent_id: string | null;
  workspace_id: string | null;
  content: string;
  context: string | null;
  importance: number;
  created_at: string;
  last_accessed_at: string | null;
}

export async function getMemories(workspaceId?: string): Promise<Memory[]> {
  return apiCall<Memory[]>("list_memories", { workspaceId });
}

export async function searchMemories(query: string, workspaceId?: string): Promise<Memory[]> {
  return apiCall<Memory[]>("search_memories_cmd", { query, workspaceId });
}

export async function createMemory(input: {
  content: string;
  context?: string;
  importance?: number;
  agentId?: string;
  workspaceId?: string;
}): Promise<string> {
  return apiCall<string>("create_memory_cmd", {
    content: input.content,
    context: input.context,
    importance: input.importance,
    agentId: input.agentId,
    workspaceId: input.workspaceId,
  });
}

export async function deleteMemory(id: string): Promise<void> {
  return apiCall<void>("delete_memory_cmd", { id });
}
