use std::process::Command;
use crate::config::Config;
use crate::storage::Storage;
use std::io::{self, Write};

pub enum ExecutionResult {
    Success(String),
    Failed(String),
    Denied,
    Blocked(String),
}

pub struct Sandbox {
    config: Config,
    storage: Storage,
}

impl Sandbox {
    pub fn new(config: Config, storage: Storage) -> Self {
        Self { config, storage }
    }

    /// Verifies if a command is allowed and safe, then executes it or asks for approval.
    pub async fn execute(&self, raw_cmd: &str, session_type: &str) -> ExecutionResult {
        // Parse the executable name
        let parts: Vec<&str> = raw_cmd.split_whitespace().collect();
        if parts.is_empty() {
            return ExecutionResult::Blocked("Empty command".to_string());
        }
        
        let exe = parts[0];
        
        // Remove trailing or leading characters (like quotes)
        let clean_exe = exe.trim_matches(|c| c == '\'' || c == '"' || c == '`');
        
        // 1. Whitelist Check
        let allowed = self.config.security.allowed_commands.iter().any(|allowed| {
            // Match exactly or verify suffix (e.g. /usr/bin/curl matches curl)
            allowed == clean_exe || clean_exe.ends_with(&format!("/{}", allowed))
        });

        if !allowed {
            let err_msg = format!("Blocked: Binary '{}' is not in the whitelist.", clean_exe);
            let _ = self.storage.log_command(raw_cmd, "blocked", Some(&err_msg));
            return ExecutionResult::Blocked(err_msg);
        }

        // Detect obvious harmful flags
        if raw_cmd.contains("rm ") && (raw_cmd.contains("-rf") || raw_cmd.contains("-r")) {
            let err_msg = "Blocked: Recursive delete flags detected.".to_string();
            let _ = self.storage.log_command(raw_cmd, "blocked", Some(&err_msg));
            return ExecutionResult::Blocked(err_msg);
        }

        // 2. Interactive Approval Check
        if self.config.security.require_approval {
            let audit_id = match self.storage.log_command(raw_cmd, "pending", None) {
                Ok(id) => id,
                Err(e) => {
                    eprintln!("Failed to write to audit log: {}", e);
                    0
                }
            };

            let approved = if session_type == "console" {
                // Interactive CLI approval prompt
                println!("\n\x1b[1;33m┌────────────────────────────────────────────────────────┐\x1b[0m");
                println!("\x1b[1;33m│             ⚠️  SECURITY SANDBOX INTERCEPT              │\x1b[0m");
                println!("\x1b[1;33m├────────────────────────────────────────────────────────┤\x1b[0m");
                println!("\x1b[1;37m│ The agent requested to execute:                        │\x1b[0m");
                println!("\x1b[1;36m│   $ {} \x1b[0m", raw_cmd);
                println!("\x1b[1;33m├────────────────────────────────────────────────────────┤\x1b[0m");
                print!("\x1b[1;37m│ 👉 Approve execution? (y/N): \x1b[0m");
                io::stdout().flush().unwrap();

                let mut answer = String::new();
                io::stdin().read_line(&mut answer).unwrap();
                println!("\x1b[1;33m└────────────────────────────────────────────────────────┘\x1b[0m\n");
                let answer = answer.trim().to_lowercase();
                answer == "y" || answer == "yes"
            } else {
                // Background/Web/Remote gateway approval loop!
                // We wait up to 120 seconds for the user to approve via Web Panel (http://localhost:8080)
                println!("\n🛡️  [Cameleer Sandbox] Command pending remote approval: {}", raw_cmd);
                println!("    Awaiting approval from Web Panel or Messaging channels...");
                
                let mut is_approved = false;
                let mut elapsed = 0;
                let timeout_secs = 120;
                
                while elapsed < timeout_secs * 2 {
                    tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    elapsed += 1;
                    
                    // Query DB status
                    if let Ok(conn) = rusqlite::Connection::open(crate::config::get_config_dir().join("cameleer.db")) {
                        let status_res: Result<String, _> = conn.query_row(
                            "SELECT status FROM audit_log WHERE id = ?1",
                            [audit_id],
                            |row| row.get(0)
                        );
                        
                        if let Ok(status) = status_res {
                            if status == "approved" {
                                is_approved = true;
                                break;
                            } else if status == "denied" {
                                is_approved = false;
                                break;
                            }
                        }
                    }
                }
                is_approved
            };

            if !approved {
                if audit_id > 0 {
                    let _ = self.storage.update_command_log(audit_id, "denied", Some("User denied execution"));
                }
                println!("🚫 Command denied by user.");
                return ExecutionResult::Denied;
            }

            if audit_id > 0 {
                let _ = self.storage.update_command_log(audit_id, "approved", None);
            }
        }

        // 3. Execution
        println!("🚀 Executing: {}", raw_cmd);
        let audit_id = self.storage.log_command(raw_cmd, "executing", None).unwrap_or(0);

        let output_res = if cfg!(target_os = "windows") {
            Command::new("cmd")
                .args(["/C", raw_cmd])
                .output()
        } else {
            Command::new("sh")
                .args(["-c", raw_cmd])
                .output()
        };

        match output_res {
            Ok(output) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                
                if output.status.success() {
                    let res = if stdout.trim().is_empty() {
                        "Command executed successfully (no stdout output).".to_string()
                    } else {
                        stdout
                    };
                    if audit_id > 0 {
                        let _ = self.storage.update_command_log(audit_id, "success", Some(&res));
                    }
                    ExecutionResult::Success(res)
                } else {
                    let res = format!("Error Code {}:\n{}", output.status.code().unwrap_or(-1), stderr);
                    if audit_id > 0 {
                        let _ = self.storage.update_command_log(audit_id, "failed", Some(&res));
                    }
                    ExecutionResult::Failed(res)
                }
            }
            Err(e) => {
                let err_msg = format!("Failed to spawn process: {}", e);
                if audit_id > 0 {
                    let _ = self.storage.update_command_log(audit_id, "failed", Some(&err_msg));
                }
                ExecutionResult::Failed(err_msg)
            }
        }
    }
}
