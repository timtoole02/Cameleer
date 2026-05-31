import { apiCall } from "./client";

export async function getAutopilotSettings(workspaceId: string): Promise<any> {
  return apiCall<any>("get_autopilot_settings", { workspaceId });
}

export async function getBackendConfig(): Promise<any> {
  return apiCall<any>("get_backend_config");
}
