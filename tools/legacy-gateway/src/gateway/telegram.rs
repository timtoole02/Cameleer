use std::sync::Arc;
use std::time::Duration;
use crate::agent::Agent;
use crate::config::Config;
use serde::{Deserialize, Serialize};

pub async fn run(agent: Arc<Agent>, config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let token = match config.gateways.telegram.bot_token.as_ref() {
        Some(t) => t,
        None => {
            println!("⚠️  Telegram bot token is not configured. Telegram gateway will be idle.");
            return Ok(());
        }
    };

    let authorized_user = config.gateways.telegram.authorized_user_id;

    println!("📡 Starting Telegram Bot Gateway...");
    let client = reqwest::Client::new();
    let base_url = format!("https://api.telegram.org/bot{}", token);
    
    let mut offset: i64 = 0;

    loop {
        let url = format!("{}/getUpdates?offset={}&timeout=10", base_url, offset);
        
        #[derive(Deserialize)]
        struct TgUser {
            id: i64,
            first_name: String,
        }

        #[derive(Deserialize)]
        struct TgMessage {
            #[allow(dead_code)]
            message_id: i64,
            chat: TgChat,
            from: Option<TgUser>,
            text: Option<String>,
        }

        #[derive(Deserialize)]
        struct TgChat {
            id: i64,
        }

        #[derive(Deserialize)]
        struct TgUpdate {
            update_id: i64,
            message: Option<TgMessage>,
        }

        #[derive(Deserialize)]
        struct TgResponse {
            #[allow(dead_code)]
            ok: bool,
            result: Vec<TgUpdate>,
        }

        match client.get(&url).send().await {
            Ok(resp) => {
                if resp.status().is_success() {
                    if let Ok(res_body) = resp.json::<TgResponse>().await {
                        for update in res_body.result {
                            offset = update.update_id + 1;

                            if let Some(msg) = update.message {
                                if let Some(text) = msg.text {
                                    let chat_id = msg.chat.id;
                                    let sender_id = msg.from.as_ref().map(|f| f.id).unwrap_or(0);
                                    let sender_name = msg.from.as_ref().map(|f| f.first_name.clone()).unwrap_or("User".to_string());

                                    // Security check: Only allow authorized user
                                    if let Some(auth_id) = authorized_user {
                                        if sender_id != auth_id {
                                            println!("🚫 Unauthorized message from sender ID {}: {}", sender_id, text);
                                            send_text_message(&client, &base_url, chat_id, "❌ Access Denied: You are not authorized to interact with this Cameleer instance.").await;
                                            continue;
                                        }
                                    }

                                    println!("✉️  Telegram message from {}: {}", sender_name, text);
                                    
                                    if text == "/start" {
                                        let welcome = format!(
                                            "👋 Hello {}! I am Cameleer, your secure Rust-based AI agent assistant.\n\n\
                                             Authorized User ID: `{}`\n\
                                             Send me a message to start execution!",
                                            sender_name, sender_id
                                        );
                                        send_text_message(&client, &base_url, chat_id, &welcome).await;
                                        continue;
                                    }

                                    // Let the user know the agent is processing
                                    send_text_message(&client, &base_url, chat_id, "🤖 Thinking...").await;

                                    // Run through Agent
                                    let session_id = format!("telegram_{}", chat_id);
                                    
                                    // Send typing status
                                    send_chat_action(&client, &base_url, chat_id, "typing").await;

                                    let process_result = agent.process_message(&session_id, &text, "telegram")
                                        .await
                                        .map_err(|e| e.to_string());

                                    match process_result {
                                        Ok(res) => {
                                            send_text_message(&client, &base_url, chat_id, &res).await;
                                        }
                                        Err(err_msg) => {
                                            send_text_message(&client, &base_url, chat_id, &format!("❌ Agent error: {}", err_msg)).await;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Telegram long poll error: {}. Retrying in 5 seconds...", e);
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }

        tokio::time::sleep(Duration::from_millis(100)).await;
    }
}

async fn send_text_message(client: &reqwest::Client, base_url: &str, chat_id: i64, text: &str) {
    #[derive(Serialize)]
    struct SendMsg {
        chat_id: i64,
        text: String,
        parse_mode: String,
    }

    let payload = SendMsg {
        chat_id,
        text: text.to_string(),
        parse_mode: "Markdown".to_string(),
    };

    let _ = client.post(format!("{}/sendMessage", base_url))
        .json(&payload)
        .send()
        .await;
}

async fn send_chat_action(client: &reqwest::Client, base_url: &str, chat_id: i64, action: &str) {
    #[derive(Serialize)]
    struct SendAction {
        chat_id: i64,
        action: String,
    }

    let payload = SendAction {
        chat_id,
        action: action.to_string(),
    };

    let _ = client.post(format!("{}/sendChatAction", base_url))
        .json(&payload)
        .send()
        .await;
}
