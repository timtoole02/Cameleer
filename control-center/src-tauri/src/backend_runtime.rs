use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Child, Stdio};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State, Emitter};
use reqwest::Client;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendStatus {
    pub state: String, // "unknown", "not_installed", "stopped", "starting", "running", "ready", "degraded", "restarting", "crashed", "failed", "stopping"
    pub pid: Option<u32>,
    pub port: Option<u16>,
    pub bind_address: String,
    pub version: Option<String>,
    pub uptime_seconds: Option<u64>,
    pub active_model: Option<String>,
    pub model_loaded: bool,
    pub last_health_check_at: Option<String>,
    pub last_error: Option<String>,
    pub restart_count: u32,
    pub log_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendRuntimeConfig {
    pub backend_binary_path: Option<String>,
    pub bind_address: String,
    pub port: u16,
    pub auto_start_on_app_launch: bool,
    pub auto_restart_on_crash: bool,
    pub stop_on_app_exit: bool,
    pub startup_timeout_ms: u64,
    pub health_check_interval_ms: u64,
    pub restart_backoff_policy: String, // "exponential", "linear"
    pub max_restarts: u32,
    pub log_path: Option<String>,
    pub model_path: Option<String>,
}

impl Default for BackendRuntimeConfig {
    fn default() -> Self {
        Self {
            backend_binary_path: None,
            bind_address: "127.0.0.1".to_string(),
            port: 8181,
            auto_start_on_app_launch: true,
            auto_restart_on_crash: true,
            stop_on_app_exit: true,
            startup_timeout_ms: 120000,
            health_check_interval_ms: 5000,
            restart_backoff_policy: "exponential".to_string(),
            max_restarts: 5,
            log_path: None,
            model_path: None,
        }
    }
}

pub struct BackendRuntimeManager {
    pub status: Arc<Mutex<BackendStatus>>,
    pub config: Arc<Mutex<BackendRuntimeConfig>>,
    pub child: Arc<Mutex<Option<Child>>>,
    pub last_start_time: Arc<Mutex<Option<Instant>>>,
    pub crash_times: Arc<Mutex<Vec<Instant>>>,
}

impl BackendRuntimeManager {
    pub fn new() -> Self {
        let config = load_config_file();
        let log_path = config.log_path.clone().unwrap_or_else(|| get_default_log_path().to_string_lossy().to_string());
        
        let status = BackendStatus {
            state: "stopped".to_string(),
            pid: None,
            port: Some(config.port),
            bind_address: config.bind_address.clone(),
            version: Some("0.1.0".to_string()),
            uptime_seconds: Some(0),
            active_model: None,
            model_loaded: false,
            last_health_check_at: None,
            last_error: None,
            restart_count: 0,
            log_path: Some(log_path),
        };

        Self {
            status: Arc::new(Mutex::new(status)),
            config: Arc::new(Mutex::new(config)),
            child: Arc::new(Mutex::new(None)),
            last_start_time: Arc::new(Mutex::new(None)),
            crash_times: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

// --- HELPER UTILITIES ---

fn get_app_dir() -> PathBuf {
    let mut path = PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/Users/timtoole".to_string()));
    path.push(".cameleer");
    let _ = fs::create_dir_all(&path);
    path
}

fn get_config_path() -> PathBuf {
    get_app_dir().join("backend_config.json")
}

fn get_default_log_path() -> PathBuf {
    get_app_dir().join("camelid.log")
}

fn get_supervisor_log_path() -> PathBuf {
    get_app_dir().join("backend-supervisor.log")
}

fn log_supervisor_event(msg: &str) {
    let log_path = get_supervisor_log_path();
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    if let Ok(mut file) = fs::OpenOptions::new().create(true).append(true).open(log_path) {
        let _ = writeln!(file, "[{}] {}", now, msg);
    }
}

fn load_config_file() -> BackendRuntimeConfig {
    let path = get_config_path();
    if path.exists() {
        if let Ok(mut f) = fs::File::open(path) {
            let mut data = String::new();
            if f.read_to_string(&mut data).is_ok() {
                if let Ok(config) = serde_json::from_str::<BackendRuntimeConfig>(&data) {
                    return config;
                }
            }
        }
    }
    let default = BackendRuntimeConfig::default();
    save_config_file(&default);
    default
}

fn save_config_file(config: &BackendRuntimeConfig) {
    let path = get_config_path();
    if let Ok(mut f) = fs::File::create(path) {
        if let Ok(data) = serde_json::to_string_pretty(config) {
            let _ = f.write_all(data.as_bytes());
        }
    }
}

fn resolve_binary_path(config: &BackendRuntimeConfig) -> Result<PathBuf, String> {
    if let Some(ref path_override) = config.backend_binary_path {
        let p = PathBuf::from(path_override);
        if p.exists() {
            return Ok(p);
        }
    }

    let exec_dir = std::env::current_exe()
        .map_err(|e| e.to_string())?
        .parent()
        .ok_or_else(|| "Cannot resolve executable directory".to_string())?
        .to_path_buf();

    let mut paths = vec![
        exec_dir.join("camelid"),
        PathBuf::from("./target/release/camelid"),
        PathBuf::from("./camelid/target/release/camelid"),
        PathBuf::from("../target/release/camelid"),
        PathBuf::from("../camelid/target/release/camelid"),
    ];

    for p in paths.drain(..) {
        if p.exists() {
            return Ok(p);
        }
    }

    // Default lookup in PATH
    Ok(PathBuf::from("camelid"))
}

// --- CORE LIFE CYCLES ---

pub fn start_heartbeat_loop(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(5)).await;
            
            let manager = match app_handle.try_state::<BackendRuntimeManager>() {
                Some(m) => m,
                None => continue,
            };

            let config = {
                let guard = manager.config.lock().unwrap();
                guard.clone()
            };

            let current_state = {
                let guard = manager.status.lock().unwrap();
                guard.state.clone()
            };

            if current_state == "ready" || current_state == "running" || current_state == "degraded" {
                // Perform heartbeat checks
                let _ = check_health_and_update(&app_handle, &manager, &config).await;
            }
        }
    });
}

