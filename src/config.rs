use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub llm: LlmConfig,
    pub gateways: GatewaysConfig,
    pub security: SecurityConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub provider: String, // "anthropic", "openai", "gemini", "ollama"
    pub anthropic_api_key: Option<String>,
    pub openai_api_key: Option<String>,
    pub gemini_api_key: Option<String>,
    pub ollama_url: String, // e.g. "http://localhost:11434"
    pub model: String, // e.g. "claude-3-5-sonnet-latest" or "gpt-4o"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatewaysConfig {
    pub console: ConsoleConfig,
    pub telegram: TelegramConfig,
    pub discord: DiscordConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConsoleConfig {
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelegramConfig {
    pub enabled: bool,
    pub bot_token: Option<String>,
    pub authorized_user_id: Option<i64>, // Restrict access to a single user for security
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscordConfig {
    pub enabled: bool,
    pub bot_token: Option<String>,
    pub authorized_channel_id: Option<u64>,
    pub authorized_user_id: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    pub require_approval: bool, // Require interactive user button click/input to execute shell commands
    pub allowed_commands: Vec<String>, // Whitelist of shell binaries allowed to run
    pub allowed_paths: Vec<String>, // Whitelist of directories the agent is allowed to write files to
}

impl Default for Config {
    fn default() -> Self {
        Self {
            llm: LlmConfig {
                provider: "camelid".to_string(),
                anthropic_api_key: None,
                openai_api_key: None,
                gemini_api_key: None,
                ollama_url: "http://localhost:11434".to_string(),
                model: "Llama-3.2-3B-Instruct-Q8_0.gguf".to_string(),
            },
            gateways: GatewaysConfig {
                console: ConsoleConfig { enabled: true },
                telegram: TelegramConfig {
                    enabled: false,
                    bot_token: None,
                    authorized_user_id: None,
                },
                discord: DiscordConfig {
                    enabled: false,
                    bot_token: None,
                    authorized_channel_id: None,
                    authorized_user_id: None,
                },
            },
            security: SecurityConfig {
                require_approval: true,
                allowed_commands: vec![
                    "ls".to_string(),
                    "pwd".to_string(),
                    "date".to_string(),
                    "cat".to_string(),
                    "echo".to_string(),
                    "curl".to_string(),
                    "grep".to_string(),
                    "uname".to_string(),
                    "python3".to_string(),
                    "sqlite3".to_string(),
                    "node".to_string(),
                    "cargo".to_string(),
                    "git".to_string(),
                    "mkdir".to_string(),
                    "rm".to_string(),
                ],
                allowed_paths: vec![
                    "/Users/timtoole/.gemini/antigravity/scratch/cameleer".to_string(),
                    "/Users/timtoole/.cameleer".to_string(),
                    "/Users/timtoole/Desktop/Code/cameleer".to_string(),
                ],
            },
        }
    }
}

pub fn get_config_dir() -> PathBuf {
    let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    Path::new(&home).join(".cameleer")
}

pub fn get_config_path() -> PathBuf {
    get_config_dir().join("config.toml")
}

pub fn load() -> Result<Config, Box<dyn std::error::Error>> {
    let config_dir = get_config_dir();
    let config_path = get_config_path();

    if !config_dir.exists() {
        fs::create_dir_all(&config_dir)?;
    }

    if !config_path.exists() {
        let default_config = Config::default();
        let toml_string = toml::to_string_pretty(&default_config)?;
        
        let comment_header = r#"# Cameleer Configuration File
# Edit this file to configure your AI agent, gateways, and safety parameters.

"#;
        fs::write(&config_path, format!("{}{}", comment_header, toml_string))?;
        println!("Created default configuration file at {:?}", config_path);
    }

    let config_content = fs::read_to_string(&config_path)?;
    let config: Config = toml::from_str(&config_content)?;
    Ok(config)
}

pub fn init_instruction_templates() -> Result<(), Box<dyn std::error::Error>> {
    let config_dir = get_config_dir();
    
    let soul_path = config_dir.join("SOUL.md");
    if !soul_path.exists() {
        let default_soul = r#"# Agent Soul & Persona
You are Cameleer, a premium, high-performance, and secure AI agent system written in Rust.
You act as an advanced, autonomous personal assistant that runs on the user's host operating system.
You follow the 'Iron Crab' way: reliable, strong, and highly protective of system safety. 🦀
"#;
        fs::write(&soul_path, default_soul)?;
        println!("Created default agent soul file at {:?}", soul_path);
    }

    let agents_path = config_dir.join("AGENTS.md");
    if !agents_path.exists() {
        let default_agents = r#"# Baseline Operational Instructions
Your core capability is executing shell commands safely to perform complex workflows.
You do this using the 'skills' loaded in your environment.
"#;
        fs::write(&agents_path, default_agents)?;
        println!("Created default operational baseline file at {:?}", agents_path);
    }

    let tools_path = config_dir.join("TOOLS.md");
    if !tools_path.exists() {
        let default_tools = r#"# Core Tooling & Security Guardrails
- You are running on macOS/Linux. Keep commands compatible with standard shells.
- Do NOT execute commands not specified in your skills unless you absolutely have to.
- Be concise. Focus on delivering premium, high-quality answers.
- If a command fails or is denied, explain it honestly and suggest an alternative.
"#;
        fs::write(&tools_path, default_tools)?;
        println!("Created default tooling guardrails file at {:?}", tools_path);
    }

    Ok(())
}
