import { apiCall } from "./client";
import { CreateTaskInput, Task, TaskActivity, TaskProgressUpdate } from "../types/task";

export async function getTasks(): Promise<Task[]> {
  return apiCall<Task[]>("get_tasks");
}

export async function getTask(taskId: string): Promise<Task> {
  return apiCall<Task>("get_task", { taskId });
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return apiCall<Task>("create_task", { input });
}

export async function updateTask(taskId: string, fields: Partial<CreateTaskInput> & { blocked_reason?: string | null }): Promise<Task> {
  return apiCall<Task>("update_task", {
    taskId,
    title: fields.title,
    description: fields.description,
    instructions: fields.instructions,
    acceptanceCriteria: fields.acceptance_criteria,
    priority: fields.priority,
    typeName: fields.type_name,
    assignedAgentId: fields.assigned_agent_id,
    labels: fields.labels,
    blockedReason: fields.blocked_reason,
    reviewRequired: fields.review_required,
  });
}

export async function moveTask(taskId: string, status: string): Promise<Task> {
  return apiCall<Task>("move_task", { taskId, status });
}

export async function assignTaskToAgent(taskId: string, agentId: string): Promise<Task> {
  return apiCall<Task>("assign_task_to_agent", { taskId, agentId });
}

export async function blockTask(taskId: string, reason: string): Promise<Task> {
  return apiCall<Task>("block_task", { taskId, reason });
}

export async function unblockTask(taskId: string): Promise<Task> {
  return apiCall<Task>("unblock_task", { taskId });
}

export async function completeTask(taskId: string): Promise<Task> {
  return apiCall<Task>("complete_task", { taskId });
}

export async function reopenTask(taskId: string, reason?: string): Promise<Task> {
  return apiCall<Task>("reopen_task", { taskId, reason });
}

export async function cancelTask(taskId: string): Promise<Task> {
  return apiCall<Task>("cancel_task", { taskId });
}

export async function deleteTask(taskId: string): Promise<void> {
  return apiCall<void>("delete_task", { taskId });
}

export async function listTaskActivity(taskId: string): Promise<TaskActivity[]> {
  return apiCall<TaskActivity[]>("list_task_activity", { taskId });
}

export async function listTaskProgressUpdates(taskId: string): Promise<TaskProgressUpdate[]> {
  return apiCall<TaskProgressUpdate[]>("list_task_progress_updates", { taskId });
}
