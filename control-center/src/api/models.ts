import { apiCall } from "./client";
import { ModelCatalogEntry, ModelDetailsResponse } from "../types";

export async function listModelCatalog(): Promise<ModelCatalogEntry[]> {
  return apiCall<ModelCatalogEntry[]>("list_model_catalog");
}

export async function getModelDetails(modelId: string): Promise<ModelDetailsResponse> {
  return apiCall<ModelDetailsResponse>("get_model_details", { modelId });
}
