use crate::agent_registry::Agent;
use crate::storage::DbState;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TemplateInfo {
    pub key: String,
    pub name: String,
    pub role: String,
    pub persona: String,
    pub primary_skills: Vec<String>,
    pub allowed_tools: Vec<String>,
    pub reasoning_level: String,
    pub workspace_access: String,
    pub file_access_scope: Vec<String>,
    pub command_permissions: Vec<String>,
    pub kanban_permissions: String,
    pub review_requirements: bool,
    pub safety_profile: String,
}

pub fn get_predefined_templates() -> Vec<TemplateInfo> {
    vec![
        TemplateInfo {
            key: "software_engineer".to_string(),
            name: "Software Engineer".to_string(),
            role: "Software Engineer".to_string(),
            persona: "Senior full-stack software engineer specialized in modular programming, clean code, unit testing, and robust error handling. Speaks in clear, technical terms and focuses heavily on writing reliable local files.".to_string(),
            primary_skills: vec!["Rust".to_string(), "TypeScript".to_string(), "Vite".to_string(), "SQLite".to_string(), "Unit Testing".to_string()],
            allowed_tools: vec!["view_file".to_string(), "replace_file_content".to_string(), "multi_replace_file_content".to_string(), "write_to_file".to_string(), "run_command".to_string(), "list_dir".to_string(), "grep_search".to_string()],
            reasoning_level: "advanced".to_string(),
            workspace_access: "full".to_string(),
            file_access_scope: vec!["*".to_string()],
            command_permissions: vec!["cargo".to_string(), "npm".to_string(), "git".to_string(), "ls".to_string(), "cat".to_string(), "grep".to_string()],
            kanban_permissions: "full".to_string(),
            review_requirements: false,
            safety_profile: "moderate".to_string(),
        },
        TemplateInfo {
            key: "technical_writer".to_string(),
            name: "Technical Writer".to_string(),
            role: "Technical Writer".to_string(),
            persona: "Crafts premium developer guides, comprehensive READMEs, user stories, and technical overviews. Explains systems with high-quality grammar and elegant structure, avoiding technical fluff.".to_string(),
            primary_skills: vec!["Markdown Documentation".to_string(), "User Guides".to_string(), "API Specifications".to_string(), "Editing".to_string()],
            allowed_tools: vec!["view_file".to_string(), "write_to_file".to_string(), "replace_file_content".to_string(), "list_dir".to_string()],
            reasoning_level: "standard".to_string(),
            workspace_access: "full".to_string(),
            file_access_scope: vec!["*.md".to_string(), "docs/*".to_string(), "README.md".to_string()],
            command_permissions: vec!["ls".to_string(), "cat".to_string()],
            kanban_permissions: "full".to_string(),
            review_requirements: false,
            safety_profile: "strict".to_string(),
        },
        TemplateInfo {
            key: "qa_engineer".to_string(),
            name: "QA Engineer".to_string(),
            role: "QA Engineer".to_string(),
            persona: "Detail-oriented quality assurance tester. Spawns automated assertions, runs testing rigs, evaluates edge cases, and logs comprehensive evidence checks to ensure product robustness.".to_string(),
            primary_skills: vec!["Integration Testing".to_string(), "Edge-case Scenarios".to_string(), "Bug Auditing".to_string(), "Shell Assertions".to_string()],
            allowed_tools: vec!["view_file".to_string(), "list_dir".to_string(), "run_command".to_string()],
            reasoning_level: "advanced".to_string(),
            workspace_access: "full".to_string(),
            file_access_scope: vec!["tests/*".to_string(), "*".to_string()],
            command_permissions: vec!["cargo test".to_string(), "npm test".to_string(), "ls".to_string(), "cat".to_string()],
            kanban_permissions: "full".to_string(),
            review_requirements: true,
            safety_profile: "moderate".to_string(),
        },
        TemplateInfo {
            key: "architect".to_string(),
            name: "Systems Architect".to_string(),
            role: "Systems Architect".to_string(),
            persona: "High-level designer of microservices, databases, and software patterns. Decomposes giant requirements into modular step-by-step tasks, mapping out database schemas and architectural patterns.".to_string(),
            primary_skills: vec!["System Design".to_string(), "Mermaid Diagrams".to_string(), "Task Decomposition".to_string(), "Performance Scaling".to_string()],
            allowed_tools: vec!["view_file".to_string(), "list_dir".to_string(), "grep_search".to_string()],
            reasoning_level: "deep".to_string(),
            workspace_access: "read-only".to_string(),
            file_access_scope: vec!["*".to_string()],
            command_permissions: vec!["ls".to_string(), "grep".to_string()],
            kanban_permissions: "full".to_string(),
            review_requirements: true,
            safety_profile: "strict".to_string(),
        },
        TemplateInfo {
            key: "project_manager".to_string(),
            name: "TPM / Project Manager".to_string(),
            role: "TPM / Project Manager".to_string(),
            persona: "Coordinates sprints, detects resource blockers, recommends handoffs, and ensures agents work in perfect alignment. Acts as the heartbeat of execution updates for the workforce.".to_string(),
            primary_skills: vec!["Sprint Planning".to_string(), "Blocker Resolution".to_string(), "Coordination Analysis".to_string(), "Agile Workflows".to_string()],
            allowed_tools: vec!["view_file".to_string(), "list_dir".to_string()],
            reasoning_level: "standard".to_string(),
            workspace_access: "read-only".to_string(),
            file_access_scope: vec!["*".to_string()],
            command_permissions: vec!["ls".to_string()],
            kanban_permissions: "full".to_string(),
            review_requirements: false,
            safety_profile: "strict".to_string(),
        },
        TemplateInfo {
            key: "security_engineer".to_string(),
            name: "Security Sentry".to_string(),
            role: "Security Sentry".to_string(),
            persona: "Performs dependency audits, evaluates vulnerability reports, monitors open ports, and flags unsafe script calls or unvalidated user inputs with strict caution parameters.".to_string(),
            primary_skills: vec!["Vulnerability Scans".to_string(), "Static Analysis".to_string(), "Dependency Audits".to_string(), "Port Inspection".to_string()],
            allowed_tools: vec!["view_file".to_string(), "list_dir".to_string(), "run_command".to_string()],
            reasoning_level: "deep".to_string(),
            workspace_access: "read-only".to_string(),
            file_access_scope: vec!["*".to_string()],
            command_permissions: vec!["cargo audit".to_string(), "npm audit".to_string(), "ls".to_string(), "grep".to_string()],
            kanban_permissions: "full".to_string(),
            review_requirements: true,
            safety_profile: "strict".to_string(),
        },
        TemplateInfo {
            key: "devops_engineer".to_string(),
            name: "DevOps Specialist".to_string(),
            role: "DevOps Specialist".to_string(),
            persona: "Automates workspace packages compilation, coordinates CI/CD pipeline triggers, handles environment variable configurations, and designs local package build paths.".to_string(),
            primary_skills: vec!["CI/CD Automation".to_string(), "Build Scripts".to_string(), "Package Bundlers".to_string(), "Environment Setup".to_string()],
            allowed_tools: vec!["view_file".to_string(), "list_dir".to_string(), "write_to_file".to_string(), "run_command".to_string()],
            reasoning_level: "advanced".to_string(),
            workspace_access: "full".to_string(),
            file_access_scope: vec!["*".to_string()],
            command_permissions: vec!["npm run build".to_string(), "cargo build".to_string(), "ls".to_string(), "mkdir".to_string()],
            kanban_permissions: "full".to_string(),
            review_requirements: true,
            safety_profile: "moderate".to_string(),
        },
        TemplateInfo {
            key: "researcher".to_string(),
            name: "Agentic Researcher".to_string(),
            role: "Agentic Researcher".to_string(),
            persona: "Performs GGUF hardware benchmarking, searches technical documentations, maps comparative analysis tables, and extracts developer information for team alignment.".to_string(),
            primary_skills: vec!["GGUF Benchmarking".to_string(), "Documentation Crawler".to_string(), "Comparative Analysis".to_string(), "Data Summarization".to_string()],
            allowed_tools: vec!["view_file".to_string(), "list_dir".to_string()],
            reasoning_level: "standard".to_string(),
            workspace_access: "read-only".to_string(),
            file_access_scope: vec!["*".to_string()],
            command_permissions: vec!["ls".to_string()],
            kanban_permissions: "full".to_string(),
            review_requirements: false,
            safety_profile: "strict".to_string(),
        },
        TemplateInfo {
            key: "code_reviewer".to_string(),
            name: "Code Reviewer".to_string(),
            role: "Code Reviewer".to_string(),
            persona: "Audits diff patterns, checks stylistic guidelines, analyzes logical optimizations, and ensures that code changes match the target plan checkpoint accurately.".to_string(),
            primary_skills: vec!["Diff Audits".to_string(), "Style Guides".to_string(), "Performance Diagnostics".to_string(), "Validation Checklists".to_string()],
            allowed_tools: vec!["view_file".to_string(), "list_dir".to_string(), "grep_search".to_string()],
            reasoning_level: "deep".to_string(),
            workspace_access: "read-only".to_string(),
            file_access_scope: vec!["*".to_string()],
            command_permissions: vec!["git diff".to_string(), "ls".to_string()],
            kanban_permissions: "full".to_string(),
            review_requirements: true,
            safety_profile: "strict".to_string(),
        },
        TemplateInfo {
            key: "product_manager".to_string(),
            name: "Product Manager".to_string(),
            role: "Product Manager".to_string(),
            persona: "Formulates objectives, checks Kanban acceptance criteria, outlines product features, and reviews validation metrics to ensure user satisfaction and clean operations.".to_string(),
            primary_skills: vec!["Objectives Framing".to_string(), "Requirements Mapping".to_string(), "Acceptance Validation".to_string(), "Product Strategy".to_string()],
            allowed_tools: vec!["view_file".to_string(), "list_dir".to_string()],
            reasoning_level: "standard".to_string(),
            workspace_access: "read-only".to_string(),
            file_access_scope: vec!["*".to_string()],
            command_permissions: vec!["ls".to_string()],
            kanban_permissions: "full".to_string(),
            review_requirements: false,
            safety_profile: "moderate".to_string(),
        },
    ]
}

