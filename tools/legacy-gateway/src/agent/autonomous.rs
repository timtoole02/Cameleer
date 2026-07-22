use std::sync::Arc;
use std::time::Duration;
use crate::agent::Agent;

pub async fn start_background_orchestrator(agent_supervisor: Arc<Agent>) {
    println!("🤖 Starting continuous Autonomous Agent Orchestrator background service...");
    
    loop {
        // Sleep for 15 seconds between ticks to give breathing room and allow manual approvals
        tokio::time::sleep(Duration::from_secs(15)).await;
        
        let agents = match agent_supervisor.storage().get_agents() {
            Ok(list) => list,
            Err(e) => {
                eprintln!("❌ Autonomous Orchestrator: failed to read agents from database: {}", e);
                continue;
            }
        };

        for agent in agents {
            if !agent.is_autonomous {
                continue;
            }

            // Only run if the agent is currently idle
            if agent.status != "idle" {
                continue;
            }

            let goal = match agent.autonomous_goal.as_ref() {
                Some(g) if !g.trim().is_empty() => g,
                _ => continue, // Skip if goal is empty
            };

            let session_id = format!("{}_sandbox", agent.id);

            // Fetch the chat history for the sandbox channel
            let messages = match agent_supervisor.storage().get_messages(&session_id, 5) {
                Ok(msgs) => msgs,
                Err(_) => continue,
            };

            let should_prompt = if messages.is_empty() {
                true
            } else {
                // Only prompt if the last message was from the assistant, meaning the agent finished its previous turn
                messages.last().map(|m| m.role == "assistant").unwrap_or(false)
            };

            if should_prompt {
                let prompt = if messages.is_empty() {
                    format!(
                        "Start working on your designated background autonomous goal: '{}'. \
                         Remember, you can execute whitelisted shell commands using ```tool-exec blocks, \
                         analyze logs, and report outcomes directly inside this sandbox. Keep working until the goal is fully achieved. \
                         Write your first thought and action now.",
                        goal
                    )
                } else {
                    format!(
                        "Continue working on your background autonomous goal: '{}'. \
                         Analyze the previous results, check if anything else needs to be done, and proceed. \
                         If the goal is fully accomplished, write a final summary detailing the work done and rest. \
                         Otherwise, execute the next step. Write your thought and action now.",
                        goal
                    )
                };

                let supervisor_clone = Arc::clone(&agent_supervisor);
                let session_clone = session_id.clone();
                let agent_id = agent.id.clone();
                let agent_name = agent.name.clone();
                
                tokio::spawn(async move {
                    println!("🚀 Autonomous Orchestrator: Triggering background loop for [{}]...", agent_name);
                    let _ = supervisor_clone.storage().update_agent_status(&agent_id, "thinking");
                    if let Err(e) = supervisor_clone.process_message(&session_clone, &prompt, "headless").await {
                        eprintln!("❌ Autonomous Orchestrator: Error running loop for [{}]: {}", agent_name, e);
                    }
                    let _ = supervisor_clone.storage().update_agent_status(&agent_id, "idle");
                });
            }
        }
    }
}
