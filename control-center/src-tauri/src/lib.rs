mod storage;
mod agent_registry;
mod router;
mod chat_service;
mod task_manager;
mod context_engine;
mod supervisor;
mod event_bus;

use storage::DbState;
use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to the Cameleer Control Center!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
            context_engine::get_blackboard_awareness,
            context_engine::update_shared_state,
            supervisor::update_heartbeat
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