#[tauri::command]
pub fn list_templates() -> Result<Vec<TemplateInfo>, String> {
    Ok(get_predefined_templates())
}

#[tauri::command]
pub fn create_agent_from_template(
    state: State<'_, DbState>,
    template_key: String,
    customized_name: String,
    model_provider: String,
    model_name: String,
) -> Result<(), String> {
    let templates = get_predefined_templates();
    let template = templates
        .into_iter()
        .find(|t| t.key == template_key)
        .ok_or_else(|| format!("Template not found: {}", template_key))?;

    let now_micros = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_micros();
    let agent_id = format!("agent-{}-{}", template.key, now_micros);

    let primary_skills_str =
        serde_json::to_string(&template.primary_skills).unwrap_or_else(|_| "[]".to_string());
    let allowed_tools_str =
        serde_json::to_string(&template.allowed_tools).unwrap_or_else(|_| "[]".to_string());
    let file_access_scope_str =
        serde_json::to_string(&template.file_access_scope).unwrap_or_else(|_| "[]".to_string());
    let command_permissions_str =
        serde_json::to_string(&template.command_permissions).unwrap_or_else(|_| "[]".to_string());

    let conn = state.conn.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO agents (id, name, role, persona, model_provider, model_name, temperature, max_tokens, 
                             can_spawn_subtasks, can_talk_globally, is_continuous, status,
                             primary_skills, allowed_tools, reasoning_level, workspace_access, file_access_scope,
                             command_permissions, kanban_permissions, review_requirements, safety_profile, escalation_rules)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 'idle', ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, '[]')",
        params![
            agent_id,
            customized_name,
            template.role,
            template.persona,
            model_provider,
            model_name,
            0.7,
            2048,
            1, // can_spawn_subtasks
            1, // can_talk_globally
            0, // is_continuous
            primary_skills_str,
            allowed_tools_str,
            template.reasoning_level,
            template.workspace_access,
            file_access_scope_str,
            command_permissions_str,
            template.kanban_permissions,
            if template.review_requirements { 1 } else { 0 },
            template.safety_profile,
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn create_software_team(
    state: State<'_, DbState>,
    model_provider: String,
    model_name: String,
) -> Result<(), String> {
    let roles = vec![
        ("architect", "Architect Director"),
        ("software_engineer", "Senior Code Composer"),
        ("qa_engineer", "QA Pipeline Sentry"),
        ("technical_writer", "Lead Documentarian"),
        ("project_manager", "TPM Sprint Master"),
    ];

    for (key, name) in roles {
        let _ = create_agent_from_template(
            state.clone(),
            key.to_string(),
            name.to_string(),
            model_provider.clone(),
            model_name.clone(),
        )?;
    }

    Ok(())
}

#[tauri::command]
pub fn create_coding_sprint(state: State<'_, DbState>, workspace_id: String) -> Result<(), String> {
    let conn = state.conn.lock().map_err(|e| e.to_string())?;

    // Seed 5 core sprint tasks for building Tetris
    let tasks = vec![
        (
            "task-sprint-1",
            "Design Tetris Architecture & Data Schema",
            "Produce the system blueprint detailing game state structure, board dimensions (10x20), standard grid representation, shape matrices for I, O, T, S, Z, J, L block pieces, and the core message protocols between agents.",
            "architect",
            "high",
            "[\"Design document detailing tetromino matrices\", \"Clear state interface definition in Rust or TypeScript\"]",
            "[\"architecture.md\"]",
        ),
        (
            "task-sprint-2",
            "Implement Core Game Loop & Matrix State",
            "Write the foundational Game Loop, representing the active grid tick, gravity drop velocity, score metrics, level progressions, and active piece state management.",
            "software_engineer",
            "high",
            "[\"Working game loop ticking every 500ms\", \"A 10x20 cell grid structure matching architectural design\"]",
            "[\"src/game.ts\"]",
        ),
        (
            "task-sprint-3",
            "Add Piece Collisions, Rotation, and User Controls",
            "Implement piece movement translations (left, right, down), drop acceleration, 90-degree rotations, wall kick handling, full row clears, and score updates.",
            "software_engineer",
            "high",
            "[\"Piece rotation behaves exactly to standards without clipping walls\", \"Clearing a line increases score and moves lines down\"]",
            "[\"src/game.ts\", \"src/controls.ts\"]",
        ),
        (
            "task-sprint-4",
            "Write Comprehensive QA Unit & Integration Tests",
            "Develop unit assertions confirming collision boundaries, row deletion formulas, score mechanics, and test scripts demonstrating piece locking behavior.",
            "qa_engineer",
            "medium",
            "[\"All test suites compile and pass\", \"Verifiable code coverage of collision triggers\"]",
            "[\"tests/game.test.ts\"]",
        ),
        (
            "task-sprint-5",
            "Compose User Documentation README and Install Guide",
            "Draft a premium markdown README outlining the Tetris product, its state management features, installation setups, and visual run instructions.",
            "technical_writer",
            "medium",
            "[\"Clean markdown format\", \"Includes install step guidelines\"]",
            "[\"README.md\"]",
        ),
    ];

    for (id, title, desc, preferred_role, priority, acceptance_criteria, related_files) in tasks {
        // Find an agent that matches this preferred role if exists
        let assigned_agent_id: Option<String> = conn
            .query_row(
                "SELECT id FROM agents WHERE role LIKE ?1 LIMIT 1",
                [format!("%{}%", preferred_role.replace("_", " "))],
                |row| row.get(0),
            )
            .optional()
            .unwrap_or(None);

        let agent_id_val = assigned_agent_id.unwrap_or_else(|| "".to_string());

        conn.execute(
            "INSERT OR REPLACE INTO kanban_cards (id, workspace_id, title, description, assigned_agent_id, status, priority, acceptance_criteria, related_files, created_by, validation_status)
             VALUES (?1, ?2, ?3, ?4, NULLIF(?5, ''), 'backlog', ?6, ?7, ?8, 'user', 'pending')",
            params![
                id,
                workspace_id,
                title,
                desc,
                agent_id_val,
                priority,
                acceptance_criteria,
                related_files,
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}