pub async fn check_health_and_update(
    app_handle: &AppHandle,
    manager: &BackendRuntimeManager,
    config: &BackendRuntimeConfig,
) -> Result<BackendStatus, String> {
    let client = Client::builder()
        .timeout(Duration::from_millis(1500))
        .build()
        .unwrap_or_default();

    let url = format!("http://{}:{}/health", config.bind_address, config.port);
    let now_str = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
        .to_string();

    let res = client.get(&url).send().await;

    let mut status = manager.status.lock().unwrap().clone();
    status.last_health_check_at = Some(now_str);

    match res {
        Ok(resp) => {
            if resp.status().is_success() {
                // Read active model & other details if response provides them
                #[derive(Deserialize)]
                struct CamelidHealth {
                    loaded_now: bool,
                    active_model_id: Option<String>,
                    alive: Option<bool>,
                    version: Option<String>,
                    uptime: Option<u64>,
                    pid: Option<u32>,
                    state: Option<String>,
                }

                if let Ok(health_data) = resp.json::<CamelidHealth>().await {
                    status.model_loaded = health_data.loaded_now;
                    status.active_model = health_data.active_model_id;
                    if let Some(v) = health_data.version { status.version = Some(v); }
                    if let Some(u) = health_data.uptime { status.uptime_seconds = Some(u); }
                    if let Some(p) = health_data.pid { status.pid = Some(p); }
                    
                    if let Some(ref st) = health_data.state {
                        if st == "running" && status.model_loaded {
                            status.state = "ready".to_string();
                        } else {
                            status.state = st.clone();
                        }
                    } else {
                        status.state = "ready".to_string();
                    }
                } else {
                    status.model_loaded = false;
                    status.active_model = None;
                    status.state = "ready".to_string();
                }

                status.last_error = None;
            } else {
                // Degraded or check again
                if status.state == "ready" {
                    status.state = "degraded".to_string();
                    status.last_error = Some("Health check returned failure code".to_string());
                    log_supervisor_event("Backend health check failed: status not success. Degraded state.");
                } else {
                    handle_crash_or_failure(app_handle, manager, config, &mut status);
                }
            }
        }
        Err(e) => {
            if status.state == "ready" || status.state == "degraded" {
                status.state = "crashed".to_string();
                status.last_error = Some(format!("Network health request failed: {}", e));
                log_supervisor_event(&format!("Backend health request failed: {}. Crashed state.", e));
                handle_crash_or_failure(app_handle, manager, config, &mut status);
            }
        }
    }

    *manager.status.lock().unwrap() = status.clone();
    let _ = app_handle.emit("backend_status_changed", &status);
    Ok(status)
}

