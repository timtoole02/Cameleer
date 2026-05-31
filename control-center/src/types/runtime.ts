export interface AgentRun {
  id: string;
  agent_id: string;
  conversation_id?: string;
  task_id?: string;
  state: string;
  input?: string;
  plan?: string;
  final_answer?: string;
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface AgentRunStep {
  id: string;
  run_id: string;
  step_type: string;
  content: string;
  created_at: string;
}

export interface CommandApproval {
  id: string;
  invocation_id: string;
  card_id?: string;
  agent_id: string;
  tool_name: string;
  arguments: string;
  status: string;
  decided_by?: string;
  feedback?: string;
  created_at: string;
  decided_at?: string;
}
