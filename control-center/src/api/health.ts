import { apiCall } from "./client";

export interface BackendHealth {
  app_status: "online" | "degraded" | "offline";
  database_status: "ready" | "migrating" | "schema_error" | "offline";
  camelid_status: "connected" | "offline" | "starting" | "error" | "unknown";
  schema_version: number;
  required_schema_version: number;
  database_path: string;
  active_workspace_id: string | null;
  active_workspace_name: string | null;
  active_agent_id: string | null;
  active_agent_name: string | null;
  camelid_endpoint: string;
  camelid_model: string | null;
  errors: string[];
  warnings: string[];
}

export async function getBackendHealth(): Promise<BackendHealth> {
  return apiCall<BackendHealth>("get_backend_health");
}

export async function resetDevDatabase(): Promise<string> {
  return apiCall<string>("reset_dev_database");
}

