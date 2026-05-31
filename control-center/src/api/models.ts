import { apiCall } from "./client";

export interface Model {
  model_id: string;
  display_name: string;
  provider: string;
  source_repo?: string;
  source_file?: string;
  local_path?: string;
  install_status: string;
  active_status: number;
}

export async function listModelCatalog(): Promise<Model[]> {
  return apiCall<Model[]>("list_model_catalog");
}

export async function runModelSmokeTest(modelId: string): Promise<boolean> {
  return apiCall<boolean>("run_model_smoke_test", { modelId });
}

export async function activateModelScoped(modelId: string, scopeType: string, scopeId: string): Promise<void> {
  return apiCall<void>("activate_model_scoped", { modelId, scopeType, scopeId });
}

export async function importLocalModel(path: string, provider: string, displayName: string): Promise<string> {
  return apiCall<string>("import_local_model", { path, provider, displayName });
}

// Global Provider Configs
export interface ProviderConfig {
  provider: string;
  endpoint_url: string;
  api_key: string;
}

export async function listProviderConfigs(): Promise<ProviderConfig[]> {
  return apiCall<ProviderConfig[]>("list_provider_configs");
}

export async function saveProviderConfig(provider: string, endpointUrl: string, apiKey: string): Promise<void> {
  return apiCall<void>("save_provider_config", { provider, endpointUrl, apiKey });
}
