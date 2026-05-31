export interface Task {
    id: string;
    workspace_id?: string | null;
    title: string;
    description: string | null;
    owner_id: string | null;
    assigned_agent_id?: string | null;
    status: string;
    priority: string;
    created_by?: string | null;
    created_at?: string;
    updated_at?: string;
    due_date?: string | null;
    acceptance_criteria?: string | null;
    required_files?: string | null;
    related_files?: string | null;
    related_artifacts?: string | null;
    dependencies?: string | null;
    blockers?: string | null;
    comments?: string | null;
    activity_log?: string | null;
    validation_status?: string | null;
    completion_evidence?: string | null;
}

export interface Message {
    id?: number;
    session_id: string;
    role: string;
    sender_id: string | null;
    content: string;
    timestamp: string;
}
