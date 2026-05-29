use std::sync::Arc;
use tokio::sync::Mutex;
use tokio::process::Child;
use std::path::PathBuf;

pub struct DaemonManager {
    child: Arc<Mutex<Option<Child>>>,
}

impl DaemonManager {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }

    pub async fn start(&self, model_name: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut child_guard = self.child.lock().await;
        
        // 1. If there's an existing daemon running, kill it first
        if let Some(mut old_child) = child_guard.take() {
            let _ = old_child.kill().await;
        }

        // 2. Resolve executable path
        // In the native app, camelid is placed in the same directory as cameleer
        let exec_dir = std::env::current_exe()?
            .parent()
            .ok_or("Cannot resolve executable directory")?
            .to_path_buf();
            
        let mut exec_path = exec_dir.join("camelid");
        
        // Fallbacks for local cargo/development testing
        if !exec_path.exists() {
            exec_path = PathBuf::from("./target/release/camelid");
        }
        if !exec_path.exists() {
            exec_path = PathBuf::from("./camelid/target/release/camelid");
        }
        if !exec_path.exists() {
            exec_path = PathBuf::from("camelid"); // Fallback to PATH lookup
        }

        println!("🚀 Supervisor: Starting Camelid inference daemon at {:?}", exec_path);

        // 3. Resolve GGUF model path
        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
        let models_dir = std::path::Path::new(&home).join(".cameleer").join("models");
        
        if !models_dir.exists() {
            let _ = std::fs::create_dir_all(&models_dir);
        }

        let mut cmd = tokio::process::Command::new(exec_path);
        cmd.arg("serve")
           .arg("--addr")
           .arg("127.0.0.1:8181")
           .arg("--metal-linear")
           .arg("--metal-q8");

        // Set environment variables to enable advanced Metal Q8 retained acceleration pathways
        cmd.env("CAMELID_METAL_LINEAR", "1");
        cmd.env("CAMELID_METAL_Q8", "1");
        cmd.env("CAMELID_METAL_Q8_RETAINED", "1");
        cmd.env("CAMELID_HYBRID_Q8_RETAINED", "1");
        cmd.env("CAMELID_HYBRID_Q8_GPU_PERCENT", "90");
        cmd.env("CAMELID_MAC_Q8_FFN_GATE_UP_DECODE_CONSUMER", "1");
        cmd.env("CAMELID_MAC_Q8_FFN_DOWN_DECODE_CONSUMER", "1");
        cmd.env("CAMELID_MAC_Q8_FFN_DOWN_DECODE_GROUP_CHUNKING", "1");
        cmd.env("CAMELID_APPLE_ACCELERATE_MIN_ELEMENTS", "1024");
        cmd.env("CAMELID_PARALLEL_LINEAR_MIN_OUTPUTS", "1");

        // If the model name is specified and exists, load it
        let model_path = models_dir.join(model_name);
        if model_path.exists() && model_path.is_file() {
            println!("📦 Supervisor: Loading model GGUF: {:?}", model_path);
            cmd.arg("--model").arg(model_path);
        } else {
            println!("⚠️  Supervisor: GGUF model not found locally at {:?}. Starting Camelid in headless API-only mode.", model_path);
        }

        // Redirect stdout/stderr to dedicated log file under ~/.cameleer/camelid.log
        let log_file_path = std::path::Path::new(&home).join(".cameleer").join("camelid.log");
        let log_file = std::fs::OpenOptions::new()
            .create(true)
            .write(true)
            .truncate(true)
            .open(&log_file_path);

        if let Ok(file) = log_file {
            cmd.stdout(std::process::Stdio::from(file.try_clone().unwrap()));
            cmd.stderr(std::process::Stdio::from(file));
        } else {
            cmd.stdout(std::process::Stdio::null());
            cmd.stderr(std::process::Stdio::null());
        }

        match cmd.spawn() {
            Ok(new_child) => {
                *child_guard = Some(new_child);
                println!("✅ Supervisor: Camelid daemon successfully spawned on port 8181 with Apple Silicon Metal acceleration enabled.");
            }
            Err(e) => {
                eprintln!("❌ Supervisor: Failed to spawn Camelid daemon: {}", e);
                return Err(e.into());
            }
        }

        Ok(())
    }

    pub async fn stop(&self) {
        let mut child_guard = self.child.lock().await;
        if let Some(mut active_child) = child_guard.take() {
            println!("🛑 Supervisor: Stopping Camelid inference daemon child process.");
            let _ = active_child.kill().await;
        }
    }
}
