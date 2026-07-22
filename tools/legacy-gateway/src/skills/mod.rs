pub mod sandbox;

use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub instructions: String,
    pub path: PathBuf,
}

pub fn get_skills_dir() -> PathBuf {
    crate::config::get_config_dir().join("skills")
}

pub fn init_default_skills() -> Result<(), Box<dyn std::error::Error>> {
    let skills_dir = get_skills_dir();
    if !skills_dir.exists() {
        fs::create_dir_all(&skills_dir)?;
    }

    // Check if empty, and write two premium default skills
    let entries = fs::read_dir(&skills_dir)?;
    let mut count = 0;
    for _ in entries {
        count += 1;
    }

    if count == 0 {
        // 1. Weather check skill
        let weather_dir = skills_dir.join("weather-check");
        fs::create_dir_all(&weather_dir)?;
        let weather_skill = r#"---
name: weather-check
description: Fetches current weather information for a specified city using wttr.in.
---

# Weather Check Skill
Use this skill when the user asks for the weather forecast, temperature, or conditions in any city.

## Workflow
1. Identify the city name from the user's message.
2. Execute the shell command:
   `curl "wttr.in/YOUR_CITY?format=3"` (Replace YOUR_CITY with the target city).
3. Report the exact output of curl directly to the user.
"#;
        fs::write(weather_dir.join("SKILL.md"), weather_skill)?;

        // 2. System info skill
        let sys_dir = skills_dir.join("system-info");
        fs::create_dir_all(&sys_dir)?;
        let sys_skill = r#"---
name: system-info
description: Displays core information about the host operating system, memory, and disk usage.
---

# System Info Skill
Use this skill when the user asks for system statistics, storage usage, or CPU details.

## Workflow
1. Execute the shell command:
   `uname -a` (to fetch OS info)
2. Execute the shell command:
   `df -h` (to check disk usage)
3. Combine these outputs in a beautifully formatted markdown list for the user.
"#;
        fs::write(sys_dir.join("SKILL.md"), sys_skill)?;
        println!("Created default demonstration skills in ~/.cameleer/skills/");
    }

    Ok(())
}

pub fn parse_skill_file<P: AsRef<Path>>(path: P) -> Result<Skill, Box<dyn std::error::Error>> {
    let path = path.as_ref().to_path_buf();
    let content = fs::read_to_string(&path)?;
    let content = content.trim();

    if !content.starts_with("---") {
        return Err(format!("Missing YAML frontmatter markers (---) in {:?}", path).into());
    }

    let parts: Vec<&str> = content.splitn(3, "---").collect();
    if parts.len() < 3 {
        return Err(format!("Malformed YAML frontmatter in {:?}", path).into());
    }

    let yaml_str = parts[1].trim();
    let body = parts[2].trim();

    let mut name = String::new();
    let mut description = String::new();

    for line in yaml_str.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if let Some((key, val)) = line.split_once(':') {
            let key = key.trim();
            let val = val.trim().trim_matches('"').trim_matches('\'');
            if key == "name" {
                name = val.to_string();
            } else if key == "description" {
                description = val.to_string();
            }
        }
    }

    if name.is_empty() {
        return Err(format!("Skill at {:?} is missing a 'name' field in frontmatter", path).into());
    }

    Ok(Skill {
        name,
        description,
        instructions: body.to_string(),
        path,
    })
}

pub fn load_skills() -> Result<Vec<Skill>, Box<dyn std::error::Error>> {
    init_default_skills()?;
    let skills_dir = get_skills_dir();
    let mut skills = Vec::new();

    let entries = fs::read_dir(skills_dir)?;
    for entry in entries {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            let skill_file = path.join("SKILL.md");
            if skill_file.exists() {
                match parse_skill_file(&skill_file) {
                    Ok(skill) => skills.push(skill),
                    Err(e) => eprintln!("Error loading skill {:?}: {}", skill_file, e),
                }
            }
        }
    }

    Ok(skills)
}

pub async fn install_skill(skill_name: &str) -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    // Default ClawHub standard skills repository path
    let url = format!(
        "https://raw.githubusercontent.com/timtoole02/cameleer/main/skills/{}/SKILL.md",
        skill_name
    );

    println!("📥 Fetching skill '{}' from ClawHub standard repository...", skill_name);
    let resp = client.get(&url).send().await?;

    if !resp.status().is_success() {
        return Err(format!(
            "Skill '{}' not found in registry (HTTP status {}). Please verify the name or check ClawHub.",
            skill_name,
            resp.status()
        )
        .into());
    }

    let content = resp.text().await?;

    let skills_dir = get_skills_dir();
    let skill_dir = skills_dir.join(skill_name);
    if !skill_dir.exists() {
        fs::create_dir_all(&skill_dir)?;
    }

    let skill_file = skill_dir.join("SKILL.md");
    fs::write(&skill_file, content)?;

    println!("✅ Skill '{}' successfully installed at {:?}", skill_name, skill_file);
    Ok(())
}
