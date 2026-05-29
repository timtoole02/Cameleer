# ✦ Cameleer ✦

> **A premium, safe, and blazing-fast autonomous local AI Agent platform written entirely in Rust.**

---

Cameleer is a next-generation, self-hosted autonomous AI agent workspace designed from the ground up for superior performance, strict safety controls, and local-first execution. It features a fully integrated, high-performance local GGUF inference engine (**`camelid`**) supporting native Apple Silicon Metal GPU acceleration out-of-the-box, packaged into a gorgeous, self-contained standalone macOS application (`Cameleer.app`). 

Connect your agents to standard cloud APIs (Anthropic, Gemini, OpenAI) or route them to your own locally-stored GGUF models concurrently with absolute data privacy—all managed under a strict, human-in-the-loop shell command sandbox.

---

## ⚡ Why Cameleer?

- **Integrated Local AI (via `camelid`)**: Direct, offline GGUF inference powered by a high-performance Rust-native backend. No API keys, no subscription plans, and 100% data privacy.
- **Native Metal GPU Acceleration**: Harnesses the full power of Apple Silicon out-of-the-box, implementing advanced Metal Q8 retained acceleration pathways for lightning-fast model responses.
- **Enterprise-Grade Safety Sandbox**: Rogue agent commands are a thing of the past. Cameleer features a strict command whitelist, blocks recursive deletes, and provides *Human-in-the-Loop* approval prompts (inline buttons on Telegram/Discord or interactive CLI confirm gates) before executing any shell commands.
- **Fully Self-Contained macOS App**: The production application (`Cameleer.app`) bundles the local `camelid` engine directly inside it. Just double-click the app from your Desktop, and the background inference starts up automatically.
- **SQLite Persistence**: Chat logs, key-value memory blocks, and comprehensive audit traces of every command executed are saved to an embedded, zero-configuration local SQLite database.
- **Multi-Channel Concurrency**: Handles multiple gateway integrations in parallel. Control your agent from a beautiful local interactive shell or message it on-the-go from Telegram or Discord.

---

## 🍏 macOS Installation Guide

Follow these step-by-step instructions to compile, package, and launch the complete self-contained Cameleer platform with local accelerated AI on your Mac:

### 1. Prerequisites
Ensure you have the core build toolchains installed:
* **Rust**: Install via rustup:
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
* **Node.js & npm**: Install via Homebrew or directly from Nodejs.org:
  ```bash
  brew install node
  ```

### 2. Clone the Repository
Clone the codebase and navigate to the project directory:
```bash
git clone https://github.com/timtoole02/Cameleer.git
cd Cameleer
```

### 3. Compile Core Rust Binaries
Compile both the local **`camelid`** GGUF inference engine and the **`cameleer`** autonomous agent CLI in release mode:
```bash
cargo build --release
```

### 4. Build the Tauri Desktop GUI App
Install the frontend node packages and build the production macOS application bundle (`Cameleer.app`):
```bash
cd control-center
npm install
CARGO_TARGET_DIR="target" npm run tauri build
cd ..
```
*Note: We specify `CARGO_TARGET_DIR="target"` during compilation to prevent native AppleDouble cache conflicts on external drives.*

### 5. Package the Standalone Desktop Bundles
Run the packaging utility to compile the Cocoa app launcher wrapper and automatically copy the required `camelid` local inference engine directly inside the app bundle so that it is 100% self-contained:
```bash
./package.sh
```

### 6. Run the Platform
Once packaged, the build script deploys the standalone binaries straight to your Desktop. Simply double-click **`Cameleer.app`** or **`Cameleer Engine.app`** on your Desktop to run:
* **`Cameleer.app`**: The high-fidelity desktop UI chat panel and agent control room. It will automatically spawn the GPU Metal-accelerated `camelid` server on startup and maintain it in the background.
* **`Cameleer Engine.app`**: A lightweight Cocoa status-bar menu interface that serves the web gateway on port `8080` in the background.

---

## ⚙️ Configuration

Your settings are stored in TOML format at `~/.cameleer/config.toml`. You can configure:
- **LLM Provider**: Swap between `ollama` (default local models), `anthropic`, `openai`, or `gemini`.
- **Security Whitelist**: Explicitly control the set of binaries (e.g., `["ls", "pwd", "cat", "curl", "grep"]`) the agent is authorized to use.
- **Command Approvals**: Toggle `require_approval = true` to force manual confirmations before any mutating operations.
- **Gateways (Console, Telegram, Discord)**: Enable bots, enter tokens, and restrict authorization strictly to specific channels or your personal user accounts.

For complete step-by-step setup guides, check out [walkthrough.md](walkthrough.md).

---

## 📂 Writing Skills

Skills are portable markdown playbooks stored under `~/.cameleer/skills/`. To write a skill, simply create a folder with a `SKILL.md` inside:

```markdown
---
name: weather-check
description: Fetches current weather information for a specified city using wttr.in.
---

# Weather Check Playbook
Use this skill when the user asks for the weather forecast or temperature.

## Workflow
1. Identify the city name from the user's message.
2. Execute the shell command:
   `curl "wttr.in/YOUR_CITY?format=3"` (Replace YOUR_CITY with the target city).
3. Report the exact output of curl directly to the user.
```

Cameleer parses the YAML frontmatter and dynamically registers it into the agent's reasoning cycle on startup!

---

## 🛡️ License
Cameleer is released under the MIT License.
