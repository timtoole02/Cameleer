pub mod llm;
pub mod daemon;
pub mod autonomous;

use crate::config::Config;
use crate::storage::Storage;
use crate::agent::llm::{create_client, LlmClient};
use crate::agent::daemon::DaemonManager;
use crate::skills::sandbox::{Sandbox, ExecutionResult};
use crate::skills::{load_skills, Skill};

pub struct Agent {
    #[allow(dead_code)]
    config: Config,
    storage: Storage,
    llm: LlmClient,
    sandbox: Sandbox,
    daemon: DaemonManager,
}

impl Agent {
    pub fn new(config: Config, storage: Storage) -> Result<Self, Box<dyn std::error::Error>> {
        let llm = create_client(&config)?;
        let sandbox = Sandbox::new(config.clone(), storage.clone());
        let daemon = DaemonManager::new();
        Ok(Self {
            config,
            storage,
            llm,
            sandbox,
            daemon,
        })
    }

    pub fn storage(&self) -> &Storage {
        &self.storage
    }

    pub fn config(&self) -> &Config {
        &self.config
    }

    pub async fn start_inference_daemon(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.daemon.start(&self.config.llm.model).await
    }

    pub async fn stop_inference_daemon(&self) {
        self.daemon.stop().await;
    }

    pub async fn restart_inference_daemon(&self, new_model_name: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.daemon.start(new_model_name).await
    }

    /// Primary entrypoint to process a message inside a session. Runs the autonomous ReAct cycle.
    pub async fn process_message(&self, session_id: &str, user_message: &str, session_type: &str) -> Result<String, Box<dyn std::error::Error>> {
        // 1. Parse agent_id from session_id (format: [agent_id]_[channel])
        let parts: Vec<&str> = session_id.split('_').collect();
        let agent_id = parts.first().cloned().unwrap_or("agent-coder");

        // Update agent status to thinking
        let _ = self.storage.update_agent_status(agent_id, "thinking");

        let result = self.process_message_internal(session_id, agent_id, user_message, session_type).await;

        // Force reset agent status to idle (unless waiting for approval)
        if let Ok(Some(profile)) = self.storage.get_agent(agent_id) {
            if profile.status != "waiting_approval" {
                let _ = self.storage.update_agent_status(agent_id, "idle");
            }
        } else {
            let _ = self.storage.update_agent_status(agent_id, "idle");
        }

        result
    }

    async fn process_message_internal(&self, session_id: &str, agent_id: &str, user_message: &str, session_type: &str) -> Result<String, Box<dyn std::error::Error>> {
        // 2. Load agent profile from SQLite to fetch customized persona and model
        let mut active_llm = &self.llm;
        let mut temp_client = None;
        let mut custom_persona = None;

        if let Ok(Some(profile)) = self.storage.get_agent(agent_id) {
            custom_persona = Some(profile.persona.clone());
            
            // Build dynamic LLM client if provider or model name differs
            if profile.model_provider != self.config.llm.provider || profile.model_name != self.config.llm.model {
                let mut temp_cfg = self.config.clone();
                temp_cfg.llm.provider = profile.model_provider.clone();
                temp_cfg.llm.model = profile.model_name.clone();
                if let Ok(client) = create_client(&temp_cfg) {
                    temp_client = Some(client);
                }
            }
        }

        if let Some(ref client) = temp_client {
            active_llm = client;
        }

        // 3. Save user message to database
        self.storage.save_message(session_id, "user", user_message)?;

        let mut loop_count = 0;
        let max_loops = 5;
        let mut executed_commands = Vec::new();

        // Loop until LLM responds without requesting a tool execution
        loop {
            loop_count += 1;
            if loop_count > max_loops {
                let err_msg = "🤖 [Self-Healing Engine Alert]: I have executed 5 autonomous steps and attempted multiple actions, \
                but I was unable to complete the task within execution limits. To prevent infinite loops, I have paused execution. \
                Please review my terminal log stream on the Web Dashboard or check the whitelisted command list.";
                self.storage.save_message(session_id, "assistant", err_msg)?;
                return Ok(err_msg.to_string());
            }

            // 4. Fetch history (limit to last 20 messages for context window management)
            let history = self.storage.get_messages(session_id, 20)?;

            // 5. Load skills playbooks
            let skills = load_skills().unwrap_or_default();
            
            // 6. Build system prompt
            let system_prompt = self.build_system_prompt(&skills, custom_persona.as_deref());

            // 7. Query LLM
            println!("🤖 Agent [{}] thinking...", agent_id);
            let response = active_llm.chat(history, &system_prompt).await?;

            // 8. Check if LLM requested a tool execution
            if let Some(command) = self.extract_tool_execution(&response) {
                println!("🛠️  Agent [{}] wants to execute command: {}", agent_id, command);
                
                // Save assistant reasoning with tool execution request
                self.storage.save_message(session_id, "assistant", &response)?;

                // Check for command execution loops
                let cleaned_cmd = command.trim().to_string();
                if executed_commands.contains(&cleaned_cmd) {
                    println!("🛡️  [Self-Healing Engine] Command loop detected for: '{}'. Injecting reflection prompt...", cleaned_cmd);
                    
                    let self_healing_alert = format!(
                        "🤖 [SYSTEM SELF-HEALING WARNING]: You have already executed the command `{}` in this turn. \
                        Repeating the same action is forbidden to prevent infinite loops. \
                        Please review the previous command outputs, analyze what blockages occurred, and change your strategy. \
                        If you cannot fulfill the goal with whitelisted skills, report the exact block to the user.",
                        cleaned_cmd
                    );

                    self.storage.save_message(session_id, "user", &self_healing_alert)?;
                    continue;
                }

                executed_commands.push(cleaned_cmd.clone());

                // Update agent status to waiting approval
                let _ = self.storage.update_agent_status(agent_id, "waiting_approval");

                // Execute in sandbox
                let exec_res = self.sandbox.execute(&command, session_type).await;

                // Format outcome
                let outcome_text = match exec_res {
                    ExecutionResult::Success(stdout) => {
                        format!("[Execution Success]:\n{}", stdout)
                    }
                    ExecutionResult::Failed(stderr) => {
                        format!(
                            "[Execution Failed]:\n{}\n\n\
                            ⚠️ [SYSTEM DIAGNOSTIC ALERT]: The command returned a non-zero exit code or stderr. \
                            Please carefully inspect the error details above. \
                            If you made a typo (such as invalid arguments or paths), correct it and try the fixed command. \
                            If the binary behaves unexpectedly, consider an alternative approach or report the blockage.",
                            stderr
                        )
                    }
                    ExecutionResult::Denied => {
                        "[Execution Denied]: The user did not approve this command execution.".to_string()
                    }
                    ExecutionResult::Blocked(reason) => {
                        format!("[Execution Blocked]: Command blocked by security sandbox. Reason: {}", reason)
                    }
                };

                println!("📝 Outcome recorded: {}", outcome_text.lines().next().unwrap_or(""));
                
                // Save execution outcome as a tool message back to context
                self.storage.save_message(session_id, "user", &format!(
                    "Tool Command: `{}`\nOutput:\n{}", command, outcome_text
                ))?;

                // Set agent status back to thinking since we are continuing the loop
                let _ = self.storage.update_agent_status(agent_id, "thinking");

                // Continue loop to let agent see result and reason again
                continue;
            } else {
                // No tool execution requested, this is the final answer!
                self.storage.save_message(session_id, "assistant", &response)?;
                return Ok(response);
            }
        }
    }

