use std::io;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use crossterm::{
    event::{self, Event, KeyCode, KeyModifiers},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{
    prelude::*,
    widgets::*,
};
use crate::agent::Agent;
use crate::skills::load_skills;

struct TuiState {
    input: String,
    messages: Vec<(String, String)>,        // (Role, Content)
    status: String,                         // "IDLE" or "THINKING"
    whitelisted_count: usize,
    skills_count: usize,
    audits_count: usize,
    pending_command: Option<(i64, String)>, // (id, command)

}

pub async fn run(agent: Arc<Agent>) -> Result<(), Box<dyn std::error::Error>> {
    // 1. Terminal Setup
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    // 2. Initialize Shared State
    let state = Arc::new(Mutex::new(TuiState {
        input: String::new(),
        messages: Vec::new(),
        status: "IDLE".to_string(),
        whitelisted_count: agent.config().security.allowed_commands.len(),
        skills_count: 0,
        audits_count: 0,
        pending_command: None,

    }));

    // Setup Panic hook to restore terminal raw state on panic
    let original_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |panic_info| {
        let _ = disable_raw_mode();
        let mut stdout = io::stdout();
        let _ = execute!(stdout, LeaveAlternateScreen);
        original_hook(panic_info);
    }));

    // 3. Spawn background sync worker (polls SQLite every 200ms to update TuiState)
    let sync_agent = Arc::clone(&agent);
    let sync_state = Arc::clone(&state);
    let _sync_worker = tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_millis(200)).await;

            let messages_res = sync_agent.storage().get_messages("console_default", 30);
            let skills_res = load_skills();

            let pending_res: Result<Option<(i64, String)>, String> = match rusqlite::Connection::open(crate::config::get_config_dir().join("cameleer.db")) {
                Ok(conn) => {
                    let mut stmt = match conn.prepare("SELECT id, command FROM audit_log WHERE status = 'pending' ORDER BY id DESC LIMIT 1") {
                        Ok(s) => s,
                        Err(e) => {
                            eprintln!("Failed to prepare select: {}", e);
                            continue;
                        }
                    };
                    let mut rows = match stmt.query([]) {
                        Ok(r) => r,
                        Err(e) => {
                            eprintln!("Query failure: {}", e);
                            continue;
                        }
                    };

                    match rows.next() {
                        Ok(Some(row)) => {
                            let id: i64 = row.get(0).unwrap_or(0);
                            let cmd: String = row.get(1).unwrap_or_default();
                            Ok(Some((id, cmd)))
                        }
                        _ => Ok(None)
                    }
                }
                Err(e) => Err(e.to_string())
            };

            let audits_res: Result<usize, String> = match rusqlite::Connection::open(crate::config::get_config_dir().join("cameleer.db")) {
                Ok(conn) => {
                    let count: usize = conn.query_row("SELECT COUNT(*) FROM audit_log", [], |row| row.get(0)).unwrap_or(0);
                    Ok(count)
                }
                Err(e) => Err(e.to_string())
            };

            // Lock and update State
            if let Ok(mut lock) = sync_state.lock() {
                if let Ok(msgs) = messages_res {
                    lock.messages = msgs.into_iter().map(|m| (m.role, m.content)).collect();
                }
                if let Ok(skills) = skills_res {
                    lock.skills_count = skills.len();
                }
                if let Ok(Some((id, cmd))) = pending_res {
                    lock.pending_command = Some((id, cmd));
                } else {
                    lock.pending_command = None;
                }
                if let Ok(count) = audits_res {
                    lock.audits_count = count;
                }
            }
        }
    });

    // 4. Main Drawing / Event Loop
    let mut last_tick = std::time::Instant::now();
    let tick_rate = Duration::from_millis(50);

    loop {
        // Draw TUI
        terminal.draw(|f| {
            let state_lock = state.lock().unwrap();
            draw_tui(f, &state_lock, &agent);
        })?;

        // Handle Crossterm Keyboard Events
        let timeout = tick_rate
            .checked_sub(last_tick.elapsed())
            .unwrap_or(Duration::from_secs(0));

        if event::poll(timeout)? {
            if let Event::Key(key) = event::read()? {
                if key.kind == event::KeyEventKind::Press {
                    let mut state_lock = state.lock().unwrap();

                    // Absolute Exit Hotkey (Ctrl + C)
                    if key.code == KeyCode::Char('c') && key.modifiers.contains(KeyModifiers::CONTROL) {
                        break;
                    }

                    // A: Sandbox confirmation intercept mode
                    if let Some((cmd_id, _)) = state_lock.pending_command {
                        match key.code {
                            KeyCode::Char('y') | KeyCode::Char('Y') => {
                                // Approve Command
                                if let Ok(conn) = rusqlite::Connection::open(crate::config::get_config_dir().join("cameleer.db")) {
                                    let _ = conn.execute("UPDATE audit_log SET status = 'approved' WHERE id = ?1", [cmd_id]);
                                }
                                state_lock.pending_command = None;
                            }
                            KeyCode::Char('n') | KeyCode::Char('N') => {
                                // Deny Command
                                if let Ok(conn) = rusqlite::Connection::open(crate::config::get_config_dir().join("cameleer.db")) {
                                    let _ = conn.execute("UPDATE audit_log SET status = 'denied' WHERE id = ?1", [cmd_id]);
                                }
                                state_lock.pending_command = None;
                            }
                            _ => {} // Ignore other keystrokes during pending safety block
                        }
                    } else {
                        // B: Regular Command Entry Mode
                        match key.code {
                            KeyCode::Enter => {
                                let input_str = state_lock.input.trim().to_string();
                                if !input_str.is_empty() {
                                    state_lock.input.clear();

                                    if input_str == "/exit" || input_str == "/quit" {
                                        break;
                                    } else if input_str == "/clear" {
                                        let _ = agent.storage().clear_session("console_default");
                                    } else {
                                        // Send message to background tokio agent thread
                                        state_lock.status = "THINKING".to_string();
                                        state_lock.messages.push(("user".to_string(), input_str.clone()));

                                        let agent_clone = Arc::clone(&agent);
                                        let state_clone = Arc::clone(&state);
                                        tokio::spawn(async move {
                                            let _ = agent_clone.process_message("console_default", &input_str, "console").await;
                                            if let Ok(mut lock) = state_clone.lock() {
                                                lock.status = "IDLE".to_string();
                                            }
                                        });
                                    }
                                }
                            }
                            KeyCode::Char(c) => {
                                state_lock.input.push(c);
                            }
                            KeyCode::Backspace => {
                                state_lock.input.pop();
                            }
                            _ => {}
                        }
                    }
                }
            }
        }

        if last_tick.elapsed() >= tick_rate {
            last_tick = std::time::Instant::now();
        }
    }

    // 5. Restore Terminal Alternate Screen
    disable_raw_mode()?;
    execute!(
        terminal.backend_mut(),
        LeaveAlternateScreen
    )?;
    terminal.show_cursor()?;

    Ok(())
}

