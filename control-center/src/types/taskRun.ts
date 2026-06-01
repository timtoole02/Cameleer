export interface TaskRun {
  id: string;
  agent_id: string;
  conversation_id?: string | null;
  task_id?: string | null;
  state: string;
  input?: string | null;
  plan?: string | null;
  final_answer?: string | null;
  error?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}
