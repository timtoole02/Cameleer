import { invoke } from "@tauri-apps/api/core";

export async function apiCall<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (error) {
    console.error(`API Error calling ${command}:`, error);
    throw error;
  }
}
