use std::sync::Arc;
use std::time::Duration;
use futures_util::{SinkExt, StreamExt};
use serde::Serialize;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::protocol::Message;
use crate::agent::Agent;
use crate::config::Config;

pub async fn run(agent: Arc<Agent>, config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let token = match config.gateways.discord.bot_token.as_ref() {
        Some(t) => t,
        None => {
            println!("⚠️  Discord bot token is not configured. Discord gateway will be idle.");
            return Ok(());
        }
    };

    let authorized_channel = config.gateways.discord.authorized_channel_id;
    let authorized_user = config.gateways.discord.authorized_user_id;

    println!("📡 Starting Discord Bot Gateway (WebSockets)...");
    
    let gateway_url = "wss://gateway.discord.gg/?v=10&encoding=json";
    
    // Connect to WebSocket
    let (ws_stream, _) = match connect_async(gateway_url).await {
        Ok(connection) => connection,
        Err(e) => {
            eprintln!("❌ Failed to connect to Discord Gateway WebSocket: {}", e);
            return Err(e.into());
        }
    };

    println!("✅ Connected to Discord Gateway. Initializing handshake...");
    let (mut write, mut read) = ws_stream.split();

    // Spawn a message channel to coordinate sending heartbeats and payloads
    let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(100);

    // Task that pulls payloads from the channel and pushes them to the WebSocket
    let tx_clone = tx.clone();
    tokio::spawn(async move {
        while let Some(payload) = rx.recv().await {
            if let Err(e) = write.send(Message::Text(payload)).await {
                eprintln!("❌ Error sending payload to Discord WS: {}", e);
                break;
            }
        }
    });

    // 1. Identify Payload (Opcode 2)
    // Intents: Guilds (1 << 0) + Guild Messages (1 << 9) + Message Content (1 << 15) = 32768 + 512 + 1 = 33281
    let identify_json = serde_json::json!({
        "op": 2,
        "d": {
            "token": token,
            "intents": 33281,
            "properties": {
                "os": "macos",
                "browser": "cameleer",
                "device": "cameleer"
            }
        }
    }).to_string();

    // Read initial Hello packet
    if let Some(msg) = read.next().await {
        let msg = msg?;
        if let Message::Text(text) = msg {
            let hello_payload: serde_json::Value = serde_json::from_str(&text)?;
            
            // Extract Opcode 10 (Hello) and heartbeat_interval
            if hello_payload["op"] == 10 {
                let interval_ms = hello_payload["d"]["heartbeat_interval"]
                    .as_u64()
                    .unwrap_or(45000);
                
                println!("💓 Heartbeat interval set to {}ms. Spawning pulse loop...", interval_ms);
                
                // Spawn heartbeat heartbeat loop
                let tx_heartbeat = tx_clone.clone();
                tokio::spawn(async move {
                    let mut interval = tokio::time::interval(Duration::from_millis(interval_ms));
                    // Skip the immediate tick
                    interval.tick().await;
                    
                    loop {
                        interval.tick().await;
                        let heartbeat_payload = serde_json::json!({
                            "op": 1,
                            "d": null
                        }).to_string();
                        
                        if tx_heartbeat.send(heartbeat_payload).await.is_err() {
                            break;
                        }
                    }
                });
            }
        }
    }

    // Submit Identify payload to authenticate
    tx_clone.send(identify_json).await?;
    println!("🔑 Handshake submitted. Subscribing to event streams...");

    let client = reqwest::Client::new();

    // Event listening loop
    while let Some(msg) = read.next().await {
        let msg = match msg {
            Ok(m) => m,
            Err(e) => {
                eprintln!("⚠️  Discord WebSocket read error: {}. Reconnecting...", e);
                break;
            }
        };

        if let Message::Text(text) = msg {
            let payload: serde_json::Value = match serde_json::from_str(&text) {
                Ok(v) => v,
                Err(_) => continue,
            };

            // Capture OP 0 (Dispatch events)
            if payload["op"] == 0 {
                let event_type = payload["t"].as_str().unwrap_or("");

                if event_type == "READY" {
                    let bot_username = payload["d"]["user"]["username"].as_str().unwrap_or("Cameleer Bot");
                    println!("❇️  Discord gateway ready! Authenticated as: @{}", bot_username);
                }

                if event_type == "MESSAGE_CREATE" {
                    let data = &payload["d"];
                    
                    // Filter out own bot messages
                    let is_bot = data["author"]["bot"].as_bool().unwrap_or(false);
                    if is_bot {
                        continue;
                    }

                    let content = data["content"].as_str().unwrap_or("").trim();
                    let channel_id = data["channel_id"].as_str().unwrap_or("");
                    let author_id = data["author"]["id"].as_str().unwrap_or("");
                    let author_name = data["author"]["username"].as_str().unwrap_or("User");

                    if content.is_empty() {
                        continue;
                    }

                    // Security check: Match Channel ID
                    if let Some(auth_channel) = authorized_channel {
                        if channel_id != auth_channel.to_string() {
                            continue;
                        }
                    }

                    // Security check: Match User ID
                    if let Some(auth_user) = authorized_user {
                        if author_id != auth_user.to_string() {
                            println!("🚫 Unauthorized Discord message from @{} (ID: {}): {}", author_name, author_id, content);
                            send_rest_message(&client, token, channel_id, "❌ Access Denied: You are not authorized to interact with this Cameleer instance.").await;
                            continue;
                        }
                    }

                    println!("✉️  Discord message from @{} in channel {}: {}", author_name, channel_id, content);

                    if content == "/start" {
                        let welcome = format!(
                            "👋 Hello @{}! I am **Cameleer**, your secure Rust-based AI agent assistant.\n\n\
                             Authorized Channel ID: `{}`\n\
                             Authorized User ID: `{}`\n\
                             Send me a message to start execution!",
                            author_name, channel_id, author_id
                        );
                        send_rest_message(&client, token, channel_id, &welcome).await;
                        continue;
                    }

                    // REST call to trigger typing indicator on Discord
                    send_typing_indicator(&client, token, channel_id).await;

                    // Execute Agent
                    let session_id = format!("discord_{}", channel_id);
                    
                    let agent_clone = Arc::clone(&agent);
                    let client_clone = client.clone();
                    let token_clone = token.to_string();
                    let channel_id_clone = channel_id.to_string();
                    let content_clone = content.to_string();

                    // Spawn agent processing asynchronously so it doesn't block the WebSocket reading pipeline!
                    tokio::spawn(async move {
                        let res = agent_clone.process_message(&session_id, &content_clone, "discord")
                            .await
                            .map_err(|e| e.to_string());
                        
                        match res {
                            Ok(output) => {
                                send_rest_message(&client_clone, &token_clone, &channel_id_clone, &output).await;
                            }
                            Err(e) => {
                                send_rest_message(&client_clone, &token_clone, &channel_id_clone, &format!("❌ Agent error: {}", e)).await;
                            }
                        }
                    });
                }
            }
        }
    }

    Ok(())
}

async fn send_rest_message(client: &reqwest::Client, token: &str, channel_id: &str, text: &str) {
    let url = format!("https://discord.com/api/v10/channels/{}/messages", channel_id);
    
    #[derive(Serialize)]
    struct PostMessage {
        content: String,
    }

    let payload = PostMessage {
        content: text.to_string(),
    };

    let _ = client.post(&url)
        .header("Authorization", format!("Bot {}", token))
        .json(&payload)
        .send()
        .await;
}

async fn send_typing_indicator(client: &reqwest::Client, token: &str, channel_id: &str) {
    let url = format!("https://discord.com/api/v10/channels/{}/typing", channel_id);
    let _ = client.post(&url)
        .header("Authorization", format!("Bot {}", token))
        .send()
        .await;
}
