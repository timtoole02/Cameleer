# Cameleer — Technical Walkthrough & User Guide

Cameleer is a premium, safe, and lightning-fast AI Agent system written entirely in Rust. It functions as a secure gateway that bridges your messaging environments with local machine execution via standard, portable Markdown files (`SKILL.md`).

---

## 🏗️ Architecture Overview

Cameleer is designed as a single compile target with high concurrency and safety at its core:

1. **Async Orchestrator (Tokio)**: Powers multiple concurrent communication adapters (Console TUI, Telegram poll loops, and a native Web Dashboard server) without thread starvation.
2. **ReAct Reasoning Agent**: Parses prompts, integrates context-aware conversation history from SQLite, compiles dynamic skill rules, parses action blocks, and runs a loop-prevention self-healing diagnostic layer.
3. **Structured Security Sandbox**: Acts as a strict firewall for shell execution. Whitelists binaries, catches harmful flags (like recursive deletes), and intercepts calls to prompt the active user for authorization.
4. **Relational Local Memory (SQLite)**: Persists audit traces, KV skill variables, and chat transcripts out-of-the-box.

---

## 🚀 Getting Started

### 1. Build and Compile
Since Cameleer is written in standard Rust, building is simple. Run:
```bash
cargo build --release
```
This compiles the code into a single high-performance binary under `target/release/cameleer`.

### 2. Onboard and Initialize
Run the onboarding command to create default directories (`~/.cameleer/`), configs (`~/.cameleer/config.toml`), databases, and copy default skills:
```bash
cargo run onboard
```

### 3. Start the Interactive TUI Dashboard
Simply run the program with no arguments to start the beautiful full-screen console:
```bash
cargo run
```
You can type direct messages to your agent or run slash commands inside the focused footer input box:
- `/clear` - Wipe conversation memory.
- `/exit` - Safely exit the terminal dashboard.

---

## ⚙️ Configuration Guide

Your configuration lives at `~/.cameleer/config.toml`. Here is how to customize it:

### LLM Provider Settings
You can choose between `ollama` (default local model), `anthropic`, `openai`, or `gemini`:

```toml
[llm]
provider = "ollama"         # Options: "ollama", "anthropic", "openai", "gemini"
model = "llama3"            # E.g. "claude-3-5-sonnet-latest", "gpt-4o", "gemini-1.5-pro"
ollama_url = "http://localhost:11434"
anthropic_api_key = "your_anthropic_api_key"
openai_api_key = "your_openai_api_key"
gemini_api_key = "your_gemini_api_key"
```

### Security Whitelist & Approvals
Safety is paramount in Cameleer. You can control exactly what your agent is allowed to do:

```toml
[security]
require_approval = true     # Intercepts commands and prompts you (Y/n) before running
allowed_commands = [        # Whitelisted executables the agent is allowed to invoke
    "ls", "pwd", "date", "cat", "echo", "curl", "grep"
]
allowed_paths = [           # Directories approved for read/write
    "/Users/timtoole/.gemini/antigravity/scratch/cameleer"
]
```

---

## 🛡️ Self-Healing & Loop Prevention Engine

Cameleer features a built-in diagnostic safety valve that protects the agent from derailment:
*   **Loop Protection**: If the agent attempts to invoke the exact same binary with the same parameters twice in a single ReAct cycle, the engine intercepts the call and injects a reflection warning into the history, steering it to try a new strategy.
*   **Structured Exception Diagnostic**: When a shell command returns a non-zero exit code or writes to `stderr`, the system automatically appends a diagnostic alert prompting the agent to check for typos, paths, or missing arguments, enabling autonomous correction!

---

## 💻 Full-Screen Terminal User Interface (TUI)

The terminal gateway has been completely transformed into a full-screen, responsive, multi-pane **`ratatui`** console:

