import { apiCall } from "./client";
import { BackendStatus } from "../components/common/StatusBadge";

export interface BackendHealth {
  status: BackendStatus;
  database_ready: boolean;
  migrations_applied: boolean;
  active_project_id: string | null;
  active_project_name: string | null;
  default_model_profile_id: string | null;
  message: string;
}

export async function getBackendHealth(): Promise<BackendHealth> {
  return apiCall<BackendHealth>("get_backend_health");
}