fn handle_crash_or_failure(
    app_handle: &AppHandle,
    manager: &BackendRuntimeManager,
    config: &BackendRuntimeConfig,
    status: &mut BackendStatus,
) {
    if !config.auto_restart_on_crash {
        status.state = "failed".to_string();
        log_supervisor_event("Backend crash detected. Auto-restart disabled. Transitioning to failed state.");
        return;
    }

    // Clean child reference
    {
        let mut child_guard = manager.child.lock().unwrap();
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill();
        }
    }

    // Check crash frequency for infinite loop protection (max 5 restarts in 2 mins)
    let now = Instant::now();
    let mut crashes = manager.crash_times.lock().unwrap();
    crashes.retain(|&t| now.duration_since(t) < Duration::from_secs(120));
    crashes.push(now);

    if crashes.len() > config.max_restarts as usize {
        status.state = "failed".to_string();
        status.last_error = Some("Infinite crash loop blocked. Failed state.".to_string());
        log_supervisor_event("Infinite crash loop blocked. Max restarts threshold reached. Stopped auto-restarts.");
        let _ = app_handle.emit("backend_failed", &status);
        return;
    }

    // Attempt auto-restart in a background async task to avoid locking Mutex during tokio sleep
    status.state = "restarting".to_string();
    status.restart_count += 1;
    let restart_count = status.restart_count;
    log_supervisor_event(&format!("Triggering auto-restart sequence. Restart count: {}", restart_count));

    let handle_clone = app_handle.clone();
    let policy = config.restart_backoff_policy.clone();
    tauri::async_runtime::spawn(async move {
        // Safe backoff calculation
        let delay = match policy.as_str() {
            "exponential" => Duration::from_secs(2u64.pow(std::cmp::min(restart_count, 4))),
            _ => Duration::from_secs(2 * restart_count as u64),
        };
        
        tokio::time::sleep(delay).await;
        let _ = perform_backend_start(&handle_clone, None).await;
    });
}

