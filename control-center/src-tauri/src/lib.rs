mod storage;
mod agent_registry;
mod router;
mod chat_service;
mod task_manager;
mod context_engine;
mod supervisor;
mod event_bus;
mod agent_templates;
mod checkpoint_store;
mod work_engine;
mod command_guard;

use storage::DbState;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to the Cameleer Control Center!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // 1. Initialize SQLite Database
            let db_path = storage::get_db_path();
            println!("[DATABASE] Path: {:?}", db_path);
            
            let conn = rusqlite::Connection::open(db_path)
                .expect("Failed to open SQLite database");
                
            storage::init_db(&conn).expect("Failed to initialize database tables");
            storage::seed_default_agents(&conn).expect("Failed to seed default agents");
            
            // Manage SQLite connection in Tauri State
            app.manage(DbState {
                conn: std::sync::Mutex::new(conn),
            });
            
            // Initialize and Manage DaemonState in Tauri State
            let daemon_state = supervisor::DaemonState {
                child: std::sync::Arc::new(std::sync::Mutex::new(None)),
            };
            app.manage(daemon_state);
            
            // Synchronously spawn local camelid daemon on port 8181
            let db_state = app.state::<DbState>();
            let managed_daemon_state = app.state::<supervisor::DaemonState>();
            let _ = supervisor::spawn_camelid_daemon(&db_state, &managed_daemon_state, None);
            
            // 2. Start Supervisor Watchdog Daemon
            let app_handle = app.handle().clone();
            supervisor::start_watchdog(app_handle);
            
            println!("[SYSTEM] Cameleer core services successfully started.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            agent_registry::get_agents,
            agent_registry::create_agent,
            agent_registry::update_agent,
            agent_registry::delete_agent,
            router::list_provider_configs,
            router::save_provider_config,
            router::get_local_models,
            router::download_model,
            router::activate_model,
            chat_service::get_messages,
            chat_service::save_message,
            chat_service::trigger_agent_reply,
            task_manager::get_tasks,
            task_manager::create_task,
            task_manager::update_task_status,
            task_manager::create_task_blocker,
            task_manager::register_artifact,
            task_manager::get_artifacts,
            task_manager::read_artifact_file,
            task_manager::get_agent_work_queue,
            task_manager::claim_card,
            task_manager::update_card_progress,
            task_manager::complete_card,
            task_manager::decompose_task,
            task_manager::approve_subtasks,
            context_engine::get_blackboard_awareness,
            context_engine::get_workspace_context,
            context_engine::record_decision_cmd,
            context_engine::request_handoff_cmd,
            context_engine::resolve_handoff_cmd,
            context_engine::get_coordination_details,
            context_engine::update_shared_state,
            supervisor::update_heartbeat,
            agent_templates::list_templates,
            agent_templates::create_agent_from_template,
            agent_templates::create_software_team,
            agent_templates::create_coding_sprint,
            checkpoint_store::save_agent_checkpoint,
            checkpoint_store::get_latest_checkpoint,
            work_engine::get_work_engine_suggestions,
            command_guard::get_pending_command_approval,
            command_guard::resolve_command_approval
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(daemon_state) = app_handle.try_state::<supervisor::DaemonState>() {
                if let Ok(mut child_guard) = daemon_state.child.lock() {
                    if let Some(mut child) = child_guard.take() {
                        println!("[DAEMON] Cleaning up camelid process on exit...");
                        let _ = child.kill();
                    }
                }
            }
        }
    });
}
