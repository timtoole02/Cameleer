export interface WorkReceipt {
  id: string;
  task_id: string;
  agent_id?: string | null;
  summary: string;
  instructions_followed?: string | null;
  acceptance_criteria_results?: string | null;
  files_created?: string | null;
  files_modified?: string | null;
  commands_run?: string | null;
  tests_run?: string | null;
  validation_status: string;
  evidence_links?: string | null;
  known_limitations?: string | null;
  follow_up_recommendations?: string | null;
  completed_at: string;
}