### 1. Panel Layout Splits:
*   **Top Header Status**: Displays system information, current loaded LLM details, and active status (`IDLE` or `[THINKING]`).
*   **Left Column (Active Memory Thread)**: Displays a scrollable conversation view, color-coding brackets for `User` (Green), `Agent thoughts` (Magenta), and system `Tool Outcome` (Cyan).
*   **Right Column (Diagnostics & Firewall)**:
    - **Engine Diagnostics**: Real-time counters displaying loaded Whitelisted commands, Cameleer Skills, and total database audits.
    - **Active Firewall Interceptor**: Flashes in bright yellow if a mutating action is intercepted by the security sandbox.
*   **Footer Prompt Bar**: Focused input panel representing console entry.

### 2. Direct Hotkey Sandboxing:
If a command requires user permission, the input bar locks, and the Firewall pane flashes. You can press:
*   **`Y`** on your keyboard to instantly approve execution.
*   **`N`** on your keyboard to instantly deny execution.
*   This immediately updates SQLite, releasing the sandbox thread inside the background worker!

---

## 🕸️ Self-Hosted Web Control Dashboard (SPA)

Whenever the agent is running, it natively serves a zero-dependency **Web Control Dashboard & Chat Interface** at `http://localhost:8080`!

### Features:
1. **Unified Live Chat Panel**: Talk directly to the agent from your browser. View system thought processes, watch tool calls output inside customized blocks, and approve or deny sandbox requests.
2. **Interactive Skill Designer**: Hit **`+ Design New Skill`** in your browser to bring up an inline Markdown Editor, write your YAML frontmatter, and deploy playbooks instantly to `~/.cameleer/skills/`.
3. **Inline TOML Config Editor**: Fetch, validate, and write back your `~/.cameleer/config.toml` parameters without opening an external file editor.
4. **Interactive Sandbox Approvals**: Glow-pulsed cards with **Approve 🚀** and **Deny 🚫** buttons update SQLite databases immediately to resume sandbox runs.
5. **Session Hard Reset**: A warning button that cleanly purges SQLite thread records and logs for a fresh restart.

---

##  Native macOS GUI Application (Cameleer.app)

Cameleer is now fully packaged into a production-grade, double-clickable standalone macOS desktop application (`Cameleer.app`) deployed directly to your Desktop!

---

## 📥 Phase 11: Local GGUF Model Downloader & Manager

We have designed and engineered a high-fidelity **Models** configuration page inside the control center GUI, enabling native, asynchronous model downloads and active hot-swapping.

---

## ⚡ Phase 12: Dynamic Agent Model Routing & Concurrent Multi-Model Executions

Each agent in the Cameleer crew operates as a containerized worker whose inference provider and model can be dynamically configured. This enables concurrent multi-model executions live.

### 1. Curated Provider Option Lists
We introduced standard, curated select dropdown options mapped to each LLM provider:
*   **Local Camelid GGUF**: Standard downloaded files listed in `~/.cameleer/models/` + default system active GGUFs.
*   **Ollama Local API**: `qwen2.5-coder`, `llama3.2`, `llama3`, `mistral`, `deepseek-r1`.
*   **OpenAI Cloud API**: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `o1-mini`, `o1-preview`.
*   **Anthropic Claude API**: `claude-3-5-sonnet`, `claude-3-5-haiku`, `claude-3-opus`.

### 2. Smart Selector Overrides & Custom Tags
To ensure complete flexibility, the frontend automatically analyzes the active model. If an agent runs a model not present in the standard lists (e.g. a custom local fine-tune or custom API string), the dynamic dropdown resolves automatically to `"✦ Custom Model Tag..."` and renders a text `<input>` below it to permit raw overrides. This handles existing setups cleanly with zero configuration loss.

### 3. Multi-Model Concurrency Mechanics
Because each agent represents an independent entity in our relational SQLite state, they can execute distinct sandboxed operations in the background concurrently. For example:
*   `agent-coder` can run a heavy local GGUF like `Mistral-7B-Instruct-v0.3.Q8_0.gguf` via Ollama for code composition.
*   `agent-analyst` can concurrently query `gpt-4o-mini` via OpenAI for fast logical checks.
*   `agent-writer` can simultaneously run `claude-3-5-sonnet` via Anthropic for report packaging.
This allows the orchestrator to resolve dependent tasks and execute joint plans across different models simultaneously!
