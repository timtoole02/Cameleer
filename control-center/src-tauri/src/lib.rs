mod agent_conflict_detector;
mod agent_contracts;
mod agent_handoff_manager;
mod agent_identity;
mod agent_recovery_engine;
mod agent_registry;
mod agent_runtime_kernel;
mod agent_state_machine;
mod agent_templates;
mod agent_tool_controller;
mod agent_validation_engine;
mod agent_work_router;
mod backend_runtime;
mod board_services;
pub mod camelid_adapter;
mod chat_service;
mod checkpoint_store;
mod command_guard;
mod context_engine;
mod event_bus;
pub mod llm_adapter;
pub mod memory_engine;
mod mission_builder;
mod models_manager;
mod org_services;
mod router;
mod storage;
mod supervisor;
mod task_manager;
mod work_engine;
pub mod dataset_exporter;

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

            let conn = rusqlite::Connection::open(db_path).expect("Failed to open SQLite database");

            storage::init_db(&conn).expect("Failed to initialize database tables");
            storage::seed_default_agents(&conn).expect("Failed to seed default agents");

            // Manage SQLite connection in Tauri State
            app.manage(DbState {
                conn: std::sync::Mutex::new(conn),
            });

            // Initialize and Manage DaemonState in Tauri State for legacy handlers
            let daemon_state = supervisor::DaemonState {
                child: std::sync::Arc::new(std::sync::Mutex::new(None)),
            };
            app.manage(daemon_state);

            // Initialize and Manage BackendRuntimeManager in Tauri State
            let backend_manager = backend_runtime::BackendRuntimeManager::new();
            app.manage(backend_manager);

            // 2. Start Supervisor Watchdogs
            let app_handle = app.handle().clone();

            // Spawn asynchronous backend manager to keep UI responsive on startup
            tauri::async_runtime::spawn(async move {
                let _ = backend_runtime::ensure_backend_running(app_handle.clone()).await;
                backend_runtime::start_heartbeat_loop(app_handle);
            });

            // Start agent recovery watchdogs
            let app_handle_agents = app.handle().clone();
            supervisor::start_watchdog(app_handle_agents);

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
            chat_service::trigger_org_reply,
            task_manager::get_tasks,
            task_manager::update_task_status,
            task_manager::submit_review,
            dataset_exporter::export_finetuning_dataset,
            task_manager::create_task,
            task_manager::create_task_blocker,
            task_manager::get_agent_run_timeline,
            task_manager::register_artifact,
            task_manager::get_artifacts,
            task_manager::read_artifact_file,
            task_manager::claim_card,
            task_manager::update_card_progress,
            task_manager::complete_card,
            task_manager::decompose_task,
            task_manager::approve_subtasks,
            task_manager::get_agent_runs,
            task_manager::get_run_steps,
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
            command_guard::resolve_command_approval,
            mission_builder::list_mission_packs,
            mission_builder::generate_mission_preview,
            mission_builder::edit_mission_preview,
            mission_builder::apply_mission_preview,
            mission_builder::discard_mission_preview,
            mission_builder::save_mission_pack_from_preview,
            mission_builder::get_active_missions_progress,
            mission_builder::get_autopilot_settings,
            mission_builder::update_autopilot_settings,
            mission_builder::get_mission_recommendations,
            mission_builder::dismiss_recommendation,
            mission_builder::get_agent_contract,
            mission_builder::get_mission_audit_events,
            mission_builder::get_work_receipt,
            mission_builder::generate_work_receipt,
            models_manager::list_model_catalog,
            models_manager::search_remote_models,
            models_manager::generate_model_preflight,
            models_manager::queue_model_download,
            models_manager::pause_model_download,
            models_manager::resume_model_download,
            models_manager::cancel_model_download,
            models_manager::import_local_model,
            models_manager::delete_model,
            models_manager::activate_model_scoped,
            models_manager::run_model_smoke_test,
            models_manager::get_model_details,
            models_manager::get_model_storage_usage,
            backend_runtime::get_backend_status,
            backend_runtime::ensure_backend_running,
            backend_runtime::check_backend_health,
            backend_runtime::restart_backend,
            backend_runtime::stop_backend,
            backend_runtime::get_backend_logs,
            backend_runtime::open_backend_logs,
            backend_runtime::open_backend_settings,
            backend_runtime::save_backend_config_cmd,
            backend_runtime::reset_backend_runtime_state,
            backend_runtime::reveal_backend_binary,
            backend_runtime::get_backend_config,
            backend_runtime::verify_packaged_runtime,
            board_services::get_backlog_snapshot,
            board_services::create_backlog_item,
            board_services::update_backlog_item,
            board_services::convert_backlog_item_to_card,
            board_services::get_board_snapshot,
            board_services::create_card,
            board_services::assign_card,
            board_services::move_card,
            board_services::get_agent_work_queue,
            org_services::create_project,
            org_services::create_team,
            org_services::get_agent_org_tree,
            org_services::move_agent_to_team,
            org_services::get_org_node_metrics,
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

            if let Some(manager) = app_handle.try_state::<backend_runtime::BackendRuntimeManager>()
            {
                let stop_on_exit = {
                    let guard = manager.config.lock().unwrap();
                    guard.stop_on_app_exit
                };
                if stop_on_exit {
                    println!(
                        "[SUPERVISOR] Cleaning up supervised local inference daemon on exit..."
                    );
                    let mut child_guard = manager.child.lock().unwrap();
                    if let Some(mut child) = child_guard.take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        }
    });
}
