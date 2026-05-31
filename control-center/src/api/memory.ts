// Memory endpoints are not currently exposed by the backend.
// These are typed stubs indicating blocked features.

export async function getMemories(workspaceId: string): Promise<any[]> {
  console.warn("getMemories is blocked by backend");
  return Promise.resolve([]);
}

export async function createMemory(workspaceId: string, content: string): Promise<void> {
  console.warn("createMemory is blocked by backend");
  return Promise.resolve();
}
