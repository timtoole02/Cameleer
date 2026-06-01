import { apiCall } from "./client";
import { TaskRun } from "../types/taskRun";
import { WorkReceipt } from "../types/workReceipt";

export async function startAgentTaskRun(taskId: string): Promise<TaskRun> {
  return apiCall<TaskRun>("start_agent_task_run", { taskId });
}

export async function getTaskRunStatus(runId: string): Promise<TaskRun> {
  return apiCall<TaskRun>("get_task_run_status", { runId });
}

export async function listTaskRuns(taskId: string): Promise<TaskRun[]> {
  return apiCall<TaskRun[]>("list_task_runs", { taskId });
}

export async function generateWorkReceipt(taskId: string): Promise<WorkReceipt> {
  return apiCall<WorkReceipt>("generate_task_work_receipt", { taskId });
}

export async function getTaskWorkReceipt(taskId: string): Promise<WorkReceipt | null> {
  return apiCall<WorkReceipt | null>("get_task_work_receipt", { taskId });
}

export async function approveWorkReceipt(taskId: string, receiptId: string): Promise<void> {
  return apiCall<void>("approve_work_receipt", { taskId, receiptId });
}

export async function sendTaskBackToAgent(taskId: string, feedback: string): Promise<void> {
  return apiCall<void>("send_task_back_to_agent", { taskId, feedback });
}
