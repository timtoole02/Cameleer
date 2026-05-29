use std::fs;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PlaybookFrontmatter {
    pub name: String,
    pub desc: String,
    pub tools: Vec<String>,
    pub inputs: Vec<String>,
    pub status: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct PlaybookSkill {
    pub id: String,
    pub frontmatter: PlaybookFrontmatter,
    pub content: String,
}

pub fn get_skills_dir() -> PathBuf {
    let mut path = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/Users/timtoole".to_string()));
    path.push(".cameleer");
    path.push("skills");
    if !path.exists() {
        let _ = fs::create_dir_all(&path);
    }
    path
}

pub fn parse_markdown_playbook(id: String, content: &str) -> Option<PlaybookSkill> {
    let trimmed = content.trim();
    if !trimmed.starts_with("---") {
        return None;
    }
    
    let parts: Vec<&str> = trimmed.split("---").collect();
    if parts.len() < 3 {
        return None;
    }
    
    let yaml_block = parts[1];
    let body_block = parts[2..].join("---");
    
    let mut name = String::new();
    let mut desc = String::new();
    let mut tools = Vec::new();
    let mut inputs = Vec::new();
    let mut status = "Active".to_string();
    
    for line in yaml_block.lines() {
        let line = line.trim();
        if line.starts_with("name:") {
            name = line[5..].trim().trim_matches('"').trim_matches('\'').to_string();
        } else if line.starts_with("desc:") {
            desc = line[5..].trim().trim_matches('"').trim_matches('\'').to_string();
        } else if line.starts_with("description:") {
            desc = line[12..].trim().trim_matches('"').trim_matches('\'').to_string();
        } else if line.starts_with("status:") {
            status = line[7..].trim().trim_matches('"').trim_matches('\'').to_string();
        } else if line.starts_with("tools:") {
            let tools_part = line[6..].trim();
            if tools_part.starts_with('[') && tools_part.ends_with(']') {
                tools = tools_part[1..tools_part.len()-1]
                    .split(',')
                    .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
            }
        } else if line.starts_with("inputs:") {
            let inputs_part = line[7..].trim();
            if inputs_part.starts_with('[') && inputs_part.ends_with(']') {
                inputs = inputs_part[1..inputs_part.len()-1]
                    .split(',')
                    .map(|s| s.trim().trim_matches('"').trim_matches('\'').to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
            }
        }
    }
    
    if name.is_empty() {
        name = id.clone();
    }
    
    Some(PlaybookSkill {
        id,
        frontmatter: PlaybookFrontmatter {
            name,
            desc,
            tools,
            inputs,
            status,
        },
        content: body_block.trim().to_string(),
    })
}

#[tauri::command]
pub fn get_skill_playbooks() -> Result<Vec<PlaybookSkill>, String> {
    let dir = get_skills_dir();
    let mut skills = Vec::new();
    
    let entries = fs::read_dir(&dir).map_err(|e| e.to_string())?;
    for entry in entries {
        if let Ok(entry) = entry {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                let filename = path.file_stem().and_then(|s| s.to_str()).unwrap_or("unknown");
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Some(skill) = parse_markdown_playbook(filename.to_string(), &content) {
                        skills.push(skill);
                    }
                }
            }
        }
    }
    
    // Sort by ID for stable UI listing
    skills.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(skills)
}

