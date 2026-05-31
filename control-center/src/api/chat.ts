import { apiCall } from "./client";
import { Message } from "../types";

export async function getMessages(sessionId: string): Promise<Message[]> {
  return apiCall<Message[]>("get_messages", { sessionId });
}

export async function saveMessage(sessionId: string, role: string, content: string, senderId?: string): Promise<void> {
  return apiCall<void>("save_message", { sessionId, role, content, senderId });
}

export async function triggerAgentReply(agentId: string, sessionId: string): Promise<void> {
  return apiCall<void>("trigger_agent_reply", { agentId, sessionId });
}
