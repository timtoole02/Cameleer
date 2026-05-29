use serde::{Deserialize, Serialize};
use rusqlite::{params, Connection, Result};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentState {
    Idle,
    Assigned,
    Planning,
    Working,
    WaitingForTool,
    WaitingForHuman,
    WaitingForAgent,
    Blocked,
    WaitingForReview,
    Validating,
    Completed,
    Failed,
    Recovering,
    Paused,
    Stopped,
}

impl AgentState {
    pub fn as_str(&self) -> &'static str {
        match self {
            AgentState::Idle => "idle",
            AgentState::Assigned => "assigned",
            AgentState::Planning => "planning",
            AgentState::Working => "working",
            AgentState::WaitingForTool => "waiting_for_tool",
            AgentState::WaitingForHuman => "waiting_for_human",
            AgentState::WaitingForAgent => "waiting_for_agent",
            AgentState::Blocked => "blocked",
            AgentState::WaitingForReview => "waiting_for_review",
            AgentState::Validating => "validating",
            AgentState::Completed => "completed",
            AgentState::Failed => "failed",
            AgentState::Recovering => "recovering",
            AgentState::Paused => "paused",
            AgentState::Stopped => "stopped",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "idle" => AgentState::Idle,
            "assigned" => AgentState::Assigned,
            "planning" => AgentState::Planning,
            "working" => AgentState::Working,
            "waiting_for_tool" => AgentState::WaitingForTool,
            "waiting_for_human" => AgentState::WaitingForHuman,
            "waiting_for_agent" => AgentState::WaitingForAgent,
            "blocked" => AgentState::Blocked,
            "waiting_for_review" => AgentState::WaitingForReview,
            "validating" => AgentState::Validating,
            "completed" => AgentState::Completed,
            "failed" => AgentState::Failed,
            "recovering" => AgentState::Recovering,
            "paused" => AgentState::Paused,
            "stopped" => AgentState::Stopped,
            _ => AgentState::Idle,
        }
    }
}

pub fn is_transition_allowed(from: &AgentState, to: &AgentState) -> bool {
    // Explicitly allowed transitions
    match (from, to) {
        // Any state can transition to stopped/paused
        (_, AgentState::Stopped) | (_, AgentState::Paused) => true,
        
        // Idle transitions
        (AgentState::Idle, AgentState::Assigned) => true,
        
        // Assigned transitions
        (AgentState::Assigned, AgentState::Planning) => true,
        (AgentState::Assigned, AgentState::Working) => true,
        
        // Planning transitions
        (AgentState::Planning, AgentState::Working) => true,
        (AgentState::Planning, AgentState::Blocked) => true,
        
        // Working transitions
        (AgentState::Working, AgentState::WaitingForTool) => true,
        (AgentState::Working, AgentState::WaitingForHuman) => true,
        (AgentState::Working, AgentState::WaitingForAgent) => true,
        (AgentState::Working, AgentState::Blocked) => true,
        (AgentState::Working, AgentState::Validating) => true,
        (AgentState::Working, AgentState::Failed) => true,
        (AgentState::Working, AgentState::Idle) => true, // Done and waiting for new work
        
        // Wait transitions
        (AgentState::WaitingForTool, AgentState::Working) => true,
        (AgentState::WaitingForTool, AgentState::Failed) => true,
        
        (AgentState::WaitingForHuman, AgentState::Working) => true,
        (AgentState::WaitingForAgent, AgentState::Working) => true,
        
        // Validating transitions
        (AgentState::Validating, AgentState::WaitingForReview) => true,
        (AgentState::Validating, AgentState::Working) => true, // Validation failed, go back to work
        (AgentState::Validating, AgentState::Failed) => true,
        
        // Review transitions
        (AgentState::WaitingForReview, AgentState::Completed) => true,
        (AgentState::WaitingForReview, AgentState::Working) => true, // Review rejected
        
        // Blocked transitions
        (AgentState::Blocked, AgentState::Working) => true,
        
        // Failed / Recovering transitions
        (AgentState::Failed, AgentState::Recovering) => true,
        (AgentState::Recovering, AgentState::Working) => true,
        (AgentState::Recovering, AgentState::Blocked) => true,
        (AgentState::Recovering, AgentState::Failed) => true, // Recovery failed
        
        // Paused transitions
        (AgentState::Paused, AgentState::Working) => true,
        (AgentState::Paused, AgentState::Idle) => true,
        
        // Completed transitions
        (AgentState::Completed, AgentState::Idle) => true, // Ready for next task
        
        _ => false
    }
}

pub fn transition_agent_state(
    conn: &Connection, 
    agent_id: &str, 
    from_state: AgentState, 
    to_state: AgentState, 
    reason: &str
) -> Result<(), String> {
    
    if !is_transition_allowed(&from_state, &to_state) {
        return Err(format!("Transition from {:?} to {:?} is not allowed. Reason given: {}", from_state, to_state, reason));
    }

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();

    let to_str = to_state.as_str();

    // Update database
    conn.execute(
        "UPDATE agents SET status = ?1, last_heartbeat = ?2 WHERE id = ?3",
        params![to_str, now, agent_id],
    ).map_err(|e| format!("Failed to update agent status: {}", e))?;

    // Record the transition event
    let payload = serde_json::json!({
        "from": from_state.as_str(),
        "to": to_str,
        "reason": reason
    });

    conn.execute(
        "INSERT INTO events (event_type, agent_id, payload) VALUES ('state_transition', ?1, ?2)",
        params![agent_id, payload.to_string()],
    ).map_err(|e| format!("Failed to log state transition event: {}", e))?;

    println!("[STATE MACHINE] Agent {} transitioned {} -> {}. Reason: {}", agent_id, from_state.as_str(), to_str, reason);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_transitions() {
        assert!(is_transition_allowed(&AgentState::Idle, &AgentState::Assigned));
        assert!(is_transition_allowed(&AgentState::Assigned, &AgentState::Working));
        assert!(is_transition_allowed(&AgentState::Working, &AgentState::Validating));
        assert!(is_transition_allowed(&AgentState::Validating, &AgentState::Working));
        assert!(is_transition_allowed(&AgentState::Working, &AgentState::Idle));
        assert!(is_transition_allowed(&AgentState::Recovering, &AgentState::Working));
        assert!(is_transition_allowed(&AgentState::Working, &AgentState::Stopped));
    }

    #[test]
    fn test_invalid_transitions() {
        assert!(!is_transition_allowed(&AgentState::Idle, &AgentState::Validating));
        assert!(!is_transition_allowed(&AgentState::Validating, &AgentState::Assigned));
        assert!(!is_transition_allowed(&AgentState::Idle, &AgentState::Completed));
    }

    #[test]
    fn test_from_str() {
        assert_eq!(AgentState::from_str("idle"), AgentState::Idle);
        assert_eq!(AgentState::from_str("working"), AgentState::Working);
        assert_eq!(AgentState::from_str("invalid_state"), AgentState::Idle);
    }
}
