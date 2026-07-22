export interface Agent {
    id: string;
    name: string;
    role: string;
    persona: string;
    model_provider: string;
    model_name: string;
    temperature: number;
    max_tokens: number;
    can_spawn_subtasks: boolean;
    can_talk_globally: boolean;
    is_continuous: boolean;
    status: string;
    last_heartbeat: string | null;
    parent_agent_id?: string | null;
    allowed_tools?: string | null;
    // Returned by get_agents (agent_registry.rs) but previously not surfaced in the UI.
    reasoning_level?: string | null;
    safety_profile?: string | null;
    command_permissions?: string | null;
}

export interface TemplateInfo {
    key: string;
    name: string;
    role: string;
    persona: string;
    primary_skills: string[];
    allowed_tools: string[];
    reasoning_level: string;
    workspace_access: string;
    file_access_scope: string[];
    command_permissions: string[];
    kanban_permissions: string;
    review_requirements: boolean;
    safety_profile: string;
}