fn draw_tui(f: &mut Frame, state: &TuiState, agent: &Agent) {
    let size = f.size();

    // 1. Layout splits
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Top Header Bar
            Constraint::Min(10),   // Chat Logs and Diagnostics split
            Constraint::Length(3), // Bottom prompt bar
        ])
        .split(size);

    // 2. Draw Top Status Header
    let status_color = if state.status == "THINKING" {
        Color::Yellow
    } else {
        Color::Green
    };

    let header_spans = vec![
        Span::styled("🦀 CAMELEER SECURE TERMINAL ", Style::default().fg(Color::Magenta).bold()),
        Span::raw(" |  "),
        Span::styled(format!("LLM: {} (provider: {})", agent.config().llm.model, agent.config().llm.provider), Style::default().fg(Color::Cyan)),
        Span::raw(" |  "),
        Span::styled(format!("STATUS: [{}]", state.status), Style::default().fg(status_color).bold()),
    ];

    let header = Paragraph::new(Line::from(header_spans))
        .block(Block::default().borders(Borders::ALL).border_type(BorderType::Rounded))
        .alignment(Alignment::Left);
    f.render_widget(header, chunks[0]);

    // 3. Draw Workspace split (Conversation Left / System Stats & Sandboxing Right)
    let workspace_chunks = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([
            Constraint::Percentage(65), // Conversation Viewport
            Constraint::Percentage(35), // Sandbox & Stats Viewport
        ])
        .split(chunks[1]);

    // Conversation List rendering
    let list_items: Vec<ListItem> = state.messages.iter().map(|(role, content)| {
        let role_span = match role.as_str() {
            "user" => {
                if content.starts_with("Tool Command:") {
                    Span::styled("🔧 System Tool Outcome: ", Style::default().fg(Color::Cyan).bold())
                } else {
                    Span::styled("👤 User: ", Style::default().fg(Color::Green).bold())
                }
            }
            "assistant" => Span::styled("🤖 Agent thoughts: ", Style::default().fg(Color::Magenta).bold()),
            "system" => Span::styled("⚠️ System Self-Healing Alert: ", Style::default().fg(Color::Red).bold()),
            _ => Span::styled("💬 Chat: ", Style::default().fg(Color::White).bold()),
        };

        // Split multiline lines to prevent block clipping
        let mut lines = Vec::new();
        for (i, raw_line) in content.lines().enumerate() {
            if i == 0 {
                lines.push(Line::from(vec![role_span.clone(), Span::raw(raw_line)]));
            } else {
                lines.push(Line::from(vec![Span::raw("   "), Span::raw(raw_line)]));
            }
        }
        ListItem::new(lines)
    }).collect();

    let chat_list = List::new(list_items)
        .block(Block::default().borders(Borders::ALL).title(" 💬 Active Memory Thread "));
    f.render_widget(chat_list, workspace_chunks[0]);

    // Right-hand Panel Split (System Statistics / Sandbox Alert Box)
    let right_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(8), // Whitelist and Cap metrics
            Constraint::Min(4),    // Sandbox approvals interception
        ])
        .split(workspace_chunks[1]);

    // Section 1: System Statistics
    let stats_text = vec![
        Line::from(vec![
            Span::raw(" Whitelisted commands: "),
            Span::styled(format!("{}", state.whitelisted_count), Style::default().fg(Color::Cyan).bold()),
        ]),
        Line::from(vec![
            Span::raw(" Active ClawHub skills: "),
            Span::styled(format!("{}", state.skills_count), Style::default().fg(Color::Magenta).bold()),
        ]),
        Line::from(vec![
            Span::raw(" Persistent storage audits: "),
            Span::styled(format!("{}", state.audits_count), Style::default().fg(Color::Yellow).bold()),
        ]),
        Line::from(""),
        Line::from(Span::styled(" (Press Ctrl+C to force-quit the console)", Style::default().fg(Color::DarkGray).italic())),
    ];
    let stats_widget = Paragraph::new(stats_text)
        .block(Block::default().borders(Borders::ALL).title(" ⚙️ Local Engine Diagnostics "));
    f.render_widget(stats_widget, right_chunks[0]);

    // Section 2: Sandbox approvals interception
    if let Some((_, cmd)) = &state.pending_command {
        let sandbox_alert = vec![
            Line::from(Span::styled("⚠️ SECURITY SANDBOX INTERCEPT", Style::default().fg(Color::Yellow).bold())),
            Line::from(""),
            Line::from(" The agent requested to execute:"),
            Line::from(Span::styled(format!("   $ {}", cmd), Style::default().fg(Color::LightRed).bold())),
            Line::from(""),
            Line::from(vec![
                Span::raw(" ACTION CHANNELS: Press "),
                Span::styled("[Y]", Style::default().fg(Color::Green).bold()),
                Span::raw(" to Approve  /  "),
                Span::styled("[N]", Style::default().fg(Color::Red).bold()),
                Span::raw(" to Deny"),
            ]),
        ];

        let sandbox_widget = Paragraph::new(sandbox_alert)
            .block(Block::default().borders(Borders::ALL).border_style(Style::default().fg(Color::Yellow).bold()).title(" 🛡️ Active Firewall "));
        f.render_widget(sandbox_widget, right_chunks[1]);
    } else {
        let sandbox_empty = vec![
            Line::from(""),
            Line::from(Span::styled("  🟢 Firewall Gate: PASSIVE", Style::default().fg(Color::Green).bold())),
            Line::from(""),
            Line::from("  No pending command interceptions."),
            Line::from("  Excellent! Engine operating securely."),
        ];
        let sandbox_widget = Paragraph::new(sandbox_empty)
            .block(Block::default().borders(Borders::ALL).title(" 🛡️ Active Firewall "));
        f.render_widget(sandbox_widget, right_chunks[1]);
    }

    // 4. Draw Footer Prompt bar
    let footer_text = if state.pending_command.is_some() {
        Span::styled(" 👉 INPUT LOCK: Pending Sandbox Safety Confirmation ([Y]es / [N]o) ", Style::default().fg(Color::Yellow).bold())
    } else {
        Span::raw(format!(" 👉 Console Prompt: {}", state.input))
    };

    let footer = Paragraph::new(Line::from(footer_text))
        .block(Block::default().borders(Borders::ALL).border_type(BorderType::Rounded))
        .alignment(Alignment::Left);
    f.render_widget(footer, chunks[2]);
}