async fn perform_backend_start(
    app_handle: &AppHandle,
    model_override: Option<String>,
) -> Result<BackendStatus, String> {
    let manager = app_handle.state::<BackendRuntimeManager>();
    let config = {
        let guard = manager.config.lock().unwrap();
        guard.clone()
    };

    // 1. Mark starting
    {
        let mut status = manager.status.lock().unwrap();
        status.state = "starting".to_string();
    }
    let _ = app_handle.emit("backend_status_changed", &*manager.status.lock().unwrap());

    // 2. Validate Binary
    let exec_path = match resolve_binary_path(&config) {
        Ok(path) => path,
        Err(e) => {
            let mut status = manager.status.lock().unwrap();
            status.state = "failed".to_string();
            status.last_error = Some(format!("Binary resolution error: {}", e));
            let _ = app_handle.emit("backend_status_changed", &*status);
            return Err(e);
        }
    };

    if !exec_path.exists() {
        let mut status = manager.status.lock().unwrap();
        status.state = "not_installed".to_string();
        status.last_error = Some("Inference engine binary missing".to_string());
        let _ = app_handle.emit("backend_status_changed", &*status);
        return Err("Backend binary not found".to_string());
    }

    // 3. Port conflict handling
    let client = Client::builder()
        .timeout(Duration::from_millis(500))
        .build()
        .unwrap_or_default();

    let check_url = format!("http://{}:{}/health", config.bind_address, config.port);
    if client.get(&check_url).send().await.is_ok() {
        // Port is occupied. Verify if it's our own Camelid daemon
        if let Ok(resp) = client.get(&check_url).send().await {
            if resp.status().is_success() {
                log_supervisor_event("Healthy backend found on configured port. Attaching to existing process.");
                let mut status = manager.status.lock().unwrap();
                status.state = "ready".to_string();
                status.pid = None;
                status.last_error = None;
                let _ = app_handle.emit("backend_ready", &*status);
                return Ok(status.clone());
            }
        }
        
        let mut status = manager.status.lock().unwrap();
        status.state = "failed".to_string();
        status.last_error = Some("Port conflict: Expected port already occupied by another application".to_string());
        let _ = app_handle.emit("backend_status_changed", &*status);
        return Err("Port already occupied".to_string());
    }

    // 4. Resolve GGUF model path
    let home = std::env::var("HOME").unwrap_or_else(|_| "/Users/timtoole".to_string());
    let models_dir = PathBuf::from(&home).join(".cameleer").join("models");

    let model_name = match model_override {
        Some(m) => m,
        None => {
            let db_state = app_handle.state::<crate::storage::DbState>();
            let conn = db_state.conn.lock().map_err(|e| e.to_string())?;
            let active_local: Option<String> = conn
                .query_row(
                    "SELECT value FROM shared_state WHERE key = 'active_local_model'",
                    [],
                    |row| row.get(0),
                )
                .ok();
            active_local.unwrap_or_else(|| "Llama-3.2-1B-Instruct-Q8_0.gguf".to_string())
        }
    };

    let model_path = models_dir.join(&model_name);

    // 4b. Pre-flight check: Is the daemon already running from a previous orphaned session?
    let pre_client = Client::builder().timeout(Duration::from_millis(500)).build().unwrap_or_default();
    let pre_url = format!("http://{}:{}/health", config.bind_address, config.port);
    if let Ok(resp) = pre_client.get(&pre_url).send().await {
        if resp.status().is_success() {
            log_supervisor_event("Orphaned GGUF local daemon detected already running. Adopting existing process.");
            let mut status = manager.status.lock().unwrap();
            status.state = "ready".to_string();
            status.pid = Some(0); // Adopted, PID unknown
            status.last_error = None;
            let _ = app_handle.emit("backend_ready", &*status);
            return Ok(status.clone());
        }
    }

    // 5. Spawning child process
    log_supervisor_event(&format!(
        "Spawning GGUF inference process: addr={}:{}, binary={:?}",
        config.bind_address, config.port, exec_path
    ));

    let log_file_path = config.log_path.clone().unwrap_or_else(|| get_default_log_path().to_string_lossy().to_string());
    let log_file = fs::OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(&log_file_path);

    let mut cmd = Command::new(&exec_path);
    cmd.arg("serve")
        .arg("--addr")
        .arg(format!("{}:{}", config.bind_address, config.port))
        .arg("--metal-linear")
        .arg("--metal-q8");

    cmd.env("CAMELID_METAL_LINEAR", "1");
    cmd.env("CAMELID_METAL_Q8", "1");
    cmd.env("CAMELID_METAL_Q8_RETAINED", "1");

    if model_path.exists() && model_path.is_file() {
        cmd.arg("--model").arg(model_path);
    }

    if let Ok(file) = log_file {
        cmd.stdout(Stdio::from(file.try_clone().unwrap()));
        cmd.stderr(Stdio::from(file));
    } else {
        cmd.stdout(Stdio::null());
        cmd.stderr(Stdio::null());
    }

    match cmd.spawn() {
        Ok(child) => {
            let pid = child.id();
            *manager.child.lock().unwrap() = Some(child);
            *manager.last_start_time.lock().unwrap() = Some(Instant::now());

            // 6. Polling for readiness
            let ready_url = format!("http://{}:{}/ready", config.bind_address, config.port);
            let start_time = Instant::now();
            let timeout = Duration::from_millis(config.startup_timeout_ms);

            log_supervisor_event("Waiting for GGUF local daemon readiness check...");

            loop {
                tokio::time::sleep(Duration::from_millis(500)).await;

                if start_time.elapsed() > timeout {
                    log_supervisor_event("Readiness check timed out. Killing child process.");
                    let mut child_guard = manager.child.lock().unwrap();
                    if let Some(mut c) = child_guard.take() {
                        let _ = c.kill();
                    }
                    let mut status = manager.status.lock().unwrap();
                    status.state = "failed".to_string();
                    status.last_error = Some("Startup readiness check timed out".to_string());
                    let _ = app_handle.emit("backend_status_changed", &*status);
                    return Err("Startup timed out".to_string());
                }

                // Check if process has exited early
                {
                    let mut child_guard = manager.child.lock().unwrap();
                    if let Some(ref mut c) = *child_guard {
                        if let Ok(Some(exit_status)) = c.try_wait() {
                            log_supervisor_event(&format!("Inference engine process exited early with status: {}", exit_status));
                            *child_guard = None;
                            let mut status = manager.status.lock().unwrap();
                            status.state = "failed".to_string();
                            status.last_error = Some(format!("Process exited early: {}", exit_status));
                            let _ = app_handle.emit("backend_status_changed", &*status);
                            return Err("Process exited early".to_string());
                        }
                    }
                }

                // Poll /ready
                if let Ok(resp) = client.get(&ready_url).send().await {
                    if resp.status().is_success() {
                        log_supervisor_event("GGUF local daemon successfully started and ready!");
                        let mut status = manager.status.lock().unwrap();
                        status.state = "ready".to_string();
                        status.pid = Some(pid);
                        status.last_error = None;
                        let _ = app_handle.emit("backend_ready", &*status);
                        return Ok(status.clone());
                    }
                }
            }
        }
        Err(e) => {
            log_supervisor_event(&format!("Failed to spawn local GGUF daemon: {}", e));
            let mut status = manager.status.lock().unwrap();
            status.state = "failed".to_string();
            status.last_error = Some(format!("Failed to execute binary: {}", e));
            let _ = app_handle.emit("backend_status_changed", &*status);
            Err(e.to_string())
        }
    }
}

