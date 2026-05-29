export interface BacklogItem {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  team_id?: string | null;
  backlog_id?: string | null;
  title: string;
  description?: string | null;
  type_name: string;
  priority: string;
  rank: number;
  labels?: string | null;
  source: string;
  status: string;
  owner_agent_id?: string | null;
  owner_human_id?: string | null;
  proposed_agent_role?: string | null;
  acceptance_criteria?: string | null;
  refinement_notes?: string | null;
  dependencies?: string | null;
  risk_level: string;
  effort_estimate?: string | null;
  readiness_score: number;
  created_at: string;
  updated_at: string;
}

export interface KanbanCard {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  team_id?: string | null;
  board_id?: string | null;
  backlog_id?: string | null;
  parent_id?: string | null;
  title: string;
  description?: string | null;
  type_name: string;
  status: string;
  priority: string;
  rank: number;
  severity?: string | null;
  labels?: string | null;
  assigned_agent_id?: string | null;
  assigned_human_id?: string | null;
  reporter?: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  due_date?: string | null;
  start_date?: string | null;
  completed_at?: string | null;
  estimate?: string | null;
  actual_time?: string | null;
  acceptance_criteria?: string | null;
  definition_of_done?: string | null;
  required_files?: string | null;
  related_files?: string | null;
  related_artifacts?: string | null;
  dependencies?: string | null;
  blocked_by?: string | null;
  blocking?: string | null;
  comments?: string | null;
  activity_log?: string | null;
  checklist?: string | null;
  validation_status: string;
  completion_evidence?: string | null;
  work_receipt_id?: string | null;
  risk_level: string;
  review_required: number;
  approval_required: number;
  reopen_reason?: string | null;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  status: string;
  priority: string;
}

export interface Team {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  parent_team_id?: string | null;
  name: string;
  description?: string | null;
}

export interface AgentOrgNode {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  parent_node_id?: string | null;
  node_type: string;
  display_name: string;
  agent_id?: string | null;
  team_id?: string | null;
  sort_order: number;
  collapsed: number;
}
