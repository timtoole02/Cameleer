import { apiCall } from "./client";

export interface Message {
    id: number;
    session_id: string;
    role: string;
    sender_id?: string;
    content: string;
    timestamp: string;
    project_id?: string;
    team_id?: string;
    agent_id?: string;
    card_id?: string;
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  return apiCall<Message[]>("get_messages", { sessionId });
}

export async function saveMessage(
    sessionId: string, 
    role: string, 
    content: string, 
    senderId?: string,
    projectId?: string,
    teamId?: string,
    agentId?: string,
    cardId?: string
): Promise<Message> {
  return apiCall<Message>("save_message", { sessionId, role, content, senderId, projectId, teamId, agentId, cardId });
}

export async function triggerAgentReply(
    sessionId: string,
    agentId: string,
    projectId?: string,
    teamId?: string
): Promise<void> {
  return apiCall<void>("trigger_agent_reply", { sessionId, agentId, projectId, teamId });
}
