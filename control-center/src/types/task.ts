export interface Task {
    id: string;
    task_key?: string | null;
    workspace_id?: string | null;
    title: string;
    description: string | null;
    instructions?: string | null;
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
    work_receipt_id?: string | null;
    labels?: string | null;
    type_name?: string | null;
    blocked_reason?: string | null;
    review_required?: number | null;
}

export interface CreateTaskInput {
    workspace_id?: string | null;
    title: string;
    description?: string | null;
    instructions: string;
    acceptance_criteria?: string | null;
    priority?: string | null;
    type_name?: string | null;
    assigned_agent_id?: string | null;
    labels?: string | null;
    review_required?: boolean;
    status?: string | null;
}

export interface TaskActivity {
    id: string;
    task_id: string;
    actor_id?: string | null;
    actor_type: string;
    event_type: string;
    summary: string;
    details?: string | null;
    created_at: string;
}

export interface TaskProgressUpdate {
    id: string;
    task_id: string;
    run_id?: string | null;
    agent_id?: string | null;
    content: string;
    status: string;
    error_message?: string | null;
    created_at: string;
}

export interface Message {
    id?: number;
    session_id: string;
    role: string;
    sender_id: string | null;
    content: string;
    timestamp: string;
}
