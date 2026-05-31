export interface Workspace {
    id: string;
    name: string;
    path: string;
    active: number;
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