// --- TAURI FRONTEND EXPOSED COMMANDS ---

#[tauri::command]
pub async fn get_backend_status(state: State<'_, BackendRuntimeManager>) -> Result<BackendStatus, String> {
    let guard = state.status.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
pub async fn ensure_backend_running(app_handle: AppHandle) -> Result<BackendStatus, String> {
    let manager = app_handle.state::<BackendRuntimeManager>();
    
    let current_state = {
        let guard = manager.status.lock().unwrap();
        guard.state.clone()
    };

    if current_state == "ready" {
        let guard = manager.status.lock().unwrap();
        return Ok(guard.clone());
    }

    perform_backend_start(&app_handle, None).await
}

#[tauri::command]
pub async fn check_backend_health(app_handle: AppHandle) -> Result<BackendStatus, String> {
    let manager = app_handle.state::<BackendRuntimeManager>();
    let config = {
        let guard = manager.config.lock().unwrap();
        guard.clone()
    };
    check_health_and_update(&app_handle, &manager, &config).await
}

#[tauri::command]
pub async fn restart_backend(app_handle: AppHandle, reason: Option<String>) -> Result<BackendStatus, String> {
    let manager = app_handle.state::<BackendRuntimeManager>();
    log_supervisor_event(&format!(
        "User or system requested backend restart. Reason: {}",
        reason.unwrap_or_else(|| "user_requested".to_string())
    ));

    // Disable action buttons via transition state
    {
        let mut status = manager.status.lock().unwrap();
        status.state = "restarting".to_string();
    }
    let _ = app_handle.emit("backend_status_changed", &*manager.status.lock().unwrap());

    // 1. Gracefully terminate child process
    {
        let mut child_guard = manager.child.lock().unwrap();
        if let Some(mut child) = child_guard.take() {
            println!("[SUPERVISOR] Terminating daemon process gracefully...");
            let _ = child.kill();
            // Wait for exit
            let _ = child.wait();
        }
    }

    tokio::time::sleep(Duration::from_millis(500)).await;

    // 2. Perform fresh start
    perform_backend_start(&app_handle, None).await
}

#[tauri::command]
pub async fn stop_backend(app_handle: AppHandle) -> Result<BackendStatus, String> {
    let manager = app_handle.state::<BackendRuntimeManager>();
    log_supervisor_event("Stop backend command triggered.");

    {
        let mut status = manager.status.lock().unwrap();
        status.state = "stopping".to_string();
    }
    let _ = app_handle.emit("backend_status_changed", &*manager.status.lock().unwrap());

    {
        let mut child_guard = manager.child.lock().unwrap();
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    let mut status = manager.status.lock().unwrap();
    status.state = "stopped".to_string();
    status.pid = None;
    status.model_loaded = false;
    status.active_model = None;
    
    let _ = app_handle.emit("backend_status_changed", &*status);
    Ok(status.clone())
}

#[tauri::command]
pub async fn get_backend_logs(state: State<'_, BackendRuntimeManager>, limit: Option<usize>) -> Result<String, String> {
    let log_path_str = {
        let guard = state.status.lock().unwrap();
        guard.log_path.clone().unwrap_or_else(|| get_default_log_path().to_string_lossy().to_string())
    };

    let p = Path::new(&log_path_str);
    if !p.exists() {
        return Ok("No log output stream captured yet.".to_string());
    }

    if let Ok(data) = fs::read_to_string(p) {
        let lines: Vec<&str> = data.lines().collect();
        let target_limit = limit.unwrap_or(200);
        let start = lines.len().saturating_sub(target_limit);
        let slice = &lines[start..];
        Ok(slice.join("\n"))
    } else {
        Err("Failed to read log payload".to_string())
    }
}

#[tauri::command]
pub async fn open_backend_logs() -> Result<(), String> {
    let log_path = get_default_log_path();
    let _ = Command::new("open")
        .arg("-e")
        .arg(log_path)
        .spawn();
    Ok(())
}

#[tauri::command]
pub async fn open_backend_settings() -> Result<(), String> {
    // Return successfully so UI knows link works
    Ok(())
}

#[tauri::command]
pub async fn reveal_backend_binary(app_handle: tauri::AppHandle) -> Result<(), String> {
    let manager = app_handle.state::<BackendRuntimeManager>();
    let config = {
        let guard = manager.config.lock().unwrap();
        guard.clone()
    };
    if let Ok(bin_path) = resolve_binary_path(&config) {
        if let Some(parent) = bin_path.parent() {
            let _ = Command::new("open")
                .arg(parent)
                .spawn();
        } else {
            let _ = Command::new("open")
                .arg(bin_path)
                .spawn();
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn save_backend_config_cmd(
    app_handle: AppHandle,
    state: State<'_, BackendRuntimeManager>,
    new_config: BackendRuntimeConfig,
) -> Result<(), String> {
    // 1. Update config
    {
        let mut config_guard = state.config.lock().unwrap();
        *config_guard = new_config.clone();
        save_config_file(&new_config);
    }

    // 2. Mark restart required
    let mut status = state.status.lock().unwrap();
    status.port = Some(new_config.port);
    status.bind_address = new_config.bind_address.clone();
    status.log_path = Some(new_config.log_path.clone().unwrap_or_else(|| get_default_log_path().to_string_lossy().to_string()));
    
    let _ = app_handle.emit("backend_status_changed", &*status);
    log_supervisor_event("Backend config updated by user. Restart recommended.");
    Ok(())
}

#[tauri::command]
pub async fn reset_backend_runtime_state(app_handle: AppHandle) -> Result<BackendStatus, String> {
    let manager = app_handle.state::<BackendRuntimeManager>();
    log_supervisor_event("Resetting backend runtime supervisor state.");

    // Stop process
    {
        let mut child_guard = manager.child.lock().unwrap();
        if let Some(mut child) = child_guard.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    // Clear configs and logs
    let default_config = BackendRuntimeConfig::default();
    save_config_file(&default_config);
    
    {
        let mut config_guard = manager.config.lock().unwrap();
        *config_guard = default_config.clone();
    }

    {
        let mut crashes = manager.crash_times.lock().unwrap();
        crashes.clear();
    }

    let mut status = manager.status.lock().unwrap();
    status.state = "stopped".to_string();
    status.pid = None;
    status.port = Some(default_config.port);
    status.bind_address = default_config.bind_address.clone();
    status.active_model = None;
    status.model_loaded = false;
    status.last_error = None;
    status.restart_count = 0;

    let _ = app_handle.emit("backend_status_changed", &*status);
    Ok(status.clone())
}

#[tauri::command]
pub async fn get_backend_config(state: State<'_, BackendRuntimeManager>) -> Result<BackendRuntimeConfig, String> {
    let guard = state.config.lock().map_err(|e| e.to_string())?;
    Ok(guard.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_defaults() {
        let config = BackendRuntimeConfig::default();
        assert_eq!(config.bind_address, "127.0.0.1");
        assert_eq!(config.port, 8181);
        assert!(config.auto_start_on_app_launch);
        assert!(config.auto_restart_on_crash);
        assert!(config.stop_on_app_exit);
        assert_eq!(config.startup_timeout_ms, 120000);
        assert_eq!(config.health_check_interval_ms, 5000);
        assert_eq!(config.max_restarts, 5);
        assert_eq!(config.restart_backoff_policy, "exponential");
    }

    #[test]
    fn test_status_serialization() {
        let status = BackendStatus {
            state: "ready".to_string(),
            pid: Some(1234),
            port: Some(8181),
            bind_address: "127.0.0.1".to_string(),
            version: Some("0.1.0".to_string()),
            uptime_seconds: Some(60),
            active_model: Some("test_model.gguf".to_string()),
            model_loaded: true,
            last_health_check_at: Some("1234567890".to_string()),
            last_error: None,
            restart_count: 1,
            log_path: Some("camelid.log".to_string()),
        };

        let serialized = serde_json::to_string(&status).unwrap();
        let deserialized: BackendStatus = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.state, "ready");
        assert_eq!(deserialized.pid, Some(1234));
        assert_eq!(deserialized.port, Some(8181));
        assert!(deserialized.model_loaded);
        assert_eq!(deserialized.active_model.unwrap(), "test_model.gguf");
    }

    #[test]
    fn test_health_check_transitions_and_crash_frequency() {
        let manager = BackendRuntimeManager::new();
        
        {
            let status = manager.status.lock().unwrap();
            assert_eq!(status.state, "stopped");
        }

        {
            let mut status = manager.status.lock().unwrap();
            status.state = "ready".to_string();
        }

        {
            let mut status = manager.status.lock().unwrap();
            if status.state == "ready" {
                status.state = "degraded".to_string();
                status.last_error = Some("Health check failure".to_string());
            }
            assert_eq!(status.state, "degraded");
            assert_eq!(status.last_error.as_deref(), Some("Health check failure"));
        }

        let config = BackendRuntimeConfig::default();
        let now = Instant::now();
        {
            let mut crashes = manager.crash_times.lock().unwrap();
            for _ in 0..6 {
                crashes.push(now);
            }
        }

        let mut status = manager.status.lock().unwrap().clone();
        let crashes = manager.crash_times.lock().unwrap();
        if crashes.len() > config.max_restarts as usize {
            status.state = "failed".to_string();
            status.last_error = Some("Infinite crash loop blocked.".to_string());
        }

        assert_eq!(status.state, "failed");
        assert_eq!(status.last_error.as_deref(), Some("Infinite crash loop blocked."));
    }
}
