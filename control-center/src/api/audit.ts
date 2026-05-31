import { apiCall } from "./client";

export async function getMissionAuditEvents(workspaceId: string): Promise<any[]> {
  return apiCall<any[]>("get_mission_audit_events", { workspaceId });
}
