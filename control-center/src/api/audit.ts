import { apiCall } from "./client";

export interface AuditEvent {
  id: number;
  workspace_id: string;
  event_type: string;
  payload: string;
  timestamp: string;
}

export async function getMissionAuditEvents(workspaceId: string): Promise<AuditEvent[]> {
  return apiCall<AuditEvent[]>("get_mission_audit_events", { workspaceId });
}

export interface WorkReceipt {
  card_id: string;
  agent_id?: string;
  summary: string;
  files_created?: string;
  files_modified?: string;
  commands_run?: string;
  tests_run?: string;
  validation_status: string;
  evidence_links?: string;
  known_limitations?: string;
  follow_up_recommendations?: string;
  completed_at: string;
}

export async function getWorkReceipt(cardId: string): Promise<WorkReceipt> {
  return apiCall<WorkReceipt>("get_work_receipt", { cardId });
}

export async function generateWorkReceipt(cardId: string, summary: string, validationStatus: string): Promise<string> {
  return apiCall<string>("generate_work_receipt", { cardId, summary, validationStatus });
}
