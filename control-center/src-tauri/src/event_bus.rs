use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppEvent {
    pub event_type: String, // "heartbeat", "message", "task_updated", "agent_run_status", "system_log"
    pub agent_id: Option<String>,
    pub task_id: Option<String>,
    pub payload: serde_json::Value,
}

pub fn emit_event<R: Runtime>(app_handle: &AppHandle<R>, event: AppEvent) {
    let _ = app_handle.emit("cameleer-event", event);
}