    fn build_system_prompt(&self, skills: &[Skill], custom_persona: Option<&str>) -> String {
        let mut skill_definitions = String::new();
        for (i, skill) in skills.iter().enumerate() {
            skill_definitions.push_str(&format!(
                "{}. Skill name: {}\n   Description: {}\n   Playbook/Instructions:\n{}\n\n",
                i + 1, skill.name, skill.description, skill.instructions
            ));
        }

        // Dynamically read core instruction files if they exist
        let config_dir = crate::config::get_config_dir();
        
        let soul_content = if let Some(persona) = custom_persona {
            persona.to_string()
        } else {
            std::fs::read_to_string(config_dir.join("SOUL.md"))
                .unwrap_or_else(|_| {
                    "You are Cameleer, a premium, high-performance, and secure AI agent system written in Rust.\n\
                    You act as an advanced, autonomous personal assistant that runs on the user's host operating system.\n\
                    You follow the 'Iron Crab' way: reliable, strong, and highly protective of system safety. 🦀".to_string()
                })
        };

        let agents_content = std::fs::read_to_string(config_dir.join("AGENTS.md"))
            .unwrap_or_else(|_| {
                "Your core capability is executing shell commands safely to perform complex workflows.\n\
                You do this using the 'skills' loaded in your environment.".to_string()
            });

        let tools_content = std::fs::read_to_string(config_dir.join("TOOLS.md"))
            .unwrap_or_else(|_| {
                "- You are running on macOS/Linux. Keep commands compatible with standard shells.\n\
                - Do NOT execute commands not specified in your skills unless you absolutely have to.\n\
                - Be concise. Focus on delivering premium, high-quality answers.\n\
                - If a command fails or is denied, explain it honestly and suggest an alternative.".to_string()
            });

        format!(
            "### Agent Soul & Persona:\n\
            {}\n\n\
            ### Baseline Operational Instructions:\n\
            {}\n\n\
            ### Available Skills:\n\
            {}\n\
            ### Execution Protocol:\n\
            If you need to perform an action outlined in a skill, you MUST write the exact command you want to execute inside a 'tool-exec' markdown code block. Example:\n\
            ```tool-exec\n\
            curl \"wttr.in/Paris?format=3\"\n\
            ```\n\
            - Write EXACTLY one command block per turn.\n\
            - Do not write anything else inside or after the block during that turn.\n\
            - Once written, the system will execute it and provide the results in the next turn.\n\
            - You can chain commands sequentially across turns to accomplish complex playbooks.\n\n\
            ### Core Tooling & Security Guardrails:\n\
            {}\n\n\
            ### Critical Focus Directive:\n\
            - Stay strictly focused on completing the user's primary request.\n\
            - Do NOT enter into endless command loops. If a command returns the same error twice, STOP and explain the blockage to the user.\n\
            - Deliver high-quality, professional, and elegant markdown answers.",
            soul_content, agents_content, skill_definitions, tools_content
        )
    }

    fn extract_tool_execution(&self, content: &str) -> Option<String> {
        let tag_start = "```tool-exec";
        let tag_end = "```";

        if let Some(start_idx) = content.find(tag_start) {
            let start_sub = &content[start_idx + tag_start.len()..];
            if let Some(end_idx) = start_sub.find(tag_end) {
                let cmd = &start_sub[..end_idx];
                return Some(cmd.trim().to_string());
            }
        }
        None
    }
}