#[tauri::command]
pub fn save_skill_playbook(id: String, yaml_frontmatter: PlaybookFrontmatter, content: String) -> Result<(), String> {
    let dir = get_skills_dir();
    let filepath = dir.join(format!("{}.md", id.trim().to_lowercase().replace(' ', "-")));
    
    // Formulate clean playbook markdown file with YAML frontmatter
    let tools_str = format!("{:?}", yaml_frontmatter.tools);
    let inputs_str = format!("{:?}", yaml_frontmatter.inputs);
    
    let file_content = format!(
        "---\n\
         name: \"{}\"\n\
         desc: \"{}\"\n\
         tools: {}\n\
         inputs: {}\n\
         status: \"{}\"\n\
         ---\n\n\
         {}",
        yaml_frontmatter.name,
        yaml_frontmatter.desc,
        tools_str,
        inputs_str,
        yaml_frontmatter.status,
        content.trim()
    );
    
    fs::write(filepath, file_content).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn delete_skill_playbook(id: String) -> Result<(), String> {
    let dir = get_skills_dir();
    let filepath = dir.join(format!("{}.md", id.trim().to_lowercase().replace(' ', "-")));
    
    if filepath.exists() {
        fs::remove_file(filepath).map_err(|e| e.to_string())?;
    }
    Ok(())
}

pub fn seed_default_playbooks() {
    let dir = get_skills_dir();
    
    // Check if skills directory is empty
    if let Ok(entries) = fs::read_dir(&dir) {
        let count = entries.filter_map(|e| e.ok()).count();
        if count > 0 {
            return; // Already seeded or customized
        }
    }
    
    let defaults = vec![
        (
            "file-write",
            PlaybookFrontmatter {
                name: "File Saver & Mutator".to_string(),
                desc: "Physically saves and updates files on host directories, specifically whitelisted to Desktop. Automatically parses annotations inside markdown blocks.".to_string(),
                tools: vec!["std::fs::write".to_string(), "std::fs::create_dir_all".to_string()],
                inputs: vec!["path".to_string(), "content".to_string()],
                status: "Active & Whitelisted".to_string(),
            },
            "# File Saver playbook\nAllows Cameleer dynamic agent crew to record outputs and save code physically on the host computer. Whitelisted to the active user Desktop."
        ),
        (
            "shell-exec",
            PlaybookFrontmatter {
                name: "Host Shell Executor".to_string(),
                desc: "Launches shell commands via standard command processes, dynamically feeding outcomes back to agent memory blocks. Safely blocks recursive deletion flags.".to_string(),
                tools: vec!["std::process::Command".to_string()],
                inputs: vec!["command".to_string()],
                status: "Active & Whitelisted".to_string(),
            },
            "# Host Shell Executor playbook\nGrants local agents access to execute secure CLI commands synchronously. Restricts flags like -rf or root admin calls."
        ),
        (
            "system-info",
            PlaybookFrontmatter {
                name: "System Profiler".to_string(),
                desc: "Checks current operating system platforms, gathers active hardware statistics, processes, and logs, compiling rich Markdown system reports.".to_string(),
                tools: vec!["df -h".to_string(), "uname".to_string(), "ps".to_string()],
                inputs: vec![],
                status: "Active & Whitelisted".to_string(),
            },
            "# System Profiler playbook\nAllows active specialists to audit host operating system characteristics, available disk storage levels, and CPU structures."
        ),
        (
            "multi-agent",
            PlaybookFrontmatter {
                name: "Blackboard Crew Orchestrator".to_string(),
                desc: "Triggers joint coordination by feeding the shared awareness blackboard context to multiple agents, allowing concurrent planning and consensus.".to_string(),
                tools: vec!["Blackboard Context Engine".to_string()],
                inputs: vec!["shared_objective".to_string()],
                status: "Active & Whitelisted".to_string(),
            },
            "# Blackboard Crew Orchestrator playbook\nGoverns communication flows and updates dynamically posted goals onto the global coordination blackboard."
        ),
        (
            "web-crawler",
            PlaybookFrontmatter {
                name: "HTML Client & Crawler".to_string(),
                desc: "Fetches live web content and APIs using curl under whitelisted network proxies, giving agents basic internet search and read capabilities.".to_string(),
                tools: vec!["curl".to_string(), "wttr.in".to_string()],
                inputs: vec!["url".to_string()],
                status: "Active & Whitelisted".to_string(),
            },
            "# HTML Client playbook\nAllows edge engines to run basic HTTP queries and read raw responses using whitelisted curl processes."
        ),
    ];
    
    for (id, fm, content) in defaults {
        let _ = save_skill_playbook(id.to_string(), fm, content.to_string());
    }
}
