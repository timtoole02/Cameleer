mod config;
mod storage;
mod skills;
mod agent;
mod gateway;

use std::sync::Arc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let command = args.get(1).map(|s| s.as_str()).unwrap_or("run");

    match command {
        "onboard" => {
            println!("⚙️  Starting Cameleer Onboarding Sequence...");
            // Initialize config
            let _cfg = config::load()?;
            println!("✅ Config file loaded and validated at {:?}", config::get_config_path());
            
            // Initialize instruction templates (SOUL.md, AGENTS.md, TOOLS.md)
            config::init_instruction_templates()?;
            println!("✅ Dynamic instruction templates (SOUL.md, AGENTS.md, TOOLS.md) registered under ~/.cameleer/");

            // Initialize database
            let _store = storage::Storage::new()?;
            println!("✅ SQLite memory database initialized successfully.");

            // Initialize skills
            skills::init_default_skills()?;
            println!("✅ Demo skills registered under ~/.cameleer/skills/");
            
            println!("\n✨ Onboarding Complete! Run `cargo run` or `cameleer run` to start the agent.");
        }
        "skills" => {
            // Load and display skills
            match skills::load_skills() {
                Ok(skills) => {
                    println!("\n📂 Active Cameleer Skills:\n");
                    if skills.is_empty() {
                        println!("   No skills loaded. Place SKILL.md files inside ~/.cameleer/skills/");
                    } else {
                        for (i, skill) in skills.iter().enumerate() {
                            println!("   {}. [{}]", i + 1, skill.name);
                            println!("      Description: {}", skill.description);
                            println!("      Path: {:?}", skill.path);
                            println!();
                        }
                    }
                }
                Err(e) => println!("❌ Error loading skills: {}", e),
            }
        }
        "install" => {
            let skill_name = args.get(2);
            match skill_name {
                Some(name) => {
                    if let Err(e) = skills::install_skill(name).await {
                        println!("❌ Failed to install skill: {}", e);
                    }
                }
                None => {
                    println!("❌ Please specify the skill name to install. Example: cargo run install weather-check");
                }
            }
        }
        "run" => {
            // Load configs
            let cfg = config::load()?;
            
            // Initialize storage
            let store = storage::Storage::new()?;
            
            // Ensure default skills exist
            skills::init_default_skills()?;

            // Create Agent
            let agent = Arc::new(agent::Agent::new(cfg.clone(), store.clone())?);

            println!("✦ Initializing Cameleer Agent System...");

            // Start integrated local inference daemon in the background
            let daemon_agent = Arc::clone(&agent);
            tokio::spawn(async move {
                if let Err(e) = daemon_agent.start_inference_daemon().await {
                    eprintln!("❌ Failed to start integrated local inference daemon: {}", e);
                }
            });

            // Start continuous background autonomous orchestrator
            let auto_agent = Arc::clone(&agent);
            tokio::spawn(async move {
                agent::autonomous::start_background_orchestrator(auto_agent).await;
            });

            // 1. Spawn Telegram Bot gateway if enabled
            if cfg.gateways.telegram.enabled {
                let tg_agent = Arc::clone(&agent);
                let tg_config = cfg.clone();
                tokio::spawn(async move {
                    if let Err(e) = gateway::telegram::run(tg_agent, tg_config).await {
                        eprintln!("❌ Telegram Gateway Error: {}", e);
                    }
                });
            }

            // Spawn Discord Bot gateway if enabled
            if cfg.gateways.discord.enabled {
                let discord_agent = Arc::clone(&agent);
                let discord_config = cfg.clone();
                tokio::spawn(async move {
                    if let Err(e) = gateway::discord::run(discord_agent, discord_config).await {
                        eprintln!("❌ Discord Gateway Error: {}", e);
                    }
                });
            }

            // Spawn Web Dashboard gateway (always runs on port 8080)
            let web_agent = Arc::clone(&agent);
            tokio::spawn(async move {
                if let Err(e) = gateway::web::run(web_agent).await {
                    eprintln!("❌ Web Gateway Error: {}", e);
                }
            });

            // 2. Start Console gateway (runs in main thread if it is an active terminal/TTY)
            use std::io::IsTerminal;
            if cfg.gateways.console.enabled && std::io::stdout().is_terminal() {
                gateway::console::run(agent).await?;
            } else {
                if !std::io::stdout().is_terminal() {
                    println!("No active TTY detected. Spawning background services in headless mode.");
                } else {
                    println!("Console gateway is disabled. Cameleer is running background services.");
                }
                // Keep the main thread alive since console is disabled or no TTY
                loop {
                    tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await;
                }
            }
        }
        _ => {
            print_help();
        }
    }

    Ok(())
}

fn print_help() {
    println!("\n🤖 Cameleer CLI Usage:");
    println!("   cargo run onboard        - Initialize configuration, storage, and demo skills");
    println!("   cargo run skills         - List all installed skills");
    println!("   cargo run install <name> - Download and install a skill from ClawHub/GitHub");
    println!("   cargo run run            - Start active gateways (Console + background Telegram)");
    println!("   cargo run                - Default path: runs the agent with the Console interface\n");
}
